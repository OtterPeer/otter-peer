import { RTCDataChannel, MessageEvent } from "react-native-webrtc";
import AsyncStorage from "@react-native-async-storage/async-storage";
import uuid from "react-native-uuid";
import crypto from "react-native-quick-crypto";
import { Buffer } from "buffer";
import { Message, saveMessageToDB, setupDatabase } from "../app/chat/chatUtils";
import DHT from "./dht/dht";

export const sendChatMessage = async (
  targetPeerId: string,
  senderPeerId: string,
  messageText: string,
  peerPublicKey: string,
  chatDataChannels: Map<string, RTCDataChannel>,
  dht: DHT
): Promise<void> => {
  const dataChannel = chatDataChannels.get(targetPeerId);

  if (!peerPublicKey) {
    console.error(`Nie można pobrać klucza publicznego.`);
    return;
  }
  if (!senderPeerId) {
    console.error("Cannot send message: peerIdRef.current is null");
    return;
  }

  const messageData: Message = { // TODO: Don't reuse DAO model, create new DTO class instead
    id: uuid.v4(),
    timestamp: Date.now(),
    senderId: senderPeerId ?? "",
    destinationId: targetPeerId,
    message: messageText,
  };

  await saveMessageToDB(messageData, messageData.destinationId);

  const encryptedMessage = crypto
      .publicEncrypt(peerPublicKey, Buffer.from(messageText))
      .toString("base64");

  messageData.message = encryptedMessage; // Only message is encrypted

  if (dataChannel?.readyState === "open") {
    dataChannel.send(JSON.stringify(messageData));
    console.log(`Message sent to peer ${targetPeerId}:`, messageData);
  } else {
    console.log(`Data channel for peer ${targetPeerId} is not ready`);
    console.log(`Sending message through DHT.`);
    dht.sendMessage(messageData.destinationId, messageData)
  }
};

export const receiveMessageFromChat = async (
  dataChannel: RTCDataChannel,
  dht: DHT,
  setNotifyChat: React.Dispatch<React.SetStateAction<number>>
): Promise<void> => {
  const privateKey = await AsyncStorage.getItem("privateKey");
  if (!privateKey) {
    console.error("Brak prywatnego klucza. Nie można odszyfrować wiadomości.");
    return;
  }

  dht.on("chatMessage", (recivedData: Message) => {
    console.log("In receiveMessageFromChat - chatMessage was emmited");
    console.log("Recieved message on DHT");
    handleMessage(recivedData, privateKey, setNotifyChat);
  })

  dataChannel.onmessage = async (event: MessageEvent) => {
    const receivedData: Message = JSON.parse(event.data);
    handleMessage(receivedData, privateKey, setNotifyChat);
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

function handleMessage(receivedData: Message, privateKey: string, setNotifyChat: React.Dispatch<React.SetStateAction<number>>) {
  try {
    const decryptedMessageData = decryptMessage(receivedData, privateKey);

    console.log("Got decrypted messageData:", decryptedMessageData);

    saveMessageToDB(decryptedMessageData, decryptedMessageData.senderId);

    setNotifyChat((prev) => prev + 1); // Trigger UI update
  } catch (error) {
    console.error("Error decrypting or processing message:", error);
  }
}

function decryptMessage(receivedData: Message, privateKey: string) {
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
  return decryptedMessageData;
}

