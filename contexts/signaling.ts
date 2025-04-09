import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCDataChannel,
  MessageEvent,
} from "react-native-webrtc";
import { Socket } from "socket.io-client";
import { WebSocketMessage, Peer } from "../types/types";

export const handleOffer = async (
  sdp: RTCSessionDescription,
  sender: string,
  target: string,
  createPeerConnection: (
    peerId: string,
    channel?: RTCDataChannel | null
  ) => RTCPeerConnection,
  socket: Socket | null,
  setPeers: React.Dispatch<React.SetStateAction<Peer[]>>,
  signalingChannel?: RTCDataChannel | null
) => {
  const peerConnection = createPeerConnection(sender, signalingChannel);
  await peerConnection.setRemoteDescription(sdp);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  const answerMessage = { target: sender, from: target, answer };
  if (signalingChannel) {
    signalingChannel.send(JSON.stringify(answerMessage));
  } else {
    console.log(
      `Sending answer via WebSocket to ${sender}. Socket connected: ${
        socket?.connected || false
      }`
    );
    socket?.emit("messageOne", answerMessage);
  }

  setPeers((prev) => {
    if (prev.some((peer) => peer.id === sender)) {
      return prev;
    }
    return [...prev, { id: sender, status: "connecting" }];
  });
};

export const handleWebRTCSignaling = (
  message: WebSocketMessage,
  connections: Map<string, RTCPeerConnection>,
  createPeerConnection: (
    peerId: string,
    channel?: RTCDataChannel | null
  ) => RTCPeerConnection,
  setPeers: React.Dispatch<React.SetStateAction<Peer[]>>,
  socket: Socket | null,
  signalingChannel?: RTCDataChannel | null
) => {
  if ("offer" in message) {
    console.log("Handling offer");
    console.log(`Websocket: ${socket?.connected || false}`);
    handleOffer(
      message.offer,
      message.from,
      message.target,
      createPeerConnection,
      socket,
      setPeers,
      signalingChannel
    );
  } else if ("answer" in message) {
    console.log("Handling answer");
    const from = message.from;
    if (connections && connections.get(from)) {
      connections.get(from)?.setRemoteDescription(message.answer);
    }
  } else if ("candidate" in message) {
    if (connections.get(message.from)) {
      connections.get(message.from)?.addIceCandidate(new RTCIceCandidate(message.candidate))
        .then(() => console.log("ICE candidate added successfully"))
        .catch((e) => console.error("Error adding ICE candidate:", e));
    }
  }
};

export const handleSignalingOverDataChannels = (
  event: MessageEvent,
  peerId: string,
  connections: Map<string, RTCPeerConnection>,
  createPeerConnection: (
    peerId: string,
    channel?: RTCDataChannel | null
  ) => RTCPeerConnection,
  setPeers: React.Dispatch<React.SetStateAction<Peer[]>>,
  signalingDataChannels: Map<string, RTCDataChannel>,
  signalingDataChannel: RTCDataChannel
): void => {
  const message = JSON.parse(event.data) as WebSocketMessage;
  if (message.target === peerId) {
    console.log(
      "Signaling over datachannels reached its destination. Handling request: " +
        JSON.stringify(message)
    );
    handleWebRTCSignaling(
      message,
      connections,
      createPeerConnection,
      setPeers,
      null,
      signalingDataChannel
    );
  } else {
    const targetPeer = Object.keys(connections).find(
      (peerId) => peerId === message.target
    );
    if (targetPeer) {
      console.log(
        "proxying signaling over dataChannels. Sending request to peer: " +
          targetPeer
      );
      const dataChannelToRecipientPeer = signalingDataChannels.get(targetPeer);
      if (dataChannelToRecipientPeer?.readyState === "open") {
        console.log("sending signaling over dataChannels to peer" + targetPeer);
        dataChannelToRecipientPeer.send(JSON.stringify(message));
      } else {
        console.warn("Signaling DataChannel not open to peer: " + targetPeer);
      }
    }
  }
};
