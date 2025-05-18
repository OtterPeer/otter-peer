import { setupDatabase } from "@/app/chat/chatUtils";
import { LikeMessage } from "@/types/types";
import { MessageEvent, RTCDataChannel } from 'react-native-webrtc';

export const handleLikeMessage = async (
  event: MessageEvent,
  senderPeerId: string,
  likedPeersRef: Set<string>,
  peersReceivedLikeFromRef: { queue: string[]; lookup: Set<string> },
  setMatchesTimestamps: React.Dispatch<React.SetStateAction<Map<string, number>>>,
  setNotifyChat: React.Dispatch<React.SetStateAction<number>>
): Promise<void> => {
  const likeMessage = JSON.parse(event.data) as LikeMessage;
  if (likeMessage.type !== "like" || likeMessage.from !== senderPeerId) {
    console.error(`Invalid like message: ${likeMessage}`);
    return;
  }
  if (likedPeersRef.has(senderPeerId)) {
    await triggerMatch(senderPeerId, setMatchesTimestamps, setNotifyChat);
    likedPeersRef.delete(senderPeerId);
  } else {
    // Add to queue, enforce 5000 peer limit
    if (!peersReceivedLikeFromRef.lookup.has(senderPeerId)) {
      if (peersReceivedLikeFromRef.queue.length >= 5000) {
        const oldestPeer = peersReceivedLikeFromRef.queue.shift();
        if (oldestPeer) {
          peersReceivedLikeFromRef.lookup.delete(oldestPeer);
        }
      }
      peersReceivedLikeFromRef.queue.push(senderPeerId);
      peersReceivedLikeFromRef.lookup.add(senderPeerId);
    }
  }
};

export const sendLikeMessageAndCheckMatch = async (
  targetPeerId: string,
  selfPeerId: string,
  likedPeersRef: Set<string>,
  peersReceivedLikeFromRef: { queue: string[]; lookup: Set<string> },
  likeDataChannelsRef: Map<string, RTCDataChannel>,
  setMatchesTimestamps: React.Dispatch<React.SetStateAction<Map<string, number>>>,
  setNotifyChat: React.Dispatch<React.SetStateAction<number>>
): Promise<void> => {
  const message = {
    type: "like",
    from: selfPeerId
  } as LikeMessage;
  const dataChannel = likeDataChannelsRef.get(targetPeerId);
  if (dataChannel && dataChannel?.readyState === "open") {
    dataChannel.send(JSON.stringify(message));
  } else {
    console.error(`Couldn't find channel to ${targetPeerId} to send like message`);
    throw new Error(`Failed to send like message to peer ${targetPeerId}`)
  }
  if (peersReceivedLikeFromRef.lookup.has(targetPeerId)) {
    triggerMatch(targetPeerId, setMatchesTimestamps, setNotifyChat);
    // Remove from queue and lookup
    peersReceivedLikeFromRef.lookup.delete(targetPeerId);
    const index = peersReceivedLikeFromRef.queue.indexOf(targetPeerId);
    if (index !== -1) {
      peersReceivedLikeFromRef.queue.splice(index, 1);
    }
  } else {
    likedPeersRef.add(targetPeerId);
  }
};

const triggerMatch = async (
  otherPeerId: string,
  setMatchesTimestamps: React.Dispatch<React.SetStateAction<Map<string, number>>>,
  setNotifyChat: React.Dispatch<React.SetStateAction<number>>
): Promise<void> => {
  console.log("Triggering Match");
  setMatchesTimestamps((prev) => {
    return prev.set(otherPeerId, Date.now());
  });
  setNotifyChat((prev) => prev + 1);
  return setupDatabase(otherPeerId);
};