import { EventEmitter } from "events";
import { RTCDataChannel, MessageEvent } from "react-native-webrtc";
import { Message, MessageDTO } from '../../app/chat/chatUtils'
import uuid from "react-native-uuid";
import { WebSocketMessage } from "@/types/types";

interface RPCOptions {
  nodeId: string;
  getDataChannel?: (node: Node) => RTCDataChannel | null;
}

interface Node {
  id: string;
}

interface RPCMessage {
  type: "ping" | "pong" | "message" | "signaling";
  sender: string;
  recipient?: string;
  message?: MessageDTO;
  signalingMessage?: WebSocketMessage;
  id?: string;
}

class WebRTCRPC extends EventEmitter {
  private channels: Map<string, RTCDataChannel>;
  private destroyed: boolean;
  private id: string;

  constructor(opts: RPCOptions) {
    super();
    this.id = opts.nodeId;
    this.channels = new Map();
    this.destroyed = false;
  }

  public async ping(node: Node): Promise<boolean> {
    if (this.destroyed || !node.id) return false;

    const channel = this.getChannel(node);
    console.log(channel);
    if (!channel || channel.readyState !== "open") return false;

    console.log("Sending DHT ping to node " + node.id)
    return new Promise((resolve) => {
      try{
       const pingId = uuid.v4() as string; // Unique ID for this ping
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
      console.log("Error when sending ping: " + error)
    }
    });
  }

  public async sendMessage(
    node: Node,
    sender: string,
    recipient: string,
    message?: MessageDTO | null,
    signalingMessage?: WebSocketMessage
  ): Promise<boolean> {
    if (this.destroyed) return false;
    const channel = this.getChannel(node);
    if (!channel) {
      return false;
    }
    if (message) {
      channel.send(
        JSON.stringify({ type: "message", sender, recipient, message: message } as RPCMessage)
      );
    } else {
      channel.send(
        JSON.stringify({ type: "signaling", sender, recipient, signalingMessage } as RPCMessage)
      );
    }
    return true;
  }

  public closeDataChannel(node: Node): void {
    this.channels.delete(node.id);//todo: close channels and try to reuse them later
  }

  public setUpDataChannel(node: Node, dataChannel: RTCDataChannel) {
    dataChannel.onmessage = (event) => {
      console.log("Recieved Message on DHT datachannel")
      this.handleMessage(event, node);
    }
    dataChannel.onopen = () => {
      this.emit("listening", node);
      console.log("DHT DataChannel opened with " + node.id);
    }
    dataChannel.onerror = (err) => this.emit("warning", err);
    dataChannel.onclose = () => this.channels.delete(node.id);
    this.channels.set(node.id, dataChannel);
  }

  private getChannel(node: Node): RTCDataChannel | null {
    let channel = this.channels.get(node.id);
    if (!channel) {
      console.log("Couldn't retrive datachannel to node " + node.id);
      return null;
    }
    return channel;
  }

  private handleMessage(event: MessageEvent, node: Node): void {
    console.log("Recived message in DHT from " + node.id);
    console.log(event);
    try {
      const message: RPCMessage = JSON.parse(event.data as string);
      if (message.type === 'ping') {
        console.log(this.channels);
        this.emit('ping', node);
        const channel = this.channels.get(node.id);
        console.log(message.id);
        if (channel) {
          channel.send(JSON.stringify({ type: 'pong', sender: this.getId(), id: message.id } as RPCMessage));
        }
      } else if (message.type === 'pong') {
        this.emit('message', message, node);
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
