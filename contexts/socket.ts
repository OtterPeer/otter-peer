import { io, Socket } from "socket.io-client";
import { handleWebRTCSignaling } from "./signaling";
import { Peer, WebSocketMessage, ReadyMessage } from "../types/types";
import { RTCPeerConnection, RTCDataChannel } from "react-native-webrtc";

let socket: Socket | null = null;

export const getSocket = (
  signalingServerURL: string,
  token: string
): Socket => {
  if (!socket) {
    socket = io(signalingServerURL, {
      auth: { token },
    });
  }
  return socket;
};

export const handleWebSocketMessages = (
  socketRef: Socket,
  userPeerId: string,
  connections: { [key: string]: RTCPeerConnection },
  initiateConnection: (
    peerId: string,
    dataChannelUsedForSignaling?: RTCDataChannel | null
  ) => Promise<void>,
  createPeerConnection: (
    peerId: string,
    signalingDataChannel?: RTCDataChannel | null
  ) => RTCPeerConnection,
  setPeers: React.Dispatch<React.SetStateAction<Peer[]>>
): void => {
  socketRef.on("message", (message: WebSocketMessage) => {
    if (message.target === userPeerId) {
      if ("payload" in message && "connections" in message.payload) {
        const connectionsPayload: { peerId: string }[] =
          message.payload.connections;
        connectionsPayload.forEach((peer) => {
          const peerId = peer.peerId;
          if (!connections[peerId]) {
            initiateConnection(peerId);
          }
        });
      } else {
        handleWebRTCSignaling(
          message,
          connections,
          createPeerConnection,
          setPeers,
          socketRef
        );
      }
    } else if (message.target === "all") {
      if (
        "payload" in message &&
        "action" in message.payload &&
        message.payload.action === "close"
      ) {
        console.log(`Peer disconnected from signaling server: ${message.from}`);
      }
    }
  });

  socketRef.on("connect", () => {
    const readyMessage: ReadyMessage = {
      peerId: userPeerId,
      type: "type-emulator",
    };
    socketRef.emit("ready", readyMessage.peerId, readyMessage.type);
  });
};

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
