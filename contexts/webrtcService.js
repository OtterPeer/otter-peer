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