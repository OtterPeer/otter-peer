import { io } from 'socket.io-client';

let socket = null;
const connections = {};
const chatDataChannels = new Map();

export const initSocket = (signalingServerURL, token) => {
    socket = io(signalingServerURL, {
        auth: { token },
    });
    return socket;
};

export const getSocket = () => socket;

export const getConnections = () => connections;

export const getChatDataChannels = () => chatDataChannels;

export const createConnection = (peerId) => {
    if (!connections[peerId]) {
        const connection = new RTCPeerConnection();
        connections[peerId] = connection;
    }
    return connections[peerId];
};

export const addChatDataChannel = (peerId, dataChannel) => {
    chatDataChannels.set(peerId, dataChannel);
};

export const getChatDataChannel = (peerId) => chatDataChannels.get(peerId);

export const removeConnection = (peerId) => {
    if (connections[peerId]) {
        connections[peerId].close();
        delete connections[peerId];
    }
    chatDataChannels.delete(peerId);
};

export const sendData = (dataChannel, fileData, chunkSize = 16384) => {
  if (!dataChannel || dataChannel.readyState !== 'open') {
      console.error('Data channel is not open.');
      return;
  }
  const totalSize = fileData.length;
  let offset = 0;
  console.log(`Sending file of size ${totalSize} in chunks of ${chunkSize} bytes.`);
  const sendChunk = () => {
      if (offset < totalSize) {
          const chunk = fileData.slice(offset, offset + chunkSize);
          dataChannel.send(chunk);
          offset += chunkSize;
          setTimeout(sendChunk, 0);
      } else {
          dataChannel.send('EOF');
          console.log('File transfer complete.');
      }
  };
  sendChunk();
}