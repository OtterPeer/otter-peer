import { EventEmitter } from "events";
import { RTCDataChannel, MessageEvent } from "react-native-webrtc";

interface RPCOptions {
  nodeId: string;
  getDataChannel: (node: Node) => RTCDataChannel | null;
}

interface Node {
  id: string;
}

interface RPCMessage {
  type: "ping" | "message";
  sender: string;
  recipient?: string; // For 'message' type
  content?: string; // For 'message' type
}

class WebRTCRPC extends EventEmitter {
  private getDataChannel: (node: Node) => RTCDataChannel | null;
  private channels: Map<string, RTCDataChannel>;
  private destroyed: boolean;
  private id: string;

  constructor(opts: RPCOptions) {
    super();
    this.id = opts.nodeId;
    this.getDataChannel = opts.getDataChannel;
    this.channels = new Map();
    this.destroyed = false;
  }

  // Send a ping to check if a node is alive
  public async ping(node: Node): Promise<boolean> {
    if (this.destroyed) return false;
    const channel = this.getChannel(node);
    return new Promise((resolve) => {
      channel!.send(JSON.stringify({ type: "ping", sender: this.id }));
      setTimeout(() => resolve(false), 2000); // Timeout after 2s
    });
  }

  // Send a chat message
  public async sendMessage(
    node: Node,
    sender: string,
    recipient: string,
    content: string
  ): Promise<boolean> {
    if (this.destroyed) return false;
    const channel = this.getChannel(node);
    channel!.send(
      JSON.stringify({ type: "message", sender, recipient, content })
    );
    return true; // Assume success unless channel fails
  }

  // Get or establish a DataChannel
  private getChannel(node: Node): RTCDataChannel | null {
    let channel = this.channels.get(node.id);
    if (!channel) {
      let channel = this.getDataChannel(node);
      if (!channel) {
        return null;
      }
      return channel;
    }

    // if (!channel || channel.readyState !== "open") {
    //   throw new Error(`No open data channel available for node ${node.id}`);
    // }
    return channel;
    // if (!channel || channel.readyState !== "open") {
    //   channel = await this.getDataChannel(node);
    //   channel.onmessage = (event) => this.handleMessage(event, node);
    //   channel.onopen = () => this.emit("listening");
    //   channel.onerror = (err) => this.emit("warning", err);
    //   channel.onclose = () => this.channels.delete(node.id);
    //   this.channels.set(node.id, channel);
    // }
    // return channel;
  }

  // Handle incoming messages
  private handleMessage(event: MessageEvent, node: Node): void {
    try {
      const message: RPCMessage = JSON.parse(event.data as string);
      if (message.type === "ping") {
        this.emit("ping", node);
        const channel = this.channels.get(node.id);
        if (channel)
          channel.send(JSON.stringify({ type: "ping", sender: this.id })); // Pong
      } else if (message.type === "message") {
        this.emit("message", message, node);
      }
    } catch (e) {
      this.emit("warning", new Error("Invalid message"));
    }
  }

  public getId(): string {
    return this.id;
  }

  public destroy(): void {
    this.destroyed = true;
    for (const channel of this.channels.values()) channel.close();
    this.channels.clear();
  }
}

export default WebRTCRPC;
export { Node, RPCMessage };
