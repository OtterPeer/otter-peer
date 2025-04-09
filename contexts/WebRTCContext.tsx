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
import { getSocket, disconnectSocket, handleWebSocketMessages } from './socket';
import { Socket } from 'socket.io-client';
import { useRouter, Router } from 'expo-router';
import { WebRTCContextValue, Peer, MessageData, Profile, ProfileMessage } from '../types/types';
import { handleSignalingOverDataChannels } from './signaling';
import { sendChatMessage, receiveMessageFromChat, initiateDBTable } from './chat';
import { shareProfile, fetchProfile } from './profile';
import { handlePEXMessages, sendPEXRequest } from './pex'
import uuid from "react-native-uuid";
import { Node } from './dht/webrtc-rpc';
import DHT from './dht/dht';
import { saveUserToDB, setupUserDatabase } from './db/userdb';

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
  const chatMessagesRef = useRef<Map<string, MessageData[]>>(new Map());
  const [notifyChat, setNotifyChat] = useState(0);
  const dhtRef = useRef<DHT | null>(null);

  const iceServers: RTCIceServer[] = iceServersList;

  const createPeerConnection = (peerId: string, signalingDataChannel: RTCDataChannel | null = null): RTCPeerConnection => {
    const peerConnection = new RTCPeerConnection({ iceServers });

    peerConnection.ondatachannel = (event: RTCDataChannelEvent<'datachannel'>) => {
      const dataChannel: RTCDataChannel = event.channel;
      if (dataChannel.label === 'chat') {
        chatDataChannelsRef.current.set(peerId, dataChannel);
        initiateDBTable(peerId, dataChannel);
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
          handlePEXMessages(event, dataChannel, connectionsRef.current, peerIdRef.current!,
            initiateConnection, signalingDataChannelsRef.current.get(peerId)!);
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
          handleSignalingOverDataChannels(event, peerIdRef.current!, connectionsRef.current, createPeerConnection,
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
        dhtRef.current!.setUpDataChannel(peerId, dataChannel)
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

    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === 'closed') {
        console.log("Connection closed - answer side")
        dhtRef.current?.closeDataChannel(peerId);
      }
    };

    const originalClose = peerConnection.close.bind(peerConnection);
    peerConnection.close = () => {
      peerConnection.ondatachannel = undefined;
      peerConnection.onicecandidate = undefined;
      peerConnection.oniceconnectionstatechange = undefined;
      originalClose();
    };  

    connectionsRef.current.set(peerId, peerConnection);
    return peerConnection;
  };

  const initiateConnection = async (peerId: string, dataChannelUsedForSignaling: RTCDataChannel | null = null): Promise<void> => {
    const peerConnection = createPeerConnection(peerId, dataChannelUsedForSignaling);

    const chatDataChannel = peerConnection.createDataChannel('chat');
    chatDataChannelsRef.current.set(peerId, chatDataChannel);
    initiateDBTable(peerId, chatDataChannel);
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
      signalingDataChannelsRef.current.set(peerId, signalingDataChannel);
    };
    signalingDataChannel.onmessage = async (event: MessageEvent) => {
      console.log('received message on signalingDataChannel - offer side' + event);
      handleSignalingOverDataChannels(event, peerIdRef.current!, connectionsRef.current, createPeerConnection,
        setPeers, signalingDataChannelsRef.current, signalingDataChannel);
    };

    const pexDataChannel = peerConnection.createDataChannel('pex');
    pexDataChannel.onopen = async () => {
      await delay(3000);
      sendPEXRequest(pexDataChannel);
    };
    pexDataChannel.onmessage = async (event: MessageEvent) => {
      handlePEXMessages(event, pexDataChannel, connectionsRef.current, peerIdRef.current!, initiateConnection, signalingDataChannelsRef.current.get(peerId)!);
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

    const dhtDataChannel = peerConnection.createDataChannel('dht');
    dhtRef.current!.setUpDataChannel(peerId, dhtDataChannel);
    console.log(dhtDataChannel);

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

    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === 'closed') {
        console.log("Connection closed - offer side")
        dhtRef.current?.closeDataChannel(peerId);
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

  const sendMessageChatToPeer = (peerId: string, messageText: string, peerPublicKey: string): void => {
    sendChatMessage(peerId, peerIdRef.current!, messageText, peerPublicKey, chatDataChannelsRef.current, dhtRef.current!);
  };

  const updatePeerStatus = (peerId: string, status: string): void => {
    setPeers((prev) => prev.map((peer) => (peer.id === peerId ? { ...peer, status } : peer)));
  };

  const updatePeerProfile = (peerId: string, profile: Profile): void => {
    setupUserDatabase();
    saveUserToDB(profile);
    setPeers((prevPeers) => prevPeers.map((peer) => (peer.id === peerId ? { ...peer, profile } : peer)));
  };

  useEffect(() => {
    const initDependencies = async () => {
      socket.current = getSocket(signalingServerURL, token);
  
      try {
        const resolvedProfile = await profile;

        if (!dhtRef.current) {
          dhtRef.current = new DHT({ nodeId: resolvedProfile.peerId});
        }
  
        if (!peerIdRef.current) {
          peerIdRef.current = resolvedProfile.peerId || (uuid.v4() as string);
        }

        console.log(resolvedProfile.peerId)
  
        handleWebSocketMessages(
          socket.current!,
          resolvedProfile.peerId,
          connectionsRef.current,
          initiateConnection,
          createPeerConnection,
          setPeers
        );
      } catch (error) {
        console.error('Error resolving profile and DHT in useEffect:', error);
      }
    };
    initDependencies();

    return () => {
      socket.current?.disconnect();
      Object.values(connectionsRef.current).forEach((pc) => pc.close());
    };
  }, [signalingServerURL, token]);

  const disconnectFromWebSocket = (): void => {
    console.log('Disconnecting from signaling server. ' + socket.current?.id);
    disconnectSocket();
  };

  const closePeerConnection = (peerId: string): void => {
    console.log("Closing connection");
    let connection = connectionsRef.current.get(peerId);
    connection?.close();
    chatDataChannelsRef.current!.delete(peerId);
  }

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