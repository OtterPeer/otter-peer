import { EventEmitter } from "events";
import WebRTCRPC, { Node, RPCMessage } from "./webrtc-rpc";
import KBucket from "./kbucket";
import { RTCDataChannel } from "react-native-webrtc";
import { MessageDTO } from '../../app/chat/chatUtils'
import { ForwardToAllCloserForwardStrategy, ForwardStrategy, ProbabilisticForwardStrategy } from "./forward-strategy";
import { CacheStrategy, DistanceBasedCacheStrategy, DistanceBasedProbabilisticCacheStrategy } from "./cache-strategy";
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  private ttlCleanupInterval: NodeJS.Timeout | null;
  private forwardStrategy: ForwardStrategy;
  private nodeId: string;
  private cacheStrategy: CacheStrategy;
  private readonly MAX_TTL = 48 * 3600 * 1000; //48H

  constructor(opts: DHTOptions) {
    super();
    this.rpc = new WebRTCRPC({
      nodeId: opts.nodeId
    });
    this.nodeId = opts.nodeId;
    this.buckets = new KBucket(this.nodeId, opts.k);
    this.k = opts.k || 20;
    this.forwardedMessagesIds = new Set();
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
      this.addNode(node)
    });
    this.rpc.on("message", this.handleMessage.bind(this));
    this.rpc.on("listening", (node) => {
      this.addNode(node);
      this.tryToDeliverCachedMessagesToTarget();
    });
    this.rpc.on("warning", (err) => this.emit("warning", err));

    this.loadState();
    this.startTTLCleanup();

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
    this.rpc.setUpDataChannel({id: nodeId}, dataChannel);
  }

  public closeDataChannel(nodeId: string) {
    this.rpc.closeDataChannel({id: nodeId});
  }

  public async addNode(node: Node): Promise<void> {
    const exists = this.buckets.all().some((n) => n.id === node.id);
    if (!exists) {
      console.log('Adding new node:', node.id);
      this.buckets.add(node);
      console.log(this.buckets);
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
    if (!sender){
      sender = this.nodeId
    }
    console.log("Looking for target node in buckets.");

    const targetNodeInBuckets = this.findNodeInBuckets(recipient);
    if (targetNodeInBuckets) {
      const alive = await this.rpc.ping(targetNodeInBuckets);
      if (alive) {
        const success = await this.rpc.sendMessage(targetNodeInBuckets, sender, recipient, message);
        if (success) {
          this.emit("sent", { sender, recipient, content: message });
        }
      }
      this.forward(sender, recipient, message);
      this.cacheMessage(sender, recipient, message, true);
    } else {
      console.log("Routing message through other peers");
      this.forward(sender, recipient, message);
      this.cacheMessage(sender, recipient, message, false);
    }
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

  private async forward(sender: string, recipient: string, message: MessageDTO): Promise<void> {
    if (!message.id || this.forwardedMessagesIds.has(message.id)) {
      console.log("Message already forwarded or no ID; skipping:", message.id);
      return;
    }
    const closest = this.buckets.closest(recipient, this.k);
    console.log("Forwarding message to K closest peers:", closest.map(n => n.id));
    try {
      for (const node of closest) {
        if (node.id !== sender && node.id !== this.nodeId) {
          await this.rpc.sendMessage(node, sender, recipient, message);
        }
      }
      this.forwardedMessagesIds.add(message.id);
      this.emit("forward", { sender, recipient, message });
      console.log("Message forwarded:", message.id);
    } catch (error) {
      console.error("Error forwarding message:", error);
    }
  }

  private handleMessage(rpcMessage: RPCMessage, from: Node): void {
    console.log("Handling message: " + rpcMessage.type + ". From: " + from.id);
    if (rpcMessage.type === 'message') {
      const { sender, recipient, message } = rpcMessage;
      if (!sender || !recipient || !message || !message.id) {
        console.warn("Invalid message; dropping.");
        return;
      }

      this.addNode(from);

      if (recipient === this.rpc.getId()) {
        console.log("Received chat message for self:", message);
        this.emit("chatMessage", message);
      } else {
        this.sendMessage(recipient, message, sender);
      }
    }
  }

  private async tryToDeliverCachedMessagesToTarget(): Promise<void> {
    await this.cacheStrategy.tryToDeliverCachedMessages(
      (targetId: string) => this.findAndPingNode(targetId),
      (node: Node, sender: string, recipient: string, message: MessageDTO) => this.rpc.sendMessage(node, sender, recipient, message),
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
      console.log("Loaded DHT state:")
      console.log(this.cacheStrategy.getCachedMessages())
      console.log(this.buckets)
    } catch (error) {
      throw error;
    }
  }

  private startTTLCleanup(): void {
    this.ttlCleanupInterval = setInterval(() => {
      this.cacheStrategy.tryToDeliverCachedMessages(
        (targetId: string) => this.findAndPingNode(targetId),
        (node: Node, sender: string, recipient: string, message: MessageDTO) => this.rpc.sendMessage(node, sender, recipient, message),
        this.MAX_TTL
      ).then(() => {
        console.log(`Cleaned up expired messages; ${this.cacheStrategy.getCachedMessageCount()} remain`);
      });
    }, 5 * 60 * 1000);
  }

  private stopTTLCleanup(): void {
    if (this.ttlCleanupInterval) {
      clearInterval(this.ttlCleanupInterval);
      this.ttlCleanupInterval = null;
    }
  }

  private cacheMessage(sender: string, recipient: string, message: MessageDTO, recipienFoundInBuckets: boolean): void {
    this.cacheStrategy.cacheMessage(sender, recipient, message, this.rpc.getId(), recipienFoundInBuckets);
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
    this.emit("close");
  }
}

export default DHT;
