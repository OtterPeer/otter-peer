import React, { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';
import {
  RTCPeerConnection,
  RTCDataChannel,
  RTCDataChannelEvent,
  RTCIceCandidateEvent,
  MessageEvent,
  Event
} from 'react-native-webrtc';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendData } from './webrtcService';
import { getSocket, disconnectSocket } from './socket';
import { Socket } from 'socket.io-client';
import uuid from 'react-native-uuid';
import { useRouter, Router } from 'expo-router';
import crypto from 'react-native-quick-crypto';
import { Buffer } from 'buffer';
import { Message, saveMessageToDB } from '../app/chat/chatUtils';
import { WebRTCContextValue, Peer, MessageData, Profile, WebSocketMessage, ProfileMessage, AnswerMessage, PEXMessage, PEXRequest, PEXAdvertisement, ReadyMessage } from '../types/types';
import { handleWebRTCSignaling, handleSignalingOverDataChannels } from './signaling';

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
          handleSignalingOverDataChannels(event, peerIdRef.current!, connections, createPeerConnection,
            setPeers, signalingDataChannelsRef.current, dataChannel);
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
      handleSignalingOverDataChannels(event, peerIdRef.current!, connections, createPeerConnection,
        setPeers, signalingDataChannelsRef.current, signalingDataChannel);
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
          console.log("Original connections:");
          logConnections();
          console.log(`Websocket: ${socket.current?.connected || false}`)
          handleWebRTCSignaling(message, connections, createPeerConnection, setPeers, socket.current);
          console.log("Connections after webrtc handling:")
          logConnections();
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

  const logConnections = () => {
    Object.entries(connections).forEach(([peerId, connection]) => {
      console.log(`Peer ID: ${peerId}`);
      console.log(`  ICE Connection State: ${connection.iceConnectionState}`);
      console.log(`  Signaling State: ${connection.signalingState}`);
      console.log(`  Connection State: ${connection.connectionState}`);
      console.log(`  Local Description: ${connection.localDescription ? connection.localDescription.type : 'Not set'}`);
      console.log(`  Remote Description: ${connection.remoteDescription ? connection.remoteDescription.type : 'Not set'}`);
      console.log('---');
    });
  };

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