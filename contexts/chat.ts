import { RTCDataChannel, MessageEvent } from "react-native-webrtc";
import AsyncStorage from "@react-native-async-storage/async-storage";
import uuid from "react-native-uuid";
import crypto from "react-native-quick-crypto";
import { Buffer } from "buffer";
import { Message, saveMessageToDB, setupDatabase } from "../app/chat/chatUtils";

export const sendChatMessage = (
  targetPeerId: string,
  senderPeerId: string,
  messageText: string,
  peerPublicKey: string,
  chatDataChannels: Map<string, RTCDataChannel>
): void => {
  const dataChannel = chatDataChannels.get(targetPeerId);

  if (!peerPublicKey) {
    console.error(`❌ Nie można pobrać klucza publicznego.`);
    return;
  }
  if (!senderPeerId) {
    console.error("Cannot send message: peerIdRef.current is null");
    return;
  }

  const messageData: Message = {
    id: uuid.v4(),
    timestamp: Date.now(),
    senderId: senderPeerId ?? "",
    destinationId: targetPeerId,
    message: messageText,
  };

  if (dataChannel?.readyState === "open") {
    saveMessageToDB(messageData, messageData.destinationId); // Save the original unencrypted messageData to DB

    // Encrypt only the message field
    const encryptedMessage = crypto
      .publicEncrypt(peerPublicKey, Buffer.from(messageData.message))
      .toString("base64");

    // Construct a new object with the encrypted message and unencrypted fields
    const dataToSend = {
      id: messageData.id,
      timestamp: messageData.timestamp,
      senderId: messageData.senderId,
      destinationId: messageData.destinationId,
      message: encryptedMessage, // Only the message is encrypted
    };

    // Send the JSON stringified object
    dataChannel.send(JSON.stringify(dataToSend));
    console.log(`Message sent to peer ${targetPeerId}:`, dataToSend);
  } else {
    console.log(`Data channel for peer ${targetPeerId} is not ready`);
  }
};

export const receiveMessageFromChat = async (
  dataChannel: RTCDataChannel,
  setNotifyChat: React.Dispatch<React.SetStateAction<number>>
): Promise<void> => {
  const privateKey = await AsyncStorage.getItem("privateKey");
  if (!privateKey) {
    console.error(
      "❌ Brak prywatnego klucza. Nie można odszyfrować wiadomości."
    );
    return;
  }

  dataChannel.onmessage = async (event: MessageEvent) => {
    try {
      // Parse the received JSON data
      const receivedData = JSON.parse(event.data);
      console.log("Got raw received data:", receivedData);

      // Decrypt only the message field
      const decryptedMessage = crypto
        .privateDecrypt(privateKey, Buffer.from(receivedData.message, "base64"))
        .toString();

      // Construct the decrypted messageData with the original fields
      const decryptedMessageData = {
        id: receivedData.id,
        timestamp: receivedData.timestamp,
        senderId: receivedData.senderId,
        destinationId: receivedData.destinationId,
        message: decryptedMessage,
      };

      console.log("Got decrypted messageData:", decryptedMessageData);

      saveMessageToDB(decryptedMessageData, decryptedMessageData.senderId);

      setNotifyChat((prev) => prev + 1); // Trigger UI update
    } catch (error) {
      console.error("Error decrypting or processing message:", error);
    }
  };
};

export const initiateDBTable = async (
  peerId: string,
  dataChannel: RTCDataChannel
) => {
  dataChannel.onopen = () => {
    setupDatabase(peerId);
  };
};
