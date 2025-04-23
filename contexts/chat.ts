import { RTCDataChannel, MessageEvent } from "react-native-webrtc";
import uuid from "react-native-uuid";
import { Message, MessageDTO, saveMessageToLocalDB, setupDatabase } from "../app/chat/chatUtils";
import DHT from "./dht/dht";
import { decryptAndDecodeMessage, encodeAndEncryptMessage } from "./crypto";
import { fetchUserFromDB } from "./db/userdb";

export const sendChatMessage = async (
  targetPeerId: string,
  senderPeerId: string,
  messageText: string,
  chatDataChannels: Map<string, RTCDataChannel>,
  dht: DHT
): Promise<void> => {
  const dataChannel = chatDataChannels.get(targetPeerId);

  if (!senderPeerId) {
    console.error("Cannot send message: peerIdRef.current is null");
    return;
  }

  console.log(messageText)
  let { aesKey, iv } = await getAESKey(targetPeerId);
  console.log(aesKey);
  const encryptedMessage = encodeAndEncryptMessage(messageText, aesKey, iv);

  console.log(encryptedMessage);
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
    encryptedMessage: encryptedMessage.encryptedMessage,
    authTag: encryptedMessage.authTag
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
  return;
};

export const receiveMessageFromChat = async (
  dataChannel: RTCDataChannel,
  dht: DHT,
  setNotifyChat: React.Dispatch<React.SetStateAction<number>>
): Promise<void> => {
  dht.on("chatMessage", (recivedData: MessageDTO) => {
    console.log("In receiveMessageFromChat - chatMessage was emmited");
    console.log("Recieved message on DHT");
    handleMessage(recivedData, setNotifyChat);
  })

  dataChannel.onmessage = async (event: MessageEvent) => {
    const receivedData: MessageDTO = JSON.parse(event.data);
    handleMessage(receivedData, setNotifyChat);
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

async function getAESKey(peerId: string): Promise<{aesKey: string, iv: string}> {
  let aesKey, iv;
  const otherPeer = await fetchUserFromDB(peerId);
  console.log(otherPeer)
  if (otherPeer && otherPeer.aesKey && otherPeer.iv) {
    aesKey = otherPeer.aesKey;
    iv = otherPeer.iv;
  } else {
    console.error(`${peerId} not found in DB`)
    throw Error("Target user not found in db or AES key is missing");
  }
  console.log(aesKey);
  return { aesKey, iv };
}

async function handleMessage(receivedData: MessageDTO, setNotifyChat: React.Dispatch<React.SetStateAction<number>>) {
  try {
    const decryptedMessageData = await decryptMessage(receivedData);
    console.log("Got decrypted messageData:", decryptedMessageData);

    saveMessageToLocalDB(decryptedMessageData, receivedData.senderId);

    setNotifyChat((prev) => prev + 1); // Trigger UI update
  } catch (error) {
    console.error("Error decrypting or processing message:", error);
  }
}

async function decryptMessage(receivedData: MessageDTO): Promise<Message> {
  console.log("Got raw received data:", receivedData);

  let {aesKey, iv} = await getAESKey(receivedData.senderId);
  const decryptedMessage = decryptAndDecodeMessage(aesKey, iv, receivedData.authTag, receivedData.encryptedMessage);

  const decryptedMessageData: Message = {
    id: receivedData.id,
    timestamp: receivedData.timestamp,
    sendByMe: false,
    message: decryptedMessage,
  };
  return decryptedMessageData;
}

