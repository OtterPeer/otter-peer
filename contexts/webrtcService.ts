import { RTCDataChannel, Event } from 'react-native-webrtc';

export const sendData = (
  dataChannel: RTCDataChannel,
  fileData: string, // | ArrayBuffer TODO(?): send images as ArrayBuffer and use RTCDataChannel.bufferedAmount
  chunkSize: number = 16384
): void => {
    if (!dataChannel || dataChannel.readyState !== 'open') {
      console.error('Data channel is not open.');
      return;
    }

    let totalSize: number = fileData.length;
    let offset: number = 0;
  
    console.log(`Sending file of size ${totalSize} in chunks of ${chunkSize} bytes.`);
  
    const sendChunk = () => {
      if (offset < totalSize) {
        let chunk: string
        chunk = fileData.slice(offset, offset + chunkSize);
        dataChannel.send(chunk);
        offset += chunkSize;
        setTimeout(sendChunk, 0);
      } else {
        dataChannel.send('EOF');
        console.log('File transfer complete.');
      }
    };
  
    sendChunk();
  };