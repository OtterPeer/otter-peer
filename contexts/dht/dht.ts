import { EventEmitter } from "events";
import WebRTCRPC, { Node, RPCMessage } from "./webrtc-rpc";
import KBucket from "./kbucket";
import { RTCDataChannel, MessageEvent } from "react-native-webrtc";

export interface DHTOptions {
  nodeId: string;
  getDataChannel: (node: Node) => RTCDataChannel | null;
  bootstrapNodeId?: string; // Optional initial peer
  k?: number; // Kademlia K parameter
}

export interface QueuedMessage {
  sender: string;
  recipient: string;
  content: string;
  timestamp: number;
}

class DHT extends EventEmitter {
  private rpc: WebRTCRPC;
  private buckets: KBucket;
  private messages: QueuedMessage[];
  private k: number;

  constructor(opts: DHTOptions) {
    super();
    this.rpc = new WebRTCRPC({
      nodeId: opts.nodeId,
      getDataChannel: opts.getDataChannel,
    });
    this.buckets = new KBucket(this.rpc.getId(), opts.k);
    this.messages = [];
    this.k = opts.k || 20;

    this.rpc.on("ping", (node) => this.addNode(node));
    this.rpc.on("message", this.handleMessage.bind(this));
    this.rpc.on("listening", () => this.emit("ready"));
    this.rpc.on("warning", (err) => this.emit("warning", err));

    if (opts.bootstrapNodeId) this.bootstrap({ id: opts.bootstrapNodeId });
  }

  // Add a node to the routing table
  public addNode(node: Node): void {
    this.buckets.add(node);
    this.tryDeliver(); // Check if we can deliver queued messages
  }

  // Send a message to a recipient
  public async sendMessage(recipient: string, content: string): Promise<void> {
    const sender = this.rpc.getId();
    const targetNode = await this.findNode(recipient);

    if (targetNode) {
      // Recipient online, send directly
      const success = await this.rpc.sendMessage(
        targetNode,
        sender,
        recipient,
        content
      );
      if (success) this.emit("sent", { sender, recipient, content });
      else this.queueAndForward(sender, recipient, content);
    } else {
      // Recipient offline, queue and forward to K closest
      this.queueAndForward(sender, recipient, content);
    }
  }

  // Find a node by ID
  private async findNode(targetId: string): Promise<Node | null> {
    const closest = this.buckets.closest(targetId, this.k);
    for (const node of closest) {
      const alive = await this.rpc.ping(node);
      if (alive && node.id === targetId) return node;
    }
    return null;
  }

  // Queue locally and forward to K closest nodes
  private async queueAndForward(
    sender: string,
    recipient: string,
    content: string
  ): Promise<void> {
    this.messages.push({ sender, recipient, content, timestamp: Date.now() });
    const closest = this.buckets.closest(recipient, this.k);
    for (const node of closest) {
      await this.rpc.sendMessage(node, sender, recipient, content);
    }
  }

  // Handle incoming messages
  private handleMessage(message: RPCMessage, from: Node): void {
    const { sender, recipient, content } = message;
    if (!sender || !recipient || !content) return;

    this.addNode(from); // Update routing table

    if (recipient === this.rpc.getId()) {
      // Message is for us
      this.emit("chatMessage", { sender, content, from: from.id });
    } else {
      // Queue and try to deliver
      this.messages.push({ sender, recipient, content, timestamp: Date.now() });
      this.tryDeliver();
    }
  }

  // Attempt to deliver queued messages
  private async tryDeliver(): Promise<void> {
    const undelivered = [...this.messages];
    for (const msg of undelivered) {
      const targetNode = await this.findNode(msg.recipient);
      if (targetNode) {
        const success = await this.rpc.sendMessage(
          targetNode,
          msg.sender,
          msg.recipient,
          msg.content
        );
        if (success) {
          this.messages = this.messages.filter((m) => m !== msg);
          this.emit("delivered", msg);
        }
      }
    }
  }

  // Bootstrap with an initial node
  private async bootstrap(bootstrapNode: Node): Promise<void> {
    console.log("Adding bootstrap node...");
    this.addNode(bootstrapNode);
    const alive = await this.rpc.ping(bootstrapNode);
    if (alive) this.emit("ready");
  }

  public destroy(): void {
    this.rpc.destroy();
    this.emit("close");
  }
}

export default DHT;
