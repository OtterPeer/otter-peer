import { EventEmitter } from "events";
import WebRTCRPC, { Node, RPCMessage } from "./webrtc-rpc";
import KBucket from "./kbucket";
import { RTCDataChannel, MessageEvent } from "react-native-webrtc";
import { Message, MessageDTO } from '../../app/chat/chatUtils'

export interface DHTOptions {
  nodeId: string;
  getDataChannel?: (node: Node) => RTCDataChannel | null;
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
  private cachedMessages: Map<string, QueuedMessage>;
  private k: number;
  private forwardedMessagesIds: Set<string>;
  private ttlCleanupInterval: NodeJS.Timeout | null;
  private readonly MAX_TTL = 48 * 3600 * 1000;

  constructor(opts: DHTOptions) {
    super();
    this.rpc = new WebRTCRPC({
      nodeId: opts.nodeId
    });
    this.buckets = new KBucket(this.rpc.getId(), opts.k);
    this.cachedMessages = new Map();
    this.k = opts.k || 2;
    this.forwardedMessagesIds = new Set();
    this.ttlCleanupInterval = null;

    this.rpc.on("ping", (node) => {
      this.addNode(node)
    });
    this.rpc.on("message", this.handleMessage.bind(this));
    this.rpc.on("listening", (node) => {
      this.addNode(node);
      console.log(this.cachedMessages)
      this.tryToDeliverCachedMessagesToTarget();
    });
    this.rpc.on("warning", (err) => this.emit("warning", err));

    this.startTTLCleanup();

    if (opts.bootstrapNodeId) this.bootstrap({ id: opts.bootstrapNodeId });
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
      sender = this.rpc.getId();
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
      // Forward and cache for redundancy
      this.forward(sender, recipient, message);
      this.cacheMessage(sender, recipient, message);
    } else {
      console.log("Routing message through other peers");
      this.forward(sender, recipient, message);
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
        if (node.id !== sender && node.id !== this.rpc.getId()) {
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
    console.log("Trying to deliver cached messages");
    const now = Date.now();
    for (const [messageId, msg] of this.cachedMessages) {
      if (now - msg.message.timestamp > this.MAX_TTL) {
        console.log(`Message ${messageId} expired; removing.`);
        this.cachedMessages.delete(messageId);
        continue;
      }

      const targetNode = await this.findAndPingNode(msg.recipient);
      try {
        if (targetNode) {
          const success = await this.rpc.sendMessage(
            targetNode,
            msg.sender,
            msg.recipient,
            msg.message
          );
          if (success) {
            console.log(`Delivered cached message ${messageId} to ${msg.recipient}`);
            this.cachedMessages.delete(messageId);
            this.emit("delivered", msg);
          }
        } else {
          console.log(`Recipient ${msg.recipient} offline; keeping message ${messageId} in cache`);
        }
      } catch (error) {
        console.log(error);
      }
    }
  }

  private startTTLCleanup(): void {
    this.ttlCleanupInterval = setInterval(() => {
      const now = Date.now();
      let deleted = 0;
      for (const [messageId, msg] of this.cachedMessages) {
        if (now - msg.message.timestamp > this.MAX_TTL) {
          this.cachedMessages.delete(messageId);
          deleted++;
        }
      }
      if (deleted > 0) {
        console.log(`Cleaned up ${deleted} expired messages`);
      }
    }, 5 * 60 * 1000); // Run every 5 minutes
  }

  private stopTTLCleanup(): void {
    if (this.ttlCleanupInterval) {
      clearInterval(this.ttlCleanupInterval);
      this.ttlCleanupInterval = null;
    }
  }

  private cacheMessage(sender: string, recipient: string, message: MessageDTO): void {
    if (!message.id || this.cachedMessages.has(message.id)) {
      console.log("Message already cached or no ID; skipping:", message.id);
      return;
    }
    const queued: QueuedMessage = {
      sender,
      recipient,
      message
    };
    this.cachedMessages.set(message.id, queued);
    console.log(`Cached message ${message.id} for ${recipient}`);
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
    this.cachedMessages.clear();
    this.forwardedMessagesIds.clear();
    this.emit("close");
  }
}

export default DHT;
