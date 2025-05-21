import { EventEmitter } from "events";
import { RTCDataChannel, MessageEvent } from "react-native-webrtc";
import { MessageDTO } from '../../app/chat/chatUtils';
import uuid from "react-native-uuid";
import { WebSocketMessage } from "@/types/types";

interface RPCOptions {
  nodeId: string;
  getDataChannel?: (node: Node) => RTCDataChannel | null;
}

export interface Node {
  id: string;
}

export interface RPCMessage {
  type: "ping" | "pong" | "message" | "signaling";
  sender: string;
  recipient?: string;
  message?: MessageDTO | null;
  signalingMessage?: WebSocketMessage | null;
  id?: string;
}

export default class WebRTCRPC extends EventEmitter {
  private channels: Map<string, RTCDataChannel>;
  private destroyed: boolean;
  private id: string;
  private blockedPeersRef: React.MutableRefObject<Set<string>>;

  constructor(opts: RPCOptions, blockedPeersRef: React.MutableRefObject<Set<string>>) {
    super();
    this.id = opts.nodeId;
    this.channels = new Map();
    this.destroyed = false;
    this.blockedPeersRef = blockedPeersRef;
  }

  public async ping(node: Node): Promise<boolean> {
    if (this.destroyed || !node.id) return false;

    const channel = this.getChannel(node);
    if (!channel || channel.readyState !== "open") return false;

    console.log("Sending DHT ping to node " + node.id);
    return new Promise((resolve) => {
      try {
        const pingId = uuid.v4() as string;
        channel.send(JSON.stringify({ type: 'ping', sender: this.getId(), id: pingId } as RPCMessage));
        const onPong = (message: RPCMessage, from: Node) => {
          if (message.type === 'pong' && message.id === pingId && from.id === node.id) {
            this.removeListener('message', onPong);
            resolve(true);
          }
        };
        this.on('message', onPong);

        setTimeout(() => {
          this.removeListener('message', onPong);
          resolve(false);
        }, 10_000);
      } catch (error) {
        console.log("Error when sending ping: " + error);
        resolve(false);
      }
    });
  }

  public async sendMessage(
    node: Node,
    sender: string,
    recipient: string,
    message: MessageDTO | null = null,
    signalingMessage: WebSocketMessage | null = null
  ): Promise<boolean> {
    if (this.destroyed) return false;
    const channel = this.getChannel(node);
    if (!channel || channel.readyState !== "open") {
      // console.warn(`Data channel to ${node.id} is not open`);
      return false;
    }

    try {
      const payload: RPCMessage = {
        type: signalingMessage ? "signaling" : "message",
        sender,
        recipient,
        message,
        signalingMessage
      };
      channel.send(JSON.stringify(payload));
      return true;
    } catch (error) {
      console.error(`Error sending message to ${node.id}:`, error);
      return false;
    }
  }

  public closeDataChannel(node: Node): void {
    const channel = this.channels.get(node.id);
    if (channel) {
      channel.close();
      this.channels.delete(node.id);
    }
  }

  public setUpDataChannel(node: Node, dataChannel: RTCDataChannel) {
    dataChannel.onmessage = (event) => {
      console.log("Received Message on DHT datachannel");
      this.handleMessage(event, node);
    };
    dataChannel.onopen = () => {
      this.emit("listening", node);
      console.log("DHT DataChannel opened with " + node.id);
    };
    dataChannel.onerror = (err) => this.emit("warning", err);
    dataChannel.onclose = () => this.channels.delete(node.id);
    this.channels.set(node.id, dataChannel);
  }

  private getChannel(node: Node): RTCDataChannel | null {
    let channel = this.channels.get(node.id);
    if (!channel) {
      // console.log("Couldn't retrieve datachannel to node " + node.id);
      return null;
    }
    return channel;
  }

  private handleMessage(event: MessageEvent, node: Node): void {
    console.log("Received message in DHT from " + node.id);
    try {
      const message: RPCMessage = JSON.parse(event.data as string);
      if (message.type === 'ping') {
        if (this.blockedPeersRef.current.has(node.id)) {
          return; // don't respond to ping from blocked peers
        }
        const channel = this.channels.get(node.id);
        if (channel) {
          channel.send(JSON.stringify({ type: 'pong', sender: this.getId(), id: message.id } as RPCMessage));
        }
        this.emit('ping', node);
      } else if (message.type === 'pong') {
        this.emit('message', message, node);
      } else if (message.type === "message" || message.type === "signaling") {
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
    this.removeAllListeners();
  }
}
