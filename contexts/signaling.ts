import { RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, RTCDataChannel } from 'react-native-webrtc';
import { Socket } from 'socket.io-client';
import { WebSocketMessage } from '../types/types';

export const handleOffer = async (
  sdp: RTCSessionDescription,
  sender: string,
  createPeerConnection: (peerId: string, channel?: RTCDataChannel | null) => RTCPeerConnection,
  connections: { [key: string]: RTCPeerConnection },
  socket: Socket | null,
  peerId: string,
  signalingChannel?: RTCDataChannel | null
) => {
  const peerConnection = createPeerConnection(sender, signalingChannel);
  connections[sender] = peerConnection;
  await peerConnection.setRemoteDescription(sdp);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  const answerMessage = { target: sender, from: peerId, answer };
  if (signalingChannel) {
    signalingChannel.send(JSON.stringify(answerMessage));
  } else {
    console.log(`Sending answer via WebSocket to ${sender}. Socket connected: ${socket?.connected || false}`);
    socket?.emit('messageOne', answerMessage);
  }
};

export const handleWebRTCSignaling = (
  message: WebSocketMessage,
  connections: { [key: string]: RTCPeerConnection },
  peerId: string,
  createPeerConnection: (peerId: string, channel?: RTCDataChannel | null) => RTCPeerConnection,
  socket: Socket | null,
  signalingChannel?: RTCDataChannel | null
) => {
  if ('offer' in message) {
    console.log("Handling offer");
    console.log(`Websocket: ${socket?.connected || false}`)
    handleOffer(message.offer, message.from, createPeerConnection, connections, socket, peerId, signalingChannel);
  } else if ('answer' in message) {
    console.log("Handling answer");
    const from = message.from;
    if (connections[from]) {
      connections[from].setRemoteDescription(message.answer);
    }
  } else if ('candidate' in message) {
    if (connections[message.from]) {
      connections[message.from]
        .addIceCandidate(new RTCIceCandidate(message.candidate))
        .then(() => console.log('ICE candidate added successfully'))
        .catch((e) => console.error('Error adding ICE candidate:', e));
    }
  }
};