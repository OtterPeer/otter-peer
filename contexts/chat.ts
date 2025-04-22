import { RTCDataChannel, MessageEvent } from "react-native-webrtc";
import AsyncStorage from "@react-native-async-storage/async-storage";
import uuid from "react-native-uuid";
import crypto from "react-native-quick-crypto";
import { Buffer } from "buffer";
import { Message, MessageDTO, saveMessageToLocalDB, setupDatabase } from "../app/chat/chatUtils";
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

  const encryptedMessage = crypto
      .publicEncrypt(peerPublicKey, Buffer.from(messageText))
      .toString("base64");

  const message: Message = {
    id: uuid.v4() as string,
    message: messageText,
    timestamp: Date.now(),
    sendByMe: true,
  }

  await saveMessageToLocalDB(message, targetPeerId);

  const messageDTO: MessageDTO = {
    id: message.id,
    timestamp: message.timestamp,
    senderId: senderPeerId,
    encryptedMessage: encryptedMessage
  };

  if (dataChannel && dataChannel?.readyState === "open") {
    console.log(dataChannel)
    dataChannel.send(JSON.stringify(messageDTO));//TODO: await for "ACK" as close event can be sent with delay
    console.log(`Message sent to peer ${targetPeerId}:`, messageDTO);
  } else {
    console.log(`Data channel for peer ${targetPeerId} is not ready`);
    console.log(`Sending message through DHT.`);
    dht.sendMessage(targetPeerId, messageDTO)
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

  dht.on("chatMessage", (recivedData: MessageDTO) => {
    console.log("In receiveMessageFromChat - chatMessage was emmited");
    console.log("Recieved message on DHT");
    handleMessage(recivedData, privateKey, setNotifyChat);
  })

  dataChannel.onmessage = async (event: MessageEvent) => {
    const receivedData: MessageDTO = JSON.parse(event.data);
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

function handleMessage(receivedData: MessageDTO, privateKey: string, setNotifyChat: React.Dispatch<React.SetStateAction<number>>) {
  try {
    const decryptedMessageData = decryptMessage(receivedData, privateKey);

    console.log("Got decrypted messageData:", decryptedMessageData);

    saveMessageToLocalDB(decryptedMessageData, receivedData.senderId);

    setNotifyChat((prev) => prev + 1); // Trigger UI update
  } catch (error) {
    console.error("Error decrypting or processing message:", error);
  }
}

function decryptMessage(receivedData: MessageDTO, privateKey: string): Message {
  console.log("Got raw received data:", receivedData);

  const decryptedMessage = crypto
    .privateDecrypt(privateKey, Buffer.from(receivedData.encryptedMessage, "base64"))
    .toString();

  const decryptedMessageData: Message = {
    id: receivedData.id,
    timestamp: receivedData.timestamp,
    sendByMe: false,
    message: decryptedMessage,
  };
  return decryptedMessageData;
}

