import React, { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';
import {
  RTCPeerConnection,
  RTCDataChannel,
  RTCDataChannelEvent,
  RTCIceCandidateEvent,
  MessageEvent,
  Event,
  RTCSessionDescription
} from 'react-native-webrtc';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendData } from './webrtcService';
import { getSocket, disconnectSocket, handleWebSocketMessages } from './socket';
import { Socket } from 'socket.io-client';
import { useRouter, Router } from 'expo-router';
import { WebRTCContextValue, Peer, MessageData, Profile, ProfileMessage, PeerDTO } from '../types/types';
import { handleSignalingOverDataChannels, sendEncryptedSDP } from './signaling';
import { sendChatMessage, receiveMessageFromChat, initiateDBTable } from './chat';
import { shareProfile, fetchProfile } from './profile';
import { handlePEXMessages, sendPEXRequest } from './pex';
import uuid from "react-native-uuid";
import DHT from './dht/dht';
import { setupUserDatabase, updateUser, User } from './db/userdb';

const WebRTCContext = createContext<WebRTCContextValue | undefined>(undefined);

interface WebRTCProviderProps {
  children: ReactNode;
  signalingServerURL: string;
  token: string;
  iceServersList: RTCIceServer[];
}

export const WebRTCProvider: React.FC<WebRTCProviderProps> = ({ children, signalingServerURL, token, iceServersList }) => {
  const [peers, setPeers] = useState<Peer[]>([]);
  const connectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const router: Router = useRouter();
  const [profile, setProfile] = useState<Promise<Profile>>(fetchProfile(router));
  const socket = useRef<Socket | null>(null);
  const peerIdRef = useRef<string | null>(null);
  const chatDataChannelsRef = useRef<Map<string, RTCDataChannel>>(new Map());
  const signalingDataChannelsRef = useRef<Map<string, RTCDataChannel>>(new Map());
  const pexDataChannelsRef = useRef<Map<string, RTCDataChannel>>(new Map());
  const chatMessagesRef = useRef<Map<string, MessageData[]>>(new Map());
  const [notifyChat, setNotifyChat] = useState(0);
  const dhtRef = useRef<DHT | null>(null);
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const peerConnectionTimestamps = useRef<Map<string, number>>(new Map());

  const iceServers: RTCIceServer[] = iceServersList;

  const createPeerConnection = (targetPeer: PeerDTO, signalingDataChannel: RTCDataChannel | null = null): RTCPeerConnection => {
    const peerConnection = new RTCPeerConnection({ iceServers });

    peerConnection.ondatachannel = (event: RTCDataChannelEvent<'datachannel'>) => {
      const dataChannel: RTCDataChannel = event.channel;
      if (dataChannel.label === 'chat') {
        chatDataChannelsRef.current.set(targetPeer.peerId, dataChannel);
        initiateDBTable(targetPeer.peerId, dataChannel);
        receiveMessageFromChat(dataChannel, dhtRef.current!, setNotifyChat);

        const originalClose = dataChannel.close.bind(dataChannel);
        dataChannel.close = () => {
          dataChannel.onopen = undefined;
          dataChannel.onclose = undefined;
          dataChannel.onmessage = undefined;
          originalClose();
        };
      } else if (dataChannel.label === 'profile') {
        dataChannel.onopen = async () => {
          updatePeerStatus(targetPeer.peerId, 'open (answer side)');
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
          updatePeerStatus(targetPeer.peerId, 'closed');
          console.log('answer side received close event: ' + event);
        };

        let receivedChunks: string[] = [];
        dataChannel.onmessage = (event: MessageEvent) => {
          if (event.data === 'EOF') {
            const message = JSON.parse(receivedChunks.join('')) as ProfileMessage;
            updatePeerProfile(targetPeer.peerId, message.profile);
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
          pexDataChannelsRef.current.set(targetPeer.peerId, dataChannel);
          console.log('PEX datachannel opened');
          await delay(3000);
          sendPEXRequest(dataChannel);
        };

        dataChannel.onmessage = (event: MessageEvent) => {
          console.log('Received pex message');
          handlePEXMessages(event, dataChannel, connectionsRef.current, peerIdRef.current!,
            initiateConnection, signalingDataChannelsRef.current.get(targetPeer.peerId)!);
        };

        const originalClose = dataChannel.close.bind(dataChannel);
        dataChannel.close = () => {
          pexDataChannelsRef.current.delete(targetPeer.peerId);
          dataChannel.onopen = undefined;
          dataChannel.onclose = undefined;
          dataChannel.onmessage = undefined;
          originalClose();
        };
      } else if (dataChannel.label === 'signaling') {
        dataChannel.onopen = () => {
          console.log('Signaling channel opened with peer: ' + targetPeer);
          signalingDataChannelsRef.current.set(targetPeer.peerId, dataChannel);
        };

        dataChannel.onmessage = async (event: MessageEvent) => {
          console.log('received message on signalingDataChannel - answer side' + event);
          handleSignalingOverDataChannels(event, await profile, connectionsRef.current, createPeerConnection,
            setPeers, signalingDataChannelsRef.current, dataChannel);
        };

        const originalClose = dataChannel.close.bind(dataChannel);
        dataChannel.close = () => {
          dataChannel.onopen = undefined;
          dataChannel.onclose = undefined;
          dataChannel.onmessage = undefined;
          originalClose();
        };
      } else if (dataChannel.label === 'dht') {
        dhtRef.current!.setUpDataChannel(targetPeer.peerId, dataChannel);
        console.log(dataChannel);
        
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
            target: targetPeer.peerId,
            from: peerIdRef.current,
            candidate: event.candidate,
          });
        } else {
          console.log('Sending ice candidates through DataChannel');
          signalingDataChannel.send(
            JSON.stringify({ target: targetPeer.peerId, from: peerIdRef.current, candidate: event.candidate })
          );
        }
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log(`ICE connection state: ${peerConnection.iceConnectionState}`);
      if (peerConnection.iceConnectionState === "disconnected" || peerConnection.iceConnectionState === "failed" || peerConnection.iceConnectionState === "closed") {
        peerConnection.close();
        connectionsRef.current.delete(targetPeer.peerId);
        peerConnectionTimestamps.current.delete(targetPeer.peerId);
        updatePeerStatus(targetPeer.peerId, "closed");
        dhtRef.current?.closeDataChannel(targetPeer.peerId);
        chatDataChannelsRef.current.get(targetPeer.peerId)?.close();
      }
    };

    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === 'closed') {
        console.log("Connection closed - answer side");
        connectionsRef.current.delete(targetPeer.peerId);
        peerConnectionTimestamps.current.delete(targetPeer.peerId);
        updatePeerStatus(targetPeer.peerId, "closed");
        dhtRef.current?.closeDataChannel(targetPeer.peerId);
        chatDataChannelsRef.current.delete(targetPeer.peerId);
      } else if (peerConnection.connectionState === 'connected') {
        updatePeerStatus(targetPeer.peerId, "connected");
      }
    };

    const originalClose = peerConnection.close.bind(peerConnection);
    peerConnection.close = () => {
      peerConnection.ondatachannel = undefined;
      peerConnection.onicecandidate = undefined;
      peerConnection.oniceconnectionstatechange = undefined;
      peerConnection.onconnectionstatechange = undefined;
      originalClose();
    };  

    connectionsRef.current.set(targetPeer.peerId, peerConnection);
    console.log(`Added peer ${targetPeer.peerId} to connections.`)
    console.log(`connections: ${connectionsRef.current}`)
    peerConnectionTimestamps.current.set(targetPeer.peerId, Date.now());
    return peerConnection;
  };

  const initiateConnection = async (targetPeer: PeerDTO, dataChannelUsedForSignaling: RTCDataChannel | null = null): Promise<void> => {
    const peerConnection = createPeerConnection(targetPeer, dataChannelUsedForSignaling);

    const chatDataChannel = peerConnection.createDataChannel('chat');
    chatDataChannelsRef.current.set(targetPeer.peerId, chatDataChannel);
    initiateDBTable(targetPeer.peerId, chatDataChannel);
    receiveMessageFromChat(chatDataChannel, dhtRef.current!, setNotifyChat);

    const originalClose = chatDataChannel.close.bind(chatDataChannel);
    chatDataChannel.close = () => {
      chatDataChannel.onopen = undefined;
      chatDataChannel.onclose = undefined;
      chatDataChannel.onmessage = undefined;
      originalClose();
    };

    const signalingDataChannel = peerConnection.createDataChannel('signaling');
    signalingDataChannel.onopen = () => {
      signalingDataChannelsRef.current.set(targetPeer.peerId, signalingDataChannel);
    };
    signalingDataChannel.onmessage = async (event: MessageEvent) => {
      console.log('received message on signalingDataChannel - offer side' + event);
      handleSignalingOverDataChannels(event, await profile, connectionsRef.current, createPeerConnection,
        setPeers, signalingDataChannelsRef.current, signalingDataChannel);
    };

    const pexDataChannel = peerConnection.createDataChannel('pex');
    pexDataChannel.onopen = async () => {
      pexDataChannelsRef.current.set(targetPeer.peerId, pexDataChannel);
      await delay(3000);
      sendPEXRequest(pexDataChannel);
    };
    pexDataChannel.onmessage = async (event: MessageEvent) => {
      handlePEXMessages(event, pexDataChannel, connectionsRef.current, peerIdRef.current!, initiateConnection, signalingDataChannelsRef.current.get(targetPeer.peerId)!);
    };
    pexDataChannel.onclose = (event: Event) => {
      pexDataChannelsRef.current.delete(targetPeer.peerId);
    };

    const profileDataChannel = peerConnection.createDataChannel('profile');
    profileDataChannel.onopen = async () => {
      updatePeerStatus(targetPeer.peerId, 'open (offer side)');
      await shareProfile(sendData, profileDataChannel);
    };
    profileDataChannel.onclose = (event: Event) => {
      console.log('offer side received close event: ' + event);
      updatePeerStatus(targetPeer.peerId, 'closed');
      chatDataChannelsRef.current.delete(targetPeer.peerId);
    };

    const dhtDataChannel = peerConnection.createDataChannel('dht');
    dhtRef.current!.setUpDataChannel(targetPeer.peerId, dhtDataChannel);
    console.log(dhtDataChannel);

    let receivedChunks: string[] = [];
    profileDataChannel.onmessage = (event: MessageEvent) => {
      if (event.data === 'EOF') {
        console.log('File received successfully');
        const message = JSON.parse(receivedChunks.join(''));
        updatePeerProfile(targetPeer.peerId, message.profile);
        receivedChunks = [];
      } else {
        receivedChunks.push(event.data);
      }
    };

    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === 'closed') {
        console.log("Connection closed - offer side");
        connectionsRef.current.delete(targetPeer.peerId);
        peerConnectionTimestamps.current.delete(targetPeer.peerId);
        updatePeerStatus(targetPeer.peerId, "closed");
        dhtRef.current?.closeDataChannel(targetPeer.peerId);
      } else if (peerConnection.connectionState === 'connected') {
        updatePeerStatus(targetPeer.peerId, "connected");
      }
    };

    const offer = await peerConnection.createOffer(null) as RTCSessionDescription;
    await peerConnection.setLocalDescription(offer);

    sendEncryptedSDP((await profile), targetPeer, offer, socket.current, dataChannelUsedForSignaling);

    setPeers((prev) => {
      if (prev.some((peer) => peer.id === targetPeer.peerId)) {
        return prev;
      }
      return [...prev, { id: targetPeer.peerId, status: 'connecting' }];
    });
  };

  const sendMessageChatToPeer = (peerId: string, messageText: string): Promise<void> => {
    return sendChatMessage(peerId, peerIdRef.current!, messageText, chatDataChannelsRef.current, dhtRef.current!);
  };

  const updatePeerStatus = (peerId: string, status: string): void => {
    setPeers((prev) => prev.map((peer) => (peer.id === peerId ? { ...peer, status } : peer)));
  };

  const updatePeerProfile = async (peerId: string, profile: Profile): Promise<void> => {
    console.log(profile.interests);
    const updates: Partial<Omit<User, 'peerId' | 'publicKey'>> = {
      name: profile.name,
      profilePic: profile.profilePic,
      birthDay: profile.birthDay,
      birthMonth: profile.birthMonth,
      birthYear: profile.birthYear,
      description: profile.description,
      sex: profile.sex,
      interests: profile.interests,
      searching: profile.searching,
    };

    await updateUser(peerId, updates);
    setPeers((prevPeers) => prevPeers.map((peer) => (peer.id === peerId ? { ...peer, profile } : peer)));
  };

  const checkConnectingPeers = () => {
    console.log("Checking for peers stucked in connecting stage")
    const now = Date.now();
    const timeoutMs = 10 * 1000; // 10 seconds
    peerConnectionTimestamps.current.forEach((timestamp, peerId) => {
      if (now - timestamp > timeoutMs) {
        const peerConnection = connectionsRef.current.get(peerId);
        if (peerConnection && peers.find(p => p.id === peerId && p.status === 'connecting')) {
          console.log(`Peer ${peerId} stuck in connecting for over 10s, closing connection`);
          peerConnection.close();
          connectionsRef.current.delete(peerId);
          peerConnectionTimestamps.current.delete(peerId);
          chatDataChannelsRef.current.delete(peerId);
          signalingDataChannelsRef.current.delete(peerId);
          pexDataChannelsRef.current.delete(peerId);
          dhtRef.current?.closeDataChannel(peerId);
          setPeers((prev) => prev.filter(p => p.id !== peerId));
        }
      }
    });
  };

  useEffect(() => {
    const initDependencies = async () => {
      socket.current = getSocket(signalingServerURL, token);
  
      try {
        const resolvedProfile = await profile;

        if (!dhtRef.current) {
          dhtRef.current = new DHT({ nodeId: resolvedProfile.peerId, k: 20 });
        }
  
        if (!peerIdRef.current) {
          peerIdRef.current = resolvedProfile.peerId || (uuid.v4() as string);
        }

        console.log(resolvedProfile.peerId);
  
        handleWebSocketMessages(
          socket.current!,
          resolvedProfile,
          connectionsRef.current,
          initiateConnection,
          createPeerConnection,
          setPeers
        );

        setupUserDatabase();

        saveIntervalRef.current = setInterval(() => {
          if (dhtRef.current) {
            dhtRef.current.saveState().catch(err => console.error(`Failed to save DHT state: ${err}`));
          }
        }, 10 * 1000); // Save DHT state every 10s.

        
      } catch (error) {
        console.error('Error resolving profile and DHT in useEffect:', error);
      }
    };
    initDependencies();

    const connectionCheckInterval = setInterval(checkConnectingPeers, 10 * 1000); // Check every 10s
    return () => {
      socket.current?.disconnect();
      Object.values(connectionsRef.current).forEach((pc) => pc.close());
      if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);
      if (connectionCheckInterval) clearInterval(connectionCheckInterval);
    };
  }, [signalingServerURL, token]);

  const disconnectFromWebSocket = (): void => {
    console.log('Disconnecting from signaling server. ' + socket.current?.id);
    disconnectSocket();
  };

  const closePeerConnection = (peerId: string): void => {
    console.log(`Closing connection with ${peerId}`);
    let connection = connectionsRef.current.get(peerId);
    connection?.close();
    connectionsRef.current.delete(peerId);
    peerConnectionTimestamps.current.delete(peerId);
    chatDataChannelsRef.current.delete(peerId);
    signalingDataChannelsRef.current.delete(peerId);
    pexDataChannelsRef.current.delete(peerId);
    dhtRef.current?.closeDataChannel(peerId);
    setPeers((prev) => prev.filter(p => p.id !== peerId));
  };

  const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

  const value: WebRTCContextValue = {
    peers,
    setPeers,
    profile,
    setProfile,
    peerIdRef,
    socket: socket.current,
    connectionsRef,
    chatDataChannels: chatDataChannelsRef.current,
    createPeerConnection,
    updatePeerStatus,
    updatePeerProfile,
    initiateConnection,
    sendMessageChatToPeer,
    disconnectFromWebSocket,
    chatMessagesRef,
    notifyChat,
    closePeerConnection,
    dhtRef
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