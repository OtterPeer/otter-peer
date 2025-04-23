import { io, Socket } from "socket.io-client";
import { handleWebRTCSignaling } from "./signaling";
import { Peer, WebSocketMessage, ReadyMessage, Profile, PeerDTO } from "../types/types";
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
  profile: Profile,
  connections: Map<string, RTCPeerConnection>,
  initiateConnection: (
    targetPeer: PeerDTO,
    dataChannelUsedForSignaling?: RTCDataChannel | null
  ) => Promise<void>,
  createPeerConnection: (
    targetPeer: PeerDTO,
    signalingDataChannel?: RTCDataChannel | null
  ) => RTCPeerConnection,
  setPeers: React.Dispatch<React.SetStateAction<Peer[]>>
): void => {
  socketRef.on("message", (message: WebSocketMessage) => {
    if (message.target === profile.peerId) {
      if ("payload" in message && "connections" in message.payload) {
        const connectionsPayload: PeerDTO[] = message.payload.connections;
        console.log("Connections");
        console.log(connectionsPayload);

        connectionsPayload.forEach((peer) => {
          const peerId = peer.peerId;
          if (!connections.get(peerId)) {
            console.log(`Initiating connection with ${peerId}`)
            initiateConnection(peer);
          }
        });
      } else {
        handleWebRTCSignaling(
          message,
          connections,
          profile,
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
      peerId: profile.peerId,
      publicKey: profile.publicKey,
      type: "type-emulator",
    };
    socketRef.emit("ready", readyMessage.peerId, readyMessage.type, readyMessage.publicKey);
  });
};

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
