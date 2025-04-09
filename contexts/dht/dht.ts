import { EventEmitter } from "events";
import WebRTCRPC, { Node, RPCMessage } from "./webrtc-rpc";
import KBucket from "./kbucket";
import { RTCDataChannel, MessageEvent } from "react-native-webrtc";
import { Message } from '../../app/chat/chatUtils'

export interface DHTOptions {
  nodeId: string;
  getDataChannel?: (node: Node) => RTCDataChannel | null;
  bootstrapNodeId?: string;
  k?: number;
}

export interface QueuedMessage {
  sender: string;
  recipient: string;
  message: Message;
  timestamp: number;
}

class DHT extends EventEmitter {
  private rpc: WebRTCRPC;
  private buckets: KBucket;
  private messages: QueuedMessage[];
  private k: number;
  private forwaredMessagesIds: Set<string>;

  constructor(opts: DHTOptions) {
    super();
    this.rpc = new WebRTCRPC({
      nodeId: opts.nodeId
    });
    this.buckets = new KBucket(this.rpc.getId(), opts.k);
    this.messages = [];
    this.k = opts.k || 2;
    this.forwaredMessagesIds = new Set();

    this.rpc.on("ping", (node) => this.addNode(node));
    this.rpc.on("message", this.handleMessage.bind(this));
    this.rpc.on("listening", (node) => this.addNode(node));
    this.rpc.on("warning", (err) => this.emit("warning", err));

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
      const alive = await this.rpc.ping(node);
      console.log('Received pong:', alive);
      if (alive) this.emit('ready');
      console.log(this.buckets);
    } else {
      console.log('Node already exists:', node.id);
    }
    // this.tryDeliver(); //todo: share cached messages
  }

  public async sendMessage(recipient: string, message: Message): Promise<void> {
    const sender = this.rpc.getId();
    console.log("Looking for target node in buckets.")

    // if (this.findNodeInBuckets(recipient) && index < 3) // TODO: Cache message
    const targetNode = await this.findAndPingNode(recipient);
    if (targetNode) {
      const success = await this.rpc.sendMessage(
        targetNode,
        sender,
        recipient,
        message
      );
      if (success) this.emit("sent", { sender, recipient, content: message });
      else this.forward(sender, recipient, message);
    } else {
      console.log("Routing message through other peers");
      // Recipient offline, forward to K closest
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

  private async forward(
    sender: string,
    recipient: string,
    message: Message
  ): Promise<void> {
    if (this.forwaredMessagesIds.has(message.id)) {
      console.log("Message already forwarded - avoiding forwarding again");
      return; // avoid reforwarding the same message again in the loop
    }
    const closest = this.buckets.closest(recipient, this.k);
    console.log("Sending message to K closests peers: List of closests nodes:");
    console.log(closest);
    try {
      for (const node of closest) {
        if (node.id != sender) await this.rpc.sendMessage(node, sender, recipient, message);
      }
    } catch(error) {
      console.log("Error when forwarding meesage")
      console.log(error)
    }
    this.forwaredMessagesIds.add(message.id);
    this.emit("forward");
    console.log("Message forwarded!");
  }

  // Handle incoming messages
  private handleMessage(rpcMessage: RPCMessage, from: Node): void {
    console.log("Handling message: " + rpcMessage.type + ". From: " + from.id);
    if (rpcMessage.type === 'message') {
      const { sender, recipient, message } = rpcMessage;
      if (!sender || !recipient || !message) return;

      this.addNode(from); // Update routing table

      if (recipient === this.rpc.getId()) {
        console.log("In dht.ts - recieved chat message on dht")
        this.emit("chatMessage", message);
      } else {
        // Queue and try to deliver
        console.log(message)
        this.messages.push({ sender, recipient, message: message!, timestamp: Date.now() });
        this.tryDeliver();
        // this.forward(sender, recipient, message!);
      }
    }
  }

  private async tryDeliver(): Promise<void> {
    console.log("Trying to deliver the message to target node")
    const undelivered = [...this.messages];
    console.log(this.messages);
    for (const msg of undelivered) {
      const targetNode = await this.findAndPingNode(msg.recipient);
      if (targetNode) {
        // todo: implement caching
        // let alive = await this.rpc.ping(targetNode);
        // if (!alive) return; // do nothing, message will stay in the queue
        console.log("Node found! Sending the message: " + msg);
        const success = await this.rpc.sendMessage(
          targetNode,
          msg.sender,
          msg.recipient,
          msg.message
        );
        if (success) {
          this.messages = this.messages.filter((m) => m !== msg);
          this.emit("delivered", msg);
        }
      } else {
        this.forward(msg.sender, msg.recipient, msg.message);
        this.messages = this.messages.filter((m) => m !== msg);
      }
    }
  }

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
