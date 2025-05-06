import { EventEmitter } from "events";
import WebRTCRPC, { Node, RPCMessage } from "./webrtc-rpc";
import KBucket from "./kbucket";
import { RTCDataChannel } from "react-native-webrtc";
import { MessageDTO } from '../../app/chat/chatUtils';
import { ForwardToAllCloserForwardStrategy, ForwardStrategy, ProbabilisticForwardStrategy } from "./forward-strategy";
import { CacheStrategy, DistanceBasedCacheStrategy, DistanceBasedProbabilisticCacheStrategy } from "./cache-strategy";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebSocketMessage } from "@/types/types";

export interface DHTOptions {
  nodeId: string;
  getDataChannel?: (node: Node) => RTCDataChannel | null;
  forwardStrategy?: string;
  referenceDistanceForwarding?: number;
  cacheStrategy?: string;
  cacheSize?: number;
  cacheDistanceThreshold?: number;
  cacheProbability?: number;
  bootstrapNodeId?: string;
  k?: number;
}

export interface QueuedMessage {
  sender: string;
  recipient: string;
  message: MessageDTO;
}

class DHT extends EventEmitter {
  private rpc: WebRTCRPC;
  private buckets: KBucket;
  private k: number;
  private forwardedMessagesIds: Set<string>;
  private receivedSignalingMessageIds: Set<string>;
  private ttlCleanupInterval: NodeJS.Timeout | null;
  private forwardStrategy: ForwardStrategy;
  private nodeId: string;
  private cacheStrategy: CacheStrategy;
  private readonly MAX_TTL = 48 * 3600 * 1000; // 48H
  private readonly MAX_RECEIVED_IDS = 1000; // Maximum number of signaling message IDs to store

  constructor(opts: DHTOptions) {
    super();
    this.rpc = new WebRTCRPC({
      nodeId: opts.nodeId
    });
    this.nodeId = opts.nodeId;
    this.buckets = new KBucket(this.nodeId, opts.k);
    this.k = opts.k || 20;
    this.forwardedMessagesIds = new Set();
    this.receivedSignalingMessageIds = new Set();
    this.ttlCleanupInterval = null;

    this.forwardStrategy = this.createForwardStrategy(
      opts.forwardStrategy || 'all_closer',
      opts.referenceDistanceForwarding || 2**44
    );
    this.cacheStrategy = this.createCacheStrategy(
      opts.cacheStrategy || 'distance',
      opts.cacheSize || 1000,
      opts.cacheDistanceThreshold || 2**40,
      opts.cacheProbability || 0.7
    );

    this.rpc.on("ping", (node) => {
      this.addNode(node);
    });
    this.rpc.on("message", this.handleMessage.bind(this));
    this.rpc.on("listening", (node) => {
      this.addNode(node);
      this.tryToDeliverCachedMessagesToTarget();
    });
    this.rpc.on("warning", (err) => this.emit("warning", err));

    this.loadState();
    this.startTTLCleanup();
    this.startReceivedIdsCleanup();

    if (opts.bootstrapNodeId) this.bootstrap({ id: opts.bootstrapNodeId });
  }

  private createForwardStrategy(name: string, referenceDistance: number): ForwardStrategy {
    switch (name.toLowerCase()) {
      case 'probabilistic':
        return new ProbabilisticForwardStrategy(referenceDistance);
      case 'all_closer':
        return new ForwardToAllCloserForwardStrategy();
      default:
        throw new Error(`Unknown forward strategy: ${name}`);
    }
  }

  private createCacheStrategy(name: string, cacheSize: number, distanceThreshhold: number, cacheProbability: number): CacheStrategy {
    switch (name.toLowerCase()) {
      case 'distance':
        return new DistanceBasedCacheStrategy(cacheSize, distanceThreshhold);
      case 'distance_probabilistic':
        return new DistanceBasedProbabilisticCacheStrategy(cacheSize, distanceThreshhold, cacheProbability);
      default:
        throw new Error(`Unknown cache strategy: ${name}`);
    }
  }

  public setUpDataChannel(nodeId: string, dataChannel: RTCDataChannel) {
    this.rpc.setUpDataChannel({ id: nodeId }, dataChannel);
  }

  public closeDataChannel(nodeId: string) {
    this.rpc.closeDataChannel({ id: nodeId });
  }

  public async addNode(node: Node): Promise<void> {
    const exists = this.buckets.all().some((n) => n.id === node.id);
    if (!exists) {
      console.log('Adding new node:', node.id);
      this.buckets.add(node);
      const alive = await this.rpc.ping(node);
      console.log('Received pong:', alive);
      if (alive) {
        this.emit('ready');
        this.tryToDeliverCachedMessagesToTarget();
      }
    } else {
      console.log('Node already exists:', node.id);
    }
  }

  public async sendMessage(recipient: string, message: MessageDTO, sender?: string | null): Promise<void> {
    let originNode = false;
    if (!sender) {
      sender = this.rpc.getId();
      originNode = true;
    }
    console.log("Looking for target node in buckets.");

    const targetNodeInBuckets = this.findNodeInBuckets(recipient);
    if (targetNodeInBuckets) {
      const alive = await this.rpc.ping(targetNodeInBuckets);
      if (alive) {
        const success = await this.rpc.sendMessage(targetNodeInBuckets, sender, recipient, message);
        if (success) {
          this.emit("sent", { sender, recipient, content: message });
          this.forwardedMessagesIds.add(message.id);
        } else {
          this.cacheMessage(sender, recipient, message, true);
          this.forward(sender, recipient, message, originNode, true);
        }
      } else {
        this.cacheMessage(sender, recipient, message, true);
        this.forward(sender, recipient, message, originNode, true);
      }
    } else {
      console.log("Routing message through other peers");
      this.cacheMessage(sender, recipient, message, false);
      this.forward(sender, recipient, message, originNode);
    }
  }

  public async sendSignalingMessage(recipient: string, signalingMessage: WebSocketMessage, sender?: string | null): Promise<void> {
    let originNode = false;
    if (!sender) {
      sender = this.nodeId;
      originNode = true;
    }
    console.log("Looking for target node in buckets for signaling message.");

    // Assign an ID for deduplication if none exists
    if (!signalingMessage.id) {
      signalingMessage.id = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    }

    const targetNodeInBuckets = this.findNodeInBuckets(recipient);
    if (targetNodeInBuckets) {
      const alive = await this.rpc.ping(targetNodeInBuckets);
      if (alive) {
        const success = await this.rpc.sendMessage(targetNodeInBuckets, sender, recipient, null, signalingMessage);
        if (success) {
          this.emit("sent", { sender, recipient, content: signalingMessage });
          this.forwardedMessagesIds.add(signalingMessage.id);
        } else {
          this.forward(sender, recipient, signalingMessage, originNode, true);
        }
      } else {
        this.forward(sender, recipient, signalingMessage, originNode, true);
      }
    } else {
      console.log("Routing signaling message through other peers");
      this.forward(sender, recipient, signalingMessage, originNode);
    }
  }

  public getNodeId(): string {
    return this.nodeId;
  }

  public getBuckets(): KBucket {
    return this.buckets;
  }

  private findNodeInBuckets(nodeId: string): Node | null {
    const closest = this.buckets.closest(nodeId, this.k);
    for (const node of closest) {
      if (node.id === nodeId) {
        return node;
      }
    }
    return null;
  }

  private async findAndPingNode(targetId: string): Promise<Node | null> {
    const closest = this.buckets.closest(targetId, this.k);
    for (const node of closest) {
      if (node.id === targetId) {
        const alive = await this.rpc.ping(node);
        if (alive) return node;
      }
    }
    console.log("Node not found in buckets or didn't respond to ping");
    return null;
  }

  private async forward(
    sender: string,
    recipient: string,
    message: MessageDTO | WebSocketMessage,
    originNode: boolean = false,
    forceForwardingToKPeers: boolean = false
  ): Promise<void> {
    try {
      await this.forwardStrategy.forward(
        sender,
        recipient,
        message,
        this.buckets,
        { sendMessage: this.rpc.sendMessage.bind(this.rpc) },
        this.k,
        this.nodeId,
        this.forwardedMessagesIds,
        originNode,
        forceForwardingToKPeers,
        this.emit.bind(this)
      );
    } catch (error) {
      console.error(`Forwarding failed: ${error}`);
      if ('content' in message) {
        // Only cache MessageDTO
        this.cacheMessage(sender, recipient, message as MessageDTO, false);
      }
    }
  }

  private handleMessage(rpcMessage: RPCMessage, from: Node): void {
    console.log("Handling message: " + rpcMessage.type + ". From: " + from.id);
    this.addNode(from);

    if (rpcMessage.type === 'message') {
      const { sender, recipient, message } = rpcMessage;
      if (!sender || !recipient || !message || !message.id) {
        console.warn("Invalid message; dropping.");
        return;
      }

      if (recipient === this.rpc.getId()) {
        console.log("Received chat message for self:", message);
        this.emit("chatMessage", message);
      } else {
        this.sendMessage(recipient, message, sender);
      }
    } else if (rpcMessage.type === 'signaling') {
      const { sender, recipient, signalingMessage } = rpcMessage;
      if (!sender || !recipient || !signalingMessage || !signalingMessage.id) {
        console.warn("Invalid signaling message; dropping.");
        return;
      }

      // Check for duplicate signaling message
      if (this.receivedSignalingMessageIds.has(signalingMessage.id)) {
        console.log(`Duplicate signaling message ${signalingMessage.id} received; skipping.`);
        return;
      }

      // Add to received IDs and clean up if necessary
      this.receivedSignalingMessageIds.add(signalingMessage.id);
      if (this.receivedSignalingMessageIds.size > this.MAX_RECEIVED_IDS) {
        this.cleanupReceivedSignalingMessageIds();
      }

      if (recipient === this.rpc.getId()) {
        console.log("Received signaling message for self:", signalingMessage);
        this.emit("signalingMessage", signalingMessage);
      } else {
        this.sendSignalingMessage(recipient, signalingMessage, sender);
      }
    }
  }

  private cleanupReceivedSignalingMessageIds(): void {
    // Convert Set to array and remove the oldest entries to keep size under MAX_RECEIVED_IDS
    const ids = Array.from(this.receivedSignalingMessageIds);
    if (ids.length > this.MAX_RECEIVED_IDS) {
      const toRemove = ids.slice(0, ids.length - this.MAX_RECEIVED_IDS);
      toRemove.forEach(id => this.receivedSignalingMessageIds.delete(id));
      console.log(`Cleaned up ${toRemove.length} old signaling message IDs`);
    }
  }

  private startReceivedIdsCleanup(): void {
    // Periodically clean up old IDs (every 5 minutes)
    setInterval(() => {
      this.cleanupReceivedSignalingMessageIds();
    }, 5 * 60 * 1000);
  }

  private async tryToDeliverCachedMessagesToTarget(): Promise<void> {
    await this.cacheStrategy.tryToDeliverCachedMessages(
      (targetId: string) => this.findAndPingNode(targetId),
      (node: Node, sender: string, recipient: string, message: MessageDTO) =>
        this.rpc.sendMessage(node, sender, recipient, message),
      this.MAX_TTL
    );
    this.emit("delivered");
  }

  public async saveState(): Promise<void> {
    try {
      const messagesArray = Array.from(this.cacheStrategy.getCachedMessages());
      await AsyncStorage.setItem(`@DHT:${this.nodeId}:cachedMessages`, JSON.stringify(messagesArray));

      const nodes: Node[] = this.buckets.all().map(node => ({
        id: node.id
      }));
      await AsyncStorage.setItem(`@DHT:${this.nodeId}:kBucket`, JSON.stringify(nodes));
    } catch (error) {
      throw error;
    }
  }

  public async loadState(): Promise<void> {
    try {
      const cachedMessages = await AsyncStorage.getItem(`@DHT:${this.nodeId}:cachedMessages`);
      if (cachedMessages) {
        const messagesArray: [string, QueuedMessage][] = JSON.parse(cachedMessages);
        this.cacheStrategy.addCachedMessages(new Map(messagesArray));
      }

      const nodesJson = await AsyncStorage.getItem(`@DHT:${this.nodeId}:kBucket`);
      if (nodesJson) {
        const nodes: Node[] = JSON.parse(nodesJson);
        for (const node of nodes) {
          this.buckets.add({ id: node.id } as Node);
        }
      }
      console.log("Loaded DHT state:");
      console.log(this.cacheStrategy.getCachedMessages());
      console.log(this.buckets);
    } catch (error) {
      throw error;
    }
  }

  private startTTLCleanup(): void {
    this.ttlCleanupInterval = setInterval(() => {
      this.cacheStrategy.tryToDeliverCachedMessages(
        (targetId: string) => this.findAndPingNode(targetId),
        (node: Node, sender: string, recipient: string, message: MessageDTO) =>
          this.rpc.sendMessage(node, sender, recipient, message),
        this.MAX_TTL
      ).then(() => {
        // console.log(`Cleaned up expired messages; ${this.cacheStrategy.getCachedMessageCount()} remain`);
      });
    }, 5 * 60 * 1000);
  }

  private stopTTLCleanup(): void {
    if (this.ttlCleanupInterval) {
      clearInterval(this.ttlCleanupInterval);
      this.ttlCleanupInterval = null;
    }
  }

  private cacheMessage(sender: string, recipient: string, message: MessageDTO, recipientFoundInBuckets: boolean): void {
    this.cacheStrategy.cacheMessage(sender, recipient, message, this.rpc.getId(), recipientFoundInBuckets);
    this.emit("cache", { sender, recipient, message });
  }

  private async bootstrap(bootstrapNode: Node): Promise<void> {
    console.log("Adding bootstrap node...");
    this.addNode(bootstrapNode);
    const alive = await this.rpc.ping(bootstrapNode);
    if (alive) this.emit("ready");
  }

  public destroy(): void {
    this.stopTTLCleanup();
    this.rpc.destroy();
    this.forwardedMessagesIds.clear();
    this.receivedSignalingMessageIds.clear();
    this.emit("close");
  }
}

export default DHT;