import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCDataChannel,
  MessageEvent,
} from "react-native-webrtc";
import crypto from "react-native-quick-crypto";
import { Socket } from "socket.io-client";
import { WebSocketMessage, Peer, OfferMessage, PeerDTO, Profile, SignalingMessage, AnswerMessage } from "../types/types";
import { fetchUserFromDB, saveUserToDB, updateUser, User } from "./db/userdb";
import { Buffer } from "buffer";
import { signMessage, verifySignature, encodeAndEncryptMessage, decryptAndDecodeMessage } from "./crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface QueuedCandidate {
  candidate: RTCIceCandidateInit;
  timestamp: number;
}

const iceCandidateQueue: Map<string, QueuedCandidate[]> = new Map();
const MAX_PEERS = 500;
const MAX_CANDIDATES_PER_PEER = 30;

const cleanOldCandidates = () => {
  const now = Date.now();
  const maxAge = 5 * 1000; // 5 seconds

  for (const [peerId, queue] of iceCandidateQueue) {
    const filteredQueue = queue.filter(
      candidate => now - candidate.timestamp < maxAge
    );
    if (filteredQueue.length > 0) {
      iceCandidateQueue.set(peerId, filteredQueue);
      console.log(`Cleaned old candidates for peer: ${peerId}, remaining: ${filteredQueue.length}`);
    } else {
      iceCandidateQueue.delete(peerId);
      console.log(`Removed empty queue for peer: ${peerId}`);
    }
  }
};

const removeOldestPeer = () => {
  let oldestPeerId: string | null = null;
  let oldestTimestamp: number = Infinity;

  for (const [peerId, queue] of iceCandidateQueue) {
    if (queue.length > 0) {
      const earliestTimestamp = queue[0].timestamp;
      if (earliestTimestamp < oldestTimestamp) {
        oldestTimestamp = earliestTimestamp;
        oldestPeerId = peerId;
      }
    }
  }

  if (oldestPeerId) {
    iceCandidateQueue.delete(oldestPeerId);
    console.log(`Removed oldest peer: ${oldestPeerId} due to peer limit`);
  }
};

export const handleWebRTCSignaling = async (
  message: WebSocketMessage,
  connections: Map<string, RTCPeerConnection>,
  profile: Profile,
  createPeerConnection: (
    targetPeer: PeerDTO,
    channel?: RTCDataChannel | null
  ) => RTCPeerConnection,
  setPeers: React.Dispatch<React.SetStateAction<Peer[]>>,
  socket: Socket | null,
  signalingChannel?: RTCDataChannel | null
) => {
  console.log('Received signaling message:', message);

  try {
    if ('encryptedOffer' in message) {
      if (connections.get(message.from)) {
        console.log(`Removing peer ${message.from} from connections list - received offer again.`)
        connections.get(message.from)?.close();
        connections.delete(message.from); // reconnecting
      }
      console.log('Handling offer');
      console.log(`WebSocket: ${socket?.connected || false}`);
      await handleOffer(
        message as OfferMessage,
        message.from,
        profile,
        message.publicKey,
        createPeerConnection,
        socket,
        setPeers,
        signalingChannel
      );

      const peerId = message.from;
      const peerConnection = connections.get(peerId);
      if (peerConnection && peerConnection.remoteDescription) {
        cleanOldCandidates();
        const queue = iceCandidateQueue.get(peerId) || [];
        console.log(queue);
        for (const queuedCandidate of queue) {
          try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(queuedCandidate.candidate));
            console.log('Added queued ICE candidate:', queuedCandidate.candidate);
          } catch (error) {
            console.error('Error adding queued ICE candidate:', error);
          }
        }
        iceCandidateQueue.delete(peerId);
        console.log(`Cleared ICE candidate queue for peer: ${peerId}`);
      }
    } else if ('encryptedAnswer' in message) {
      console.log('Handling answer');
      console.log(connections);
      const peerId = message.from;
      const peerConnection = connections.get(peerId);
      if (peerConnection) {
        if (peerConnection.signalingState !== 'have-local-offer') {
          console.warn(`Cannot set answer for peer ${peerId}: signaling state is ${peerConnection.signalingState}, expected have-local-offer`);
          return;
        }
        const decryptedAnswer = await decryptAnswer(message as AnswerMessage);
        console.log('Decrypted answer:', decryptedAnswer.sdp);
        await peerConnection.setRemoteDescription(decryptedAnswer);
        console.log('setRemoteDescription OK');

        if (peerConnection.remoteDescription) {
          cleanOldCandidates();
          const queue = iceCandidateQueue.get(peerId) || [];
          console.log(queue);
          for (const queuedCandidate of queue) {
            try {
              await peerConnection.addIceCandidate(new RTCIceCandidate(queuedCandidate.candidate));
              console.log('Added queued ICE candidate:', queuedCandidate.candidate);
            } catch (error) {
              console.error('Error adding queued ICE candidate:', error);
            }
          }
          iceCandidateQueue.delete(peerId);
          console.log(`Cleared ICE candidate queue for peer: ${peerId}`);
        }
      } else {
        console.warn(`No peer connection found for peer: ${peerId}`);
      }
    } else if ('candidate' in message) {
      const peerId = message.from;
      cleanOldCandidates();

      const peerConnection = connections.get(peerId);
      if (peerConnection) {
        console.log('Handling ICE candidate:', message.candidate);
        if (peerConnection.remoteDescription && peerConnection.iceConnectionState !== 'completed' && peerConnection.iceConnectionState !== 'connected') {
          try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
            console.log('Added ICE candidate:', message.candidate);
          } catch (error) {
            console.error('Error adding ICE candidate:', error);
          }
        } else {
          const queue = iceCandidateQueue.get(peerId) || [];
          if (queue.length >= MAX_CANDIDATES_PER_PEER) {
            queue.shift();
            console.log(`Removed oldest candidate for peer: ${peerId} due to candidate limit`);
          }
          queue.push({ candidate: message.candidate, timestamp: Date.now() });
          iceCandidateQueue.set(peerId, queue);
          console.log(`Queued ICE candidate for peer: ${peerId}`, message.candidate);
        }
      } else {
        if (!iceCandidateQueue.has(peerId) && iceCandidateQueue.size >= MAX_PEERS) {
          removeOldestPeer();
        }
        const queue = iceCandidateQueue.get(peerId) || [];
        if (queue.length >= MAX_CANDIDATES_PER_PEER) {
          queue.shift();
          console.log(`Removed oldest candidate for peer: ${peerId} due to candidate limit`);
        }
        queue.push({ candidate: message.candidate, timestamp: Date.now() });
        iceCandidateQueue.set(peerId, queue);
        console.log(`Queued ICE candidate for peer: ${peerId}`, message.candidate);
      }
    }
  } catch (error) {
    console.error('Error handling WebRTC signaling:', error);
  }
};

export const handleSignalingOverDataChannels = (
  event: MessageEvent,
  profile: Profile,
  connections: Map<string, RTCPeerConnection>,
  createPeerConnection: (
    targetPeer: PeerDTO,
    channel?: RTCDataChannel | null
  ) => RTCPeerConnection,
  setPeers: React.Dispatch<React.SetStateAction<Peer[]>>,
  signalingDataChannels: Map<string, RTCDataChannel>,
  signalingDataChannel: RTCDataChannel
): void => {
  const message = JSON.parse(event.data) as WebSocketMessage;
  if (message.target === profile.peerId) {
    console.log(
      "Signaling over datachannels reached its destination. Handling request: " +
      JSON.stringify(message)
    );
    handleWebRTCSignaling(
      message,
      connections,
      profile,
      createPeerConnection,
      setPeers,
      null,
      signalingDataChannel
    );
  } else {
    const targetPeer = [...connections.keys()].find(
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

export const handleOffer = async (
  message: OfferMessage,
  sender: string,
  target: Profile,
  publicKey: string,
  createPeerConnection: (
    targetPeer: PeerDTO,
    channel?: RTCDataChannel | null
  ) => RTCPeerConnection,
  socket: Socket | null,
  setPeers: React.Dispatch<React.SetStateAction<Peer[]>>,
  signalingChannel?: RTCDataChannel | null
) => {
  console.log("Handling offer")
  console.log(message)
  await verifyPublicKey(sender, publicKey);
  const decryptedOffer = await verifyAndDecryptOffer(message, publicKey)
  const senderPeer: PeerDTO = {
    peerId: sender,
    publicKey: publicKey
  }
  const peerConnection = createPeerConnection(senderPeer, signalingChannel);
  console.log(`Peer connection created ${target.peerId}`);
  console.log(decryptedOffer);
  await peerConnection.setRemoteDescription(decryptedOffer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  sendEncryptedSDP(target, { peerId: sender, publicKey }, answer, socket, signalingChannel)

  setPeers((prev) => {
    if (prev.some((peer) => peer.id === sender)) {
      return prev;
    }
    return [...prev, { id: sender, status: "connecting" }];
  });
};

export const sendEncryptedSDP = async (sender: Profile, targetPeer: PeerDTO, sdp: RTCSessionDescription, socket: Socket | null, signalingChannel?: RTCDataChannel | null): Promise<void> => {
  let signalingMessage: WebSocketMessage;
  if (sdp.type == "offer") {
    verifyPublicKey(targetPeer.peerId, targetPeer.publicKey);
    signalingMessage = await encryptAndSignOffer(sender.peerId, targetPeer.peerId, sdp, targetPeer.publicKey, sender.publicKey);
  } else if (sdp.type == "answer") {
    signalingMessage = await encryptAnswer(sender.peerId, targetPeer.peerId, sdp, sender.publicKey);
  } else {
    throw Error(`Unsupported SDP type: ${sdp.type}`)
  }
  if (signalingChannel == null) {
    socket?.emit('messageOne', signalingMessage);
  } else {
    console.log('Sending sdp through DataChannel');
    signalingChannel.send(JSON.stringify(signalingMessage));
  }
}

const decryptAnswer = async (encryptedRTCSessionDescription: AnswerMessage): Promise<RTCSessionDescription> => {
  let aesKey: string;
  let iv: string;
  console.log(`Handling answer from ${encryptedRTCSessionDescription.from}`)
  const senderUser = await fetchUserFromDB(encryptedRTCSessionDescription.from);
  console.log(senderUser);
  if (senderUser && senderUser.aesKey && senderUser.iv) {
    console.log(senderUser.aesKey)
    aesKey = senderUser.aesKey;
    iv = senderUser.iv;
  } else {
    throw Error("User not found in db");
  }

  const decryptedAnswer = decryptAndDecodeMessage(aesKey, iv, encryptedRTCSessionDescription.authTag, encryptedRTCSessionDescription.encryptedAnswer);

  console.log("here22")
  return new RTCSessionDescription({ sdp: decryptedAnswer, type: "answer" });
};

const encryptAnswer = async (senderId: string, targetId: string, sessionDescription: RTCSessionDescription, senderPublicKey: string): Promise<AnswerMessage> => {
  console.log("sending encrypted answer");
  const user = await fetchUserFromDB(targetId);
  let aesKey: string;
  let iv: string;
  if (user && user.aesKey && user.iv) {
    console.log(user.aesKey);
    aesKey = user.aesKey;
    iv = user.iv;
  } else {
    console.error(`User ${targetId} doesn't exist in the db`);
    throw Error("User doesn't exist in the db");
  }

  var { encryptedMessage, authTag} = encodeAndEncryptMessage(sessionDescription.sdp, aesKey, iv);

  console.log("here31")
  const answer: AnswerMessage = {
    from: senderId,
    target: targetId,
    encryptedAnswer: encryptedMessage,
    authTag,
    public_key: senderPublicKey
  }
  return answer;
}

export const encryptAndSignOffer = async (
  senderId: string,
  targetId: string,
  sessionDescription: RTCSessionDescription,
  targetPublicKey: string,
  senderPublicKey: string
): Promise<OfferMessage> => {
  console.log('here1');
  try {
    let aesKey: string;
    let iv: string;
    let keyId: string;
    const targetUser = await fetchUserFromDB(targetId);
    if (!targetUser || !targetUser.aesKey || !targetUser.iv || !targetUser.keyId) {
      aesKey = crypto.randomBytes(32).toString('base64');
      iv = crypto.randomBytes(12).toString('base64');
      keyId = crypto.randomUUID();

      await createOrUpdateUserWithAESKey(targetUser, targetId, aesKey, iv, keyId, targetPublicKey);
    } else {
      console.log(`User ${targetId} found in the db. AES key: ${targetUser.aesKey}, iv: ${targetUser.iv}, keyId: ${targetUser.keyId}`);
      aesKey = targetUser.aesKey;
      iv = targetUser.iv;
      keyId = targetUser.keyId;
    }

    console.log('AES key:', aesKey);
    const sdp = sessionDescription.sdp;
    var { encryptedMessage, authTag } = encodeAndEncryptMessage(sdp, aesKey, iv);

    const encryptedAesKey = encryptAesKey(targetPublicKey, aesKey);
    const encryptedAesKeySignature = await signMessage(encryptedAesKey);

    const payload: OfferMessage = {
      encryptedOffer: encryptedMessage,
      publicKey: senderPublicKey,
      encryptedAesKey,
      iv,
      authTag,
      from: senderId,
      target: targetId,
      encryptedAesKeySignature,
      keyId,
    };

    return payload;
  } catch (err) {
    console.error('Encryption/Signing failed:', err);
    throw new Error('Failed to encrypt and sign SDP');
  }
};

export const verifyAndDecryptOffer = async (
  encryptedPayload: OfferMessage,
  senderPublicKey: string
): Promise<RTCSessionDescription> => {
  try {
    const { encryptedOffer, encryptedAesKey, authTag, encryptedAesKeySignature, from, iv, keyId } = encryptedPayload;

    let aesKey: string;
    const senderUser = await fetchUserFromDB(from);
    console.log(senderUser?.keyId);
    if (senderUser && senderUser.keyId && senderUser.keyId === keyId && senderUser.aesKey && senderUser.iv) {
      console.log(`Key ID matches for user ${from}. Using stored AES key: ${senderUser.aesKey}`);
      aesKey = senderUser.aesKey;
    } else {
      console.log(`Key ID mismatch or no key for user ${from}. Decrypting AES key.`);

      verifySignature(encryptedAesKey, senderPublicKey, encryptedAesKeySignature);
      aesKey = await decryptAESKey(encryptedAesKey, encryptedAesKey);

      createOrUpdateUserWithAESKey(senderUser, from, aesKey, iv, keyId, senderPublicKey);
    }

    const decodedOffer = decryptAndDecodeMessage(aesKey, iv, authTag, encryptedOffer);
    console.log('Decrypted SDP:', decodedOffer);
    return new RTCSessionDescription({ sdp: decodedOffer, type: 'offer' });
  } catch (err) {
    console.error('Verification/Decryption failed:', err);
    throw new Error('Failed to verify and decrypt SDP');
  }
};

async function createOrUpdateUserWithAESKey(targetUser: User | null, targetId: string, aesKey: string, iv: string, keyId: string, targetPublicKey: string) {
  if (targetUser) {
    await updateUser(targetId, { aesKey, iv, keyId });
    console.log(`User ${targetId} updated with keyId ${keyId}`);
  } else {
    await saveUserToDB({
      peerId: targetId,
      name: null,
      publicKey: targetPublicKey,
      aesKey,
      iv,
      keyId,
    });
    console.log(`User ${targetId} added to db with keyId ${keyId}`);
  }
}

function encryptAesKey(targetPublicKey: string, aesKey: string) {
  return crypto
    .publicEncrypt(
      {
        key: targetPublicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      },
      Buffer.from(aesKey, 'base64')
    )
    .toString('base64');
}

async function decryptAESKey(aesKey: string, encryptedAesKey: string) {
  const privateKey = await AsyncStorage.getItem('privateKey');
  if (!privateKey) {
    console.error('Brak prywatnego klucza. Nie można odszyfrować wiadomości.');
    throw Error("Couldn't load private key.");
  }

  aesKey = crypto
    .privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      },
      Buffer.from(encryptedAesKey, 'base64')
    )
    .toString('base64');
  return aesKey;
}

const verifyPublicKey = async (peerId: string, publicKey: string): Promise<void> => {
  console.log(`Verifying peerId for ${peerId}`);
  const user = await fetchUserFromDB(peerId);
  if (user && user.publicKey) {
    return;
  } else if (createSHA1Hash(publicKey) === peerId) {
    saveUserToDB({ peerId, publicKey, name: null });
  } else {
    throw Error("Public key hash doesn't match peerId value.");
  }
}

const createSHA1Hash = (inputString: string): string => {
  const hash = crypto.createHash('SHA-1')
    .update(inputString)
    .digest('hex');
  return hash;
};