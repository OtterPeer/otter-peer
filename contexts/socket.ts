import { io, Socket } from "socket.io-client";
import { handleWebRTCSignaling } from "./signaling";
import { Peer, WebSocketMessage, ReadyMessage, Profile, PeerDTO } from "../types/types";
import { RTCPeerConnection, RTCDataChannel } from "react-native-webrtc";
import { calculateAge } from "./utils/user-utils";

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
        console.log(connections);
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
    console.log("here101")
    console.log(profile)
    let age = 0;
    try {
      age = calculateAge(profile.birthDay!, profile.birthMonth!, profile.birthYear!);
    } catch(err) {
      console.log(err);
    }

    console.log(age);
    const readyMessage: ReadyMessage = {
      peerDto: { peerId: profile.peerId, publicKey: profile.publicKey, x: profile.x, y: profile.y, sex: profile.sex, searching: profile.searching, age: age },
      type: "type-emulator",
    };
    console.log(readyMessage)
    socketRef.emit("ready", readyMessage);
  });
};

export const disconnectSocket = (): void => {
  console.log("Disconnect triggered")
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
