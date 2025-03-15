import React, { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCDataChannel,
  RTCDataChannelEvent,
  RTCIceCandidateEvent,
  MessageEvent,
  Event
} from 'react-native-webrtc';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendData } from './webrtcService'; // Assuming this is typed in .ts
import { getSocket, disconnectSocket } from './socket'; // Assuming this is typed
import { Socket } from 'socket.io-client';
import uuid from 'react-native-uuid';
import { useRouter, Router } from 'expo-router';
import crypto from 'react-native-quick-crypto';
import { Buffer } from 'buffer';

// Define interfaces for data structures
interface Peer {
  id: string;
  status: string;
  profile?: any; // Replace 'any' with a specific profile type if known
}

interface MessageData {
  timestamp: number;
  senderId: string;
  message: string;
  id: string;
}

interface WebRTCContextValue {
  peers: Peer[];
  setPeers: React.Dispatch<React.SetStateAction<Peer[]>>;
  profile: any; // Replace 'any' with a specific type if known
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
  sendMessageChatToPeer: (peerId: string, message: string, peerPublicKey: string) => void;
  receiveMessageFromChat: (peerId: string, dataChannel: RTCDataChannel) => Promise<void>;
  disconnectFromWebSocket: () => void;
  chatMessagesRef: React.MutableRefObject<Map<string, MessageData[]>>;
}

// Create context with an initial undefined value, to be typed later
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
  const [profile, setProfile] = useState<any>(null); // Replace 'any' with a specific type if known
  const router: Router = useRouter();
  const socket = useRef<Socket | null>(null);
  const peerIdRef = useRef<string | null>(null);
  const chatDataChannelsRef = useRef<Map<string, RTCDataChannel>>(new Map());
  const signalingDataChannelsRef = useRef<Map<string, RTCDataChannel>>(new Map());
  const chatMessagesRef = useRef<Map<string, MessageData[]>>(new Map());

  const iceServers: RTCIceServer[] = iceServersList;

  const createPeerConnection = (peerId: string, signalingDataChannel: RTCDataChannel | null = null): RTCPeerConnection => {
    const peerConnection = new RTCPeerConnection({ iceServers });

    const handleDataChannel = (event: RTCDataChannelEvent<'datachannel'>) => {
      const dataChannel: RTCDataChannel = event.channel;
      if (dataChannel.label === 'chat') {
        chatDataChannelsRef.current.set(peerId, dataChannel);
        receiveMessageFromChat(peerId, dataChannel);
      } else if (dataChannel.label === 'profile') {
        const handleOpen = async () => {
          updatePeerStatus(peerId, 'open (answer side)');
          const storedProfile = await AsyncStorage.getItem('userProfile');
          const profile = storedProfile ? JSON.parse(storedProfile) : null;
          try {
            if (profile !== null) {
              console.log('Sending profile from offer side...');
              sendData(dataChannel, JSON.stringify({ type: 'profile', profile }));
            }
          } catch (error) {
            console.error('Error while sending profile:', error);
          }
        };

        const handleClose = (event: Event) => {
          updatePeerStatus(peerId, 'closed');
          console.log('answer side received close event: ' + event);
        };

        let receivedChunks: string[] = [];
        const handleMessage = (event: any) => {
          if (event.data === 'EOF') {
            const message = JSON.parse(receivedChunks.join(''));
            updatePeerProfile(peerId, message.profile);
            receivedChunks = [];
          } else {
            receivedChunks.push(event.data);
          }
        };

        dataChannel.addEventListener('open', handleOpen);
        dataChannel.addEventListener('close', handleClose);
        dataChannel.addEventListener('message', handleMessage);

        // Cleanup for data channel events
        const originalClose = dataChannel.close.bind(dataChannel);
        dataChannel.close = () => {
          dataChannel.removeEventListener('open', handleOpen);
          dataChannel.removeEventListener('close', handleClose);
          dataChannel.removeEventListener('message', handleMessage);
          originalClose();
        };
      } else if (dataChannel.label === 'pex') {
        const handleOpen = async () => {
          console.log('PEX datachannel opened');
          await delay(3000);
          sendPEXRequest(dataChannel);
        };

        const handleMessage = (event: MessageEvent) => {
          console.log('Received pex message');
          handlePEXMessages(event, dataChannel, signalingDataChannelsRef.current.get(peerId));
        };

        dataChannel.addEventListener('open', handleOpen);
        dataChannel.addEventListener('message', handleMessage);

        const originalClose = dataChannel.close.bind(dataChannel);
        dataChannel.close = () => {
          dataChannel.removeEventListener('open', handleOpen);
          dataChannel.removeEventListener('message', handleMessage);
          originalClose();
        };
      } else if (dataChannel.label === 'signaling') {
        const handleOpen = () => {
          console.log('Signaling channel opened with peer: ' + peerId);
          signalingDataChannelsRef.current.set(peerId, dataChannel);
        };

        const handleMessage = async (event: MessageEvent) => {
          console.log('received message on signalingDataChannel - answer side' + event);
          handleSignalingOverDataChannels(event, dataChannel);
        };

        dataChannel.addEventListener('open', handleOpen);
        dataChannel.addEventListener('message', handleMessage);

        const originalClose = dataChannel.close.bind(dataChannel);
        dataChannel.close = () => {
          dataChannel.removeEventListener('open', handleOpen);
          dataChannel.removeEventListener('message', handleMessage);
          originalClose();
        };
      }
    };

    const handleIceCandidate = (event: RTCIceCandidateEvent<'icecandidate'>) => {
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

    const handleIceConnectionStateChange = () => {
      console.log(`ICE connection state: ${peerConnection.iceConnectionState}`);
    };

    peerConnection.addEventListener('datachannel', handleDataChannel);
    peerConnection.addEventListener('icecandidate', handleIceCandidate);
    peerConnection.addEventListener('iceconnectionstatechange', handleIceConnectionStateChange);

    // Cleanup for peer connection events
    const originalClose = peerConnection.close.bind(peerConnection);
    peerConnection.close = () => {
      peerConnection.removeEventListener('datachannel', handleDataChannel);
      peerConnection.removeEventListener('icecandidate', handleIceCandidate);
      peerConnection.removeEventListener('iceconnectionstatechange', handleIceConnectionStateChange);
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
    const handleSignalingOpen = () => {
      signalingDataChannelsRef.current.set(peerId, signalingDataChannel);
    };
    const handleSignalingMessage = async (event: MessageEvent) => {
      console.log('received message on signalingDataChannel - offer side' + event);
      handleSignalingOverDataChannels(event, signalingDataChannel);
    };
    signalingDataChannel.addEventListener('open', handleSignalingOpen);
    signalingDataChannel.addEventListener('message', handleSignalingMessage);

    const pexDataChannel = peerConnection.createDataChannel('pex');
    const handlePexOpen = async () => {
      await delay(3000);
      sendPEXRequest(pexDataChannel);
    };
    const handlePexMessage = async (event: MessageEvent) => {
      handlePEXMessages(event, pexDataChannel, signalingDataChannelsRef.current.get(peerId));
    };
    pexDataChannel.addEventListener('open', handlePexOpen);
    pexDataChannel.addEventListener('message', handlePexMessage);

    const profileDataChannel = peerConnection.createDataChannel('profile');
    const handleProfileOpen = async () => {
      updatePeerStatus(peerId, 'open (offer side)');
      await shareProfile(sendData, profileDataChannel);
    };
    const handleProfileClose = (event: Event) => {
      console.log('offer side received close event: ' + event);
      updatePeerStatus(peerId, 'closed');
      chatDataChannelsRef.current.delete(peerId);
    };
    let receivedChunks: string[] = [];
    const handleProfileMessage = (event: any) => {
      if (event.data === 'EOF') {
        console.log('File received successfully');
        const message = JSON.parse(receivedChunks.join(''));
        updatePeerProfile(peerId, message.profile);
        receivedChunks = [];
      } else {
        receivedChunks.push(event.data);
      }
    };
    profileDataChannel.addEventListener('open', handleProfileOpen);
    profileDataChannel.addEventListener('close', handleProfileClose);
    profileDataChannel.addEventListener('message', handleProfileMessage);

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

  const handleSignalingOverDataChannels = (event: any, signalingDataChannel: RTCDataChannel): void => {
    const message = JSON.parse(event.data) as any; // Define a proper type for message if possible
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

  const handleWebRTCSignaling = (message: any, dataChannelForSignaling: RTCDataChannel | null = null): void => {
    if (message?.offer) {
      const offer = message.offer;
      const from = message.from;
      handleOffer(offer, from, dataChannelForSignaling);
    } else if (message?.answer) {
      const from = message.from;
      if (connections[from]) {
        connections[from].setRemoteDescription(message.answer);
      }
    } else if (message?.candidate) {
      if (connections[message.from]) {
        connections[message.from]
          .addIceCandidate(new RTCIceCandidate(message.candidate))
          .then(() => console.log('ICE candidate added successfully'))
          .catch((e) => console.error('Error adding ICE candidate:', e));
      }
    }
  };

  const handleOffer = async (sdp: any, sender: string, channelUsedForSignaling: RTCDataChannel | null = null): Promise<void> => {
    const peerConnection = createPeerConnection(sender, channelUsedForSignaling);
    connections[sender] = peerConnection;
    await peerConnection.setRemoteDescription(sdp);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    if (channelUsedForSignaling == null) {
      socket.current?.emit('messageOne', { target: sender, from: peerIdRef.current, answer });
    } else {
      console.log('Sending answer using signaling over datachannels to peer: ' + sender);
      channelUsedForSignaling.send(JSON.stringify({ target: sender, from: peerIdRef.current, answer }));
    }

    setPeers((prev) => {
      if (prev.some((peer) => peer.id === sender)) {
        return prev;
      }
      return [...prev, { id: sender, status: 'connecting' }];
    });
  };

  const handlePEXMessages = (event: any, pexDataChannel: RTCDataChannel, signalingDataChannel?: RTCDataChannel): void => {
    try {
      const message = JSON.parse(event.data) as any; // Define a proper type if possible
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
    const requestMessage = {
      type: 'request',
      maxNumberOfPeers: 20,
    };

    try {
      pexDataChannel.send(JSON.stringify(requestMessage));
    } catch (error) {
      console.log('Couldn’t send pex request: ' + error);
    }
  };

  const shareConnectedPeers = (pexDataChannel: RTCDataChannel, message: any): void => {
    const peersToShare = new Set<string>();
    if (Object.keys(connections).length !== 0) {
      Object.keys(connections).forEach((peerId) => {
        peersToShare.add(peerId);
      });
    }

    const answer = {
      type: 'advertisement',
      peers: Array.from(peersToShare),
    };
    pexDataChannel.send(JSON.stringify(answer));
  };

  const sendMessageChatToPeer = (peerId: string, message: string, peerPublicKey: string): void => {
    const dataChannel = chatDataChannelsRef.current.get(peerId);
    if (!peerPublicKey) {
      console.error('❌ Nie można pobrać klucza publicznego.');
      return;
    }

    if (dataChannel?.readyState === 'open') {
      const encryptedMessage = crypto.publicEncrypt(peerPublicKey, Buffer.from(message)).toString('base64');
      dataChannel.send(encryptedMessage);

      const messageData: MessageData = {
        timestamp: new Date().getTime(),
        senderId: peerIdRef.current!,
        message,
        id: uuid.v4() as string,
      };

      chatMessagesRef.current.set(peerId, [...(chatMessagesRef.current.get(peerId) || []), messageData]);
    } else {
      console.log(`Data channel for peer ${peerId} is not ready`);
    }
  };

  const receiveMessageFromChat = async (peerId: string, dataChannel: RTCDataChannel): Promise<void> => {
    const privateKey = await AsyncStorage.getItem('privateKey');
    if (!privateKey) {
      console.error('❌ Brak prywatnego klucza. Nie można odszyfrować wiadomości.');
      return;
    }

    const handleMessage = async (event: any) => {
      const decryptedMessage = crypto.privateDecrypt(privateKey, Buffer.from(event.data, 'base64')).toString();
      try {
        const messageData: MessageData = {
          timestamp: new Date().getTime(),
          senderId: peerId,
          message: decryptedMessage,
          id: uuid.v4() as string,
        };

        const currentMessages = chatMessagesRef.current.get(peerId) || [];
        const updatedMessages = [...currentMessages, messageData];
        chatMessagesRef.current.set(peerId, updatedMessages);

        await AsyncStorage.setItem(`chatMessages_${peerId}`, JSON.stringify(updatedMessages));
      } catch (error) {
        console.log('Error receiving message:', error);
      }
    };

    dataChannel.addEventListener('message', handleMessage);

    const originalClose = dataChannel.close.bind(dataChannel);
    dataChannel.close = () => {
      dataChannel.removeEventListener('message', handleMessage);
      originalClose();
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
          setProfile(JSON.parse(storedProfile));
        } else {
          router.push('/profile');
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    socket.current = getSocket(signalingServerURL, token);

    socket.current.on('message', (message: any) => {
      if (message.target === peerIdRef.current) {
        if (message.payload?.connections) {
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
        if (message.payload?.action === 'close') {
          console.log(`Peer disconnected from signaling server: ${message.from}`);
        }
      }
    });

    socket.current.on('connect', () => {
      console.log('Connected to signaling server. SocketId: ' + socket.current!.id);
      const generatedPeerId = uuid.v4() as string;
      peerIdRef.current = generatedPeerId;
      socket.current!.emit('ready', generatedPeerId, 'type-emulator');
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