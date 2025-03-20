import React, { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCDataChannel,
  RTCDataChannelEvent,
  RTCIceCandidateEvent,
  MessageEvent,
  Event,
  RTCSessionDescription
} from 'react-native-webrtc';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendData } from './webrtcService';
import { getSocket, disconnectSocket } from './socket';
import { Socket } from 'socket.io-client';
import uuid from 'react-native-uuid';
import { useRouter, Router } from 'expo-router';
import crypto from 'react-native-quick-crypto';
import { Buffer } from 'buffer';
import { Profile } from '../types/profile'
import { Message, saveMessageToDB } from '../app/chat/chatUtils';

interface Peer {
  id: string;
  status: string;
  profile?: Profile;
}

interface MessageData {
  timestamp: number;
  senderId: string;
  message: string;
  id: string;
}

type WebSocketMessageBase = {
  from: string;
  target: string | 'all';
};

type OfferMessage = WebSocketMessageBase & {
  offer: RTCSessionDescription;
};

type AnswerMessage = WebSocketMessageBase & {
  answer: RTCSessionDescription;
};

type CandidateMessage = WebSocketMessageBase & {
  candidate: RTCIceCandidateInit;
};

type ConnectionsMessage = WebSocketMessageBase & {
  payload: {
    connections: { peerId: string }[];
  };
};

type BroadcastMessage = WebSocketMessageBase & {
  target: 'all';
  payload: {
    action: 'close';
  };
};

type WebSocketMessage =
  | OfferMessage
  | AnswerMessage
  | CandidateMessage
  | ConnectionsMessage
  | BroadcastMessage;

type ReadyMessage = {
  peerId: string;
  type: string;
};

type PEXRequest = {
  type: 'request';
  maxNumberOfPeers: number;
};

type PEXAdvertisement = {
  type: 'advertisement';
  peers: string[];
};

type PEXMessage = PEXRequest | PEXAdvertisement;

type ProfileMessage = {
  type: 'profile';
  profile: Profile;
}

interface WebRTCContextValue {
  peers: Peer[];
  setPeers: React.Dispatch<React.SetStateAction<Peer[]>>;
  profile: Profile;
  setProfile: React.Dispatch<React.SetStateAction<any>>;
  peerIdRef: React.MutableRefObject<string | null>;
  socket: Socket | null;
  connections: { [key: string]: RTCPeerConnection };
  chatDataChannels: Map<string, RTCDataChannel>;
  createPeerConnection: (peerId: string, signalingDataChannel?: RTCDataChannel | null) => RTCPeerConnection;
  updatePeerStatus: (peerId: string, status: string) => void;
  updatePeerProfile: (peerId: string, profile: any) => void;
  initiateConnection: (peerId: string, dataChannelUsedForSignaling?: RTCDataChannel | null) => Promise<void>;
  handleOffer: (sdp: any, sender: string, channelUsedForSignaling?: RTCDataChannel | null) => Promise<void>;
  sendMessageChatToPeer: (peerId: string, messageText: string, peerPublicKey: string) => void;
  receiveMessageFromChat: (peerId: string, dataChannel: RTCDataChannel) => Promise<void>;
  disconnectFromWebSocket: () => void;
  chatMessagesRef: React.MutableRefObject<Map<string, MessageData[]>>;
  notifyChat: number;
}

const WebRTCContext = createContext<WebRTCContextValue | undefined>(undefined);

interface WebRTCProviderProps {
  children: ReactNode;
  signalingServerURL: string;
  token: string;
  iceServersList: RTCIceServer[];
}

export const WebRTCProvider: React.FC<WebRTCProviderProps> = ({ children, signalingServerURL, token, iceServersList }) => {
  const [peers, setPeers] = useState<Peer[]>([]);
  const connections: { [key: string]: RTCPeerConnection } = {};
  const [profile, setProfile] = useState<Profile | null>(null);;
  const router: Router = useRouter();
  const socket = useRef<Socket | null>(null);
  const peerIdRef = useRef<string | null>(null);
  const chatDataChannelsRef = useRef<Map<string, RTCDataChannel>>(new Map());
  const signalingDataChannelsRef = useRef<Map<string, RTCDataChannel>>(new Map());
  const chatMessagesRef = useRef<Map<string, MessageData[]>>(new Map());
  const [notifyChat, setNotifyChat] = useState(0);

  const iceServers: RTCIceServer[] = iceServersList;

  const createPeerConnection = (peerId: string, signalingDataChannel: RTCDataChannel | null = null): RTCPeerConnection => {
    const peerConnection = new RTCPeerConnection({ iceServers });

    peerConnection.ondatachannel = (event: RTCDataChannelEvent<'datachannel'>) => {
      const dataChannel: RTCDataChannel = event.channel;
      if (dataChannel.label === 'chat') {
        chatDataChannelsRef.current.set(peerId, dataChannel);
        receiveMessageFromChat(peerId, dataChannel);
      } else if (dataChannel.label === 'profile') {
        dataChannel.onopen = async () => {
          updatePeerStatus(peerId, 'open (answer side)');
          const storedProfile = await AsyncStorage.getItem('userProfile');
          const profile = storedProfile ? JSON.parse(storedProfile) : null;
          try {
            if (profile !== null) {
              console.log('Sending profile from offer side...');
              const profileMessage: ProfileMessage = {
                profile: profile as Profile,
                type: 'profile'
              }
              sendData(dataChannel, JSON.stringify(profileMessage));
            }
          } catch (error) {
            console.error('Error while sending profile:', error);
          }
        };

        dataChannel.onclose = (event: Event) => {
          updatePeerStatus(peerId, 'closed');
          console.log('answer side received close event: ' + event);
        };

        let receivedChunks: string[] = [];
        dataChannel.onmessage = (event: MessageEvent) => {
          if (event.data === 'EOF') {
            const message = JSON.parse(receivedChunks.join('')) as ProfileMessage;
            updatePeerProfile(peerId, message.profile);
            receivedChunks = [];
          } else {
            receivedChunks.push(event.data);
          }
        };

        const originalClose = dataChannel.close.bind(dataChannel);
        dataChannel.close = () => {
          dataChannel.onopen = undefined;
          dataChannel.onclose = undefined;
          dataChannel.onmessage = undefined;
          originalClose();
        };
      } else if (dataChannel.label === 'pex') {
        dataChannel.onopen = async () => {
          console.log('PEX datachannel opened');
          await delay(3000);
          sendPEXRequest(dataChannel);
        };

        dataChannel.onmessage = (event: MessageEvent) => {
          console.log('Received pex message');
          handlePEXMessages(event, dataChannel, signalingDataChannelsRef.current.get(peerId));
        };

        const originalClose = dataChannel.close.bind(dataChannel);
        dataChannel.close = () => {
          dataChannel.onopen = undefined;
          dataChannel.onclose = undefined;
          dataChannel.onmessage = undefined;
          originalClose();
        };
      } else if (dataChannel.label === 'signaling') {
        dataChannel.onopen = () => {
          console.log('Signaling channel opened with peer: ' + peerId);
          signalingDataChannelsRef.current.set(peerId, dataChannel);
        };

        dataChannel.onmessage = async (event: MessageEvent) => {
          console.log('received message on signalingDataChannel - answer side' + event);
          handleSignalingOverDataChannels(event, dataChannel);
        };

        const originalClose = dataChannel.close.bind(dataChannel);
        dataChannel.close = () => {
          dataChannel.onopen = undefined;
          dataChannel.onclose = undefined;
          dataChannel.onmessage = undefined;
          originalClose();
        };
      }
    };

    peerConnection.onicecandidate = (event: RTCIceCandidateEvent<'icecandidate'>) => {
      if (event.candidate) {
        if (signalingDataChannel == null) {
          console.log('Sending ice candidates');
          socket.current?.emit('messageOne', {
            target: peerId,
            from: peerIdRef.current,
            candidate: event.candidate,
          });
        } else {
          console.log('Sending ice candidates through DataChannel');
          signalingDataChannel.send(
            JSON.stringify({ target: peerId, from: peerIdRef.current, candidate: event.candidate })
          );
        }
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log(`ICE connection state: ${peerConnection.iceConnectionState}`);
    };

    const originalClose = peerConnection.close.bind(peerConnection);
    peerConnection.close = () => {
      peerConnection.ondatachannel = undefined;
      peerConnection.onicecandidate = undefined;
      peerConnection.oniceconnectionstatechange = undefined;
      originalClose();
    };  

    return peerConnection;
  };

  const initiateConnection = async (peerId: string, dataChannelUsedForSignaling: RTCDataChannel | null = null): Promise<void> => {
    const peerConnection = createPeerConnection(peerId, dataChannelUsedForSignaling);
    connections[peerId] = peerConnection;

    const chatDataChannel = peerConnection.createDataChannel('chat');
    chatDataChannelsRef.current.set(peerId, chatDataChannel);
    receiveMessageFromChat(peerId, chatDataChannel);

    const signalingDataChannel = peerConnection.createDataChannel('signaling');
    signalingDataChannel.onopen = () => {
      signalingDataChannelsRef.current.set(peerId, signalingDataChannel);
    };
    signalingDataChannel.onmessage = async (event: MessageEvent) => {
      console.log('received message on signalingDataChannel - offer side' + event);
      handleSignalingOverDataChannels(event, signalingDataChannel);
    };

    const pexDataChannel = peerConnection.createDataChannel('pex');
    pexDataChannel.onopen = async () => {
      await delay(3000);
      sendPEXRequest(pexDataChannel);
    };
    pexDataChannel.onmessage = async (event: MessageEvent) => {
      handlePEXMessages(event, pexDataChannel, signalingDataChannelsRef.current.get(peerId));
    };

    const profileDataChannel = peerConnection.createDataChannel('profile');
    profileDataChannel.onopen = async () => {
      updatePeerStatus(peerId, 'open (offer side)');
      await shareProfile(sendData, profileDataChannel);
    };
    profileDataChannel.onclose = (event: Event) => {
      console.log('offer side received close event: ' + event);
      updatePeerStatus(peerId, 'closed');
      chatDataChannelsRef.current.delete(peerId);
    };
    let receivedChunks: string[] = [];
    profileDataChannel.onmessage = (event: MessageEvent) => {
      if (event.data === 'EOF') {
        console.log('File received successfully');
        const message = JSON.parse(receivedChunks.join(''));
        updatePeerProfile(peerId, message.profile);
        receivedChunks = [];
      } else {
        receivedChunks.push(event.data);
      }
    };

    const offer = await peerConnection.createOffer(null);
    await peerConnection.setLocalDescription(offer);

    if (dataChannelUsedForSignaling == null) {
      socket.current?.emit('messageOne', { target: peerId, from: peerIdRef.current, offer });
    } else {
      console.log('Sending offer through DataChannel');
      dataChannelUsedForSignaling.send(JSON.stringify({ target: peerId, from: peerIdRef.current, offer }));
    }

    setPeers((prev) => {
      if (prev.some((peer) => peer.id === peerId)) {
        return prev;
      }
      return [...prev, { id: peerId, status: 'connecting' }];
    });
  };

  const handleSignalingOverDataChannels = (event: MessageEvent, signalingDataChannel: RTCDataChannel): void => {
    const message = JSON.parse(event.data) as WebSocketMessage;
    if (message.target === peerIdRef.current) {
      console.log('Signaling over datachannels reached its destination. Handling request: ' + JSON.stringify(message));
      handleWebRTCSignaling(message, signalingDataChannel);
    } else {
      const targetPeer = Object.keys(connections).find((peerId) => peerId === message.target);
      if (targetPeer) {
        console.log('proxying signaling over dataChannels. Sending request to peer: ' + targetPeer);
        const dataChannelToRecipientPeer = signalingDataChannelsRef.current.get(targetPeer);
        if (dataChannelToRecipientPeer?.readyState === 'open') {
          console.log('sending signaling over dataChannels to peer' + targetPeer);
          dataChannelToRecipientPeer.send(JSON.stringify(message));
        } else {
          console.warn('Signaling DataChannel not open to peer: ' + targetPeer);
        }
      }
    }
  };

  const handleWebRTCSignaling = (message: WebSocketMessage, dataChannelForSignaling: RTCDataChannel | null = null): void => {
    if ('offer' in message) {
      const offer = message.offer;
      const from = message.from;
      handleOffer(offer, from, dataChannelForSignaling);
    } else if ('answer' in message) {
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

  const handleOffer = async (sdp: RTCSessionDescription, sender: string, channelUsedForSignaling: RTCDataChannel | null = null): Promise<void> => {
    const peerConnection = createPeerConnection(sender, channelUsedForSignaling);
    connections[sender] = peerConnection;
    await peerConnection.setRemoteDescription(sdp);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    const answerMessage: AnswerMessage = {
      target: sender,
      from: peerIdRef.current!,
      answer: answer,
    };

    if (channelUsedForSignaling == null) {
      socket.current?.emit('messageOne', answerMessage);
    } else {
      console.log('Sending answer using signaling over datachannels to peer: ' + sender);
      channelUsedForSignaling.send(JSON.stringify(answerMessage));
    }

    setPeers((prev) => {
      if (prev.some((peer) => peer.id === sender)) {
        return prev;
      }
      return [...prev, { id: sender, status: 'connecting' }];
    });
  };

  const handlePEXMessages = (event: MessageEvent, pexDataChannel: RTCDataChannel, signalingDataChannel?: RTCDataChannel): void => {
    try {
      const message = JSON.parse(event.data) as PEXMessage;
      if (message.type === 'request') {
        shareConnectedPeers(pexDataChannel, message);
      } else if (message.type === 'advertisement') {
        const receivedPeers: string[] = message.peers;
        const tableOfPeers: string[] = [];

        if (Array.isArray(receivedPeers)) {
          receivedPeers.forEach((peerId) => {
            const alreadyConnected = Object.keys(connections).some((id) => id === peerId);
            if (!tableOfPeers.includes(peerId) && !alreadyConnected && peerId !== peerIdRef.current) {
              tableOfPeers.push(peerId);
            }
          });
        }

        tableOfPeers.forEach((peerId) => {
          initiateConnection(peerId, signalingDataChannel);
        });
      }
    } catch (error) {
      console.error('Error handling PEX request:', error);
    }
  };

  const sendPEXRequest = (pexDataChannel: RTCDataChannel): void => {
    console.log('Sending PEX request');
    const requestMessage: PEXRequest = {
      type: 'request',
      maxNumberOfPeers: 20,
    };

    try {
      pexDataChannel.send(JSON.stringify(requestMessage));
    } catch (error) {
      console.log('Couldn’t send pex request: ' + error);
    }
  };

  const shareConnectedPeers = (pexDataChannel: RTCDataChannel, message: PEXRequest): void => {
    // TODO: read requested number of peers from PEXRequest
    const peersToShare = new Set<string>();
    if (Object.keys(connections).length !== 0) {
      Object.keys(connections).forEach((peerId) => {
        peersToShare.add(peerId);
      });
    }

    const answer: PEXAdvertisement = {
      type: 'advertisement',
      peers: Array.from(peersToShare),
    };
    pexDataChannel.send(JSON.stringify(answer));
  };

  const sendMessageChatToPeer = (peerId: string, messageText: string, peerPublicKey: string): void => {
    const dataChannel = chatDataChannelsRef.current.get(peerId);
  
    if (!peerPublicKey) {
      console.error(`❌ Nie można pobrać klucza publicznego.`);
      return;
    }
    if (!peerIdRef.current) {
      console.error('Cannot send message: peerIdRef.current is null');
      return;
    }

    const messageData: Message = {
      id: uuid.v4(),
      timestamp: Date.now(),
      senderId: peerIdRef.current ?? "",
      destinationId: peerId,
      message: messageText,
    };
  
    if (dataChannel?.readyState === 'open') {
      saveMessageToDB(messageData, messageData.destinationId); // Save the original unencrypted messageData to DB
  
      // Encrypt only the message field
      const encryptedMessage = crypto.publicEncrypt(
        peerPublicKey,
        Buffer.from(messageData.message)
      ).toString("base64");
  
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
      console.log(`Message sent to peer ${peerId}:`, dataToSend);
    } else {
      console.log(`Data channel for peer ${peerId} is not ready`);
    }
  };

  const receiveMessageFromChat = async (peerId: string, dataChannel: RTCDataChannel): Promise<void> => {

    const privateKey = await AsyncStorage.getItem("privateKey");
    if (!privateKey) {
      console.error("❌ Brak prywatnego klucza. Nie można odszyfrować wiadomości.");
      return;
    }
  
    dataChannel.onmessage = async (event: MessageEvent) => {
      try {
        // Parse the received JSON data
        const receivedData = JSON.parse(event.data);
        console.log("Got raw received data:", receivedData);
  
        // Decrypt only the message field
        const decryptedMessage = crypto.privateDecrypt(
          privateKey,
          Buffer.from(receivedData.message, "base64")
        ).toString();
  
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
  
        // Update chat messages in memory
        const currentMessages = chatMessagesRef.current.get(peerId) || [];
        const updatedMessages = [...currentMessages, decryptedMessageData];
        chatMessagesRef.current.set(peerId, updatedMessages);
  
        setNotifyChat((prev) => prev + 1); // Trigger UI update
      } catch (error) {
        console.error("Error decrypting or processing message:", error);
      }
    };
  };

  const updatePeerStatus = (peerId: string, status: string): void => {
    setPeers((prev) => prev.map((peer) => (peer.id === peerId ? { ...peer, status } : peer)));
  };

  const updatePeerProfile = (peerId: string, profile: any): void => {
    setPeers((prevPeers) => prevPeers.map((peer) => (peer.id === peerId ? { ...peer, profile } : peer)));
  };

  useEffect(() => {
    // AsyncStorage.removeItem("userProfile");
    const fetchProfile = async () => {
      try {
        const storedProfile = await AsyncStorage.getItem('userProfile');
        if (storedProfile) {
          const parsedProfile: Profile = JSON.parse(storedProfile);
          setProfile(parsedProfile);
        } else {
          router.push('../profile');
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    socket.current = getSocket(signalingServerURL, token);

    socket.current.on('message', (message: WebSocketMessage) => {
      if (message.target === peerIdRef.current) {
        if ('payload' in message && 'connections' in message.payload) {
          const connectionsPayload: { peerId: string }[] = message.payload.connections;
          connectionsPayload.forEach((peer) => {
            const peerId = peer.peerId;
            if (!connections[peerId]) {
              initiateConnection(peerId);
            }
          });
        } else {
          handleWebRTCSignaling(message);
        }
      } else if (message.target === 'all') {
        if ('payload' in message && 'action' in message.payload && message.payload.action === 'close') {
          console.log(`Peer disconnected from signaling server: ${message.from}`);
        }
      }
    });

    socket.current.on('connect', () => {
      console.log('Connected to signaling server. SocketId: ' + socket.current!.id);
      const generatedPeerId = uuid.v4() as string;
      peerIdRef.current = generatedPeerId;
      const readyMessage: ReadyMessage = {
        peerId: generatedPeerId,
        type: 'type-emulator',
      };
      socket.current!.emit('ready', readyMessage.peerId, readyMessage.type);
    });

    return () => {
      socket.current?.disconnect();
      Object.values(connections).forEach((pc) => pc.close());
    };
  }, [signalingServerURL, token]);

  async function shareProfile(sendFile: typeof sendData, dataChannel: RTCDataChannel): Promise<void> {
    const storedProfile = await AsyncStorage.getItem('userProfile');
    const profile = storedProfile ? JSON.parse(storedProfile) : null;
    try {
      if (profile !== null) {
        console.log('Sending profile from offer side...');
        sendFile(dataChannel, JSON.stringify({ type: 'profile', profile }));
      }
    } catch (error) {
      console.error('Error while sending profile:', error);
    }
  }

  const disconnectFromWebSocket = (): void => {
    console.log('Disconnecting from signaling server. ' + socket.current?.id);
    disconnectSocket();
  };

  const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

  // Only provide context when profile is loaded
  if (!profile) {
    return null;
  }

  const value: WebRTCContextValue = {
    peers,
    setPeers,
    profile,
    setProfile,
    peerIdRef,
    socket: socket.current,
    connections,
    chatDataChannels: chatDataChannelsRef.current,
    createPeerConnection,
    updatePeerStatus,
    updatePeerProfile,
    initiateConnection,
    handleOffer,
    sendMessageChatToPeer,
    receiveMessageFromChat,
    disconnectFromWebSocket,
    chatMessagesRef,
    notifyChat
  };

  return <WebRTCContext.Provider value={value}>{children}</WebRTCContext.Provider>;
};

export const useWebRTC = (): WebRTCContextValue => {
  const context = useContext(WebRTCContext);
  if (context === undefined) {
    throw new Error('useWebRTC must be used within a WebRTCProvider');
  }
  return context;
};