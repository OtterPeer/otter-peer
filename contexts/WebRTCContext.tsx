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
import { WebRTCContextValue, Peer, MessageData, Profile, ProfileMessage, PeerDTO, WebSocketMessage, LikeMessage, UserFilter } from '../types/types';
import { handleSignalingOverDataChannels, receiveSignalingMessageOnDHT, sendEncryptedSDP } from './signaling';
import { sendChatMessage, receiveMessageFromChat, initiateDBTable } from './chat';
import { shareProfile, fetchProfile } from './profile';
import { handlePEXMessages } from './pex';
import uuid from "react-native-uuid";
import DHT from './dht/dht';
import { ConnectionManager } from './connection-manger';
import { setupUserDatabase, updateUser, User } from './db/userdb';
import { handleLikeMessage, sendLikeMessageAndCheckMatch } from './like-and-match';
import { searchingOptions } from "@/constants/SearchingOptions";
import { loadUserFiltration } from './filtration/filtrationUtils';
import { calculateAge } from './utils/user-utils';
import { EventEmitter } from 'events';
EventEmitter.defaultMaxListeners = 100;

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
  const likeDataChannelsRef = useRef<Map<string, RTCDataChannel>>(new Map());
  const chatMessagesRef = useRef<Map<string, MessageData[]>>(new Map());
  const [notifyChat, setNotifyChat] = useState(0);
  const dhtRef = useRef<DHT | null>(null);
  const connectionManagerRef = useRef<ConnectionManager | null>(null);
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const peerConnectionTimestamps = useRef<Map<string, number>>(new Map());
  const displayedPeersRef = useRef<Set<string>>(new Set());
  const likedPeersRef = useRef<Set<string>>(new Set());
  const peersReceivedLikeFromRef = useRef<{ queue: string[]; lookup: Set<string> }>({ queue: [], lookup: new Set() });
  const profilesToDisplayRef = useRef<Profile[]>([]);
  const [profilesToDisplayChangeCount, setProfilesToDisplayChangeCount] = useState(0); // Counter to trigger re-renders
  const [matchesTimestamps, setMatchesTimestamps] = useState<Map<string, number>>(new Map());
  const userFilterRef = useRef<UserFilter>({
    selectedSex: new Array(3).fill(1),
    selectedSearching: new Array(searchingOptions.length).fill(1),
    distanceRange: 50,
    ageRange: [18, 80],
  });
  const [userFilterChangeCount, setUserFilterChangeCount] = useState(0);
  const [currentSwiperIndex, setCurrentSwiperIndex] = useState(0);
  const currentSwiperIndexRef = useRef(0);

  const iceServers: RTCIceServer[] = iceServersList;
  
  const notifyProfilesChange = () => {
    setProfilesToDisplayChangeCount((prev) => prev + 1);
  };

  // Save data to AsyncStorage
  const savePersistentData = async () => {
    try {
      const matchesArray = Array.from(matchesTimestamps.entries());
      await AsyncStorage.setItem('@WebRTC:matchesTimestamps', JSON.stringify(matchesArray));
      const displayedProfilesArray = Array.from(displayedPeersRef.current);
      await AsyncStorage.setItem('@WebRTC:diplayedPeers', JSON.stringify(displayedProfilesArray));
      const likedPeersArray = Array.from(likedPeersRef.current);
      await AsyncStorage.setItem('@WebRTC:likedPeers', JSON.stringify(likedPeersArray));
      await AsyncStorage.setItem('@WebRTC:peersReceivedLikeFrom', JSON.stringify(peersReceivedLikeFromRef.current.queue));
    } catch (error) {
      console.error('Error saving persistent data to AsyncStorage:', error);
    }
  };

  // Load data from AsyncStorage
  const loadPersistentData = async () => {
    try {
      const matchesData = await AsyncStorage.getItem('@WebRTC:matchesTimestamps');
      if (matchesData) {
        const matchesArray = JSON.parse(matchesData) as [string, number][];
        setMatchesTimestamps(new Map(matchesArray));
      }
      const diplayedPeersData = await AsyncStorage.getItem('@WebRTC:diplayedPeers');
      if (diplayedPeersData) {
        const displayedPeersArray = JSON.parse(diplayedPeersData) as string[];
        displayedPeersRef.current = new Set(displayedPeersArray);
      }
      const likedPeersData = await AsyncStorage.getItem('@WebRTC:likedPeers');
      if (likedPeersData) {
        const likedPeersArray = JSON.parse(likedPeersData) as string[];
        likedPeersRef.current = new Set(likedPeersArray);
      }
      const peersReceivedLikeFromData = await AsyncStorage.getItem('@WebRTC:peersReceivedLikeFrom');
      if (peersReceivedLikeFromData) {
        const queue = JSON.parse(peersReceivedLikeFromData) as string[];
        const lookup = new Set(queue);
        peersReceivedLikeFromRef.current = { queue, lookup };
      }
    } catch (error) {
      console.error('Error loading persistent data from AsyncStorage:', error);
    }
  };

  const createPeerConnection = (targetPeer: PeerDTO, signalingDataChannel: RTCDataChannel | null = null, useDHTForSignaling: boolean = false): RTCPeerConnection => {
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
        dataChannel.onclose = (event: Event) => {
          updatePeerStatus(targetPeer.peerId, 'closed');
          console.log('answer side received close event: ' + event);
        };
        dataChannel.onmessage = (event: MessageEvent) => {
          console.log(event);
          if (event.data === 'request_profile') {
            console.log("Received profile request - sharing profile");
            shareProfile(sendData, dataChannel).catch((error) => {
              console.error('Error sending profile:', error);
            });
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
        };
        dataChannel.onmessage = (event: MessageEvent) => {
          console.log('Received pex message');
          handlePEXMessages(event, dataChannel, connectionsRef.current, connectionManagerRef.current!, signalingDataChannelsRef.current.get(targetPeer.peerId)!);
        };
        dataChannel.onclose = () => {
          pexDataChannelsRef.current.delete(targetPeer.peerId);
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
          updatePeerStatus(targetPeer.peerId, 'open (answer side)');
          console.log('Signaling channel opened with peer: ' + targetPeer);
          signalingDataChannelsRef.current.set(targetPeer.peerId, dataChannel);
        };
        dataChannel.onmessage = async (event: MessageEvent) => {
          console.log('received message on signalingDataChannel - answer side' + event);
          handleSignalingOverDataChannels(JSON.parse(event.data) as WebSocketMessage, await profile, connectionsRef.current, createPeerConnection,
            setPeers, signalingDataChannelsRef.current, connectionManagerRef.current!, dataChannel);
        };
        dataChannel.onclose = () => {
          signalingDataChannelsRef.current.delete(targetPeer.peerId);
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
      } else if (dataChannel.label === 'like') {
        dataChannel.onopen = () => {
          likeDataChannelsRef.current.set(targetPeer.peerId, dataChannel);
        };
        dataChannel.onmessage = async (event: MessageEvent) => {
          handleLikeMessage(event, targetPeer.peerId, likedPeersRef.current, peersReceivedLikeFromRef.current, setMatchesTimestamps, setNotifyChat);
        };
        dataChannel.onclose = () => {
          likeDataChannelsRef.current.delete(targetPeer.peerId);
        };
        const originalClose = dataChannel.close.bind(dataChannel);
        dataChannel.close = () => {
          dataChannel.onopen = undefined;
          dataChannel.onclose = undefined;
          dataChannel.onmessage = undefined;
          originalClose();
        };
      } else if (dataChannel.label === 'peer_dto') {
        dataChannel.onopen = () => {
          console.log("PeerDTO datachannel opened");
        };
        dataChannel.onmessage = async (event: MessageEvent) => {
          if (event.data === 'request_peer_dto') {
            console.log("Received peerdto request");
            const resolvedProfile = await profile;
            const publicKey = resolvedProfile.publicKey!;
            const age = calculateAge(resolvedProfile.birthDay!, resolvedProfile.birthMonth!, resolvedProfile.birthYear!);
            const sex = resolvedProfile?.sex as number[];
            const searching = resolvedProfile?.searching;
            const x = resolvedProfile?.x;
            const y = resolvedProfile?.y;
            const latitude = resolvedProfile?.latitude;
            const longitude = resolvedProfile?.longitude;
            const peerDto = { peerId: peerIdRef.current, publicKey, age, sex, searching, x, y, latitude, longitude } as PeerDTO;
            console.log(`Sending peerDTO: ${JSON.stringify(peerDto)}`);
            dataChannel.send(JSON.stringify(peerDto));
          }
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
        const iceCandidateMessage = {
          target: targetPeer.peerId,
          from: peerIdRef.current!,
          candidate: event.candidate
        } as WebSocketMessage;
        if (useDHTForSignaling) {
          dhtRef.current?.sendSignalingMessage(targetPeer.peerId, iceCandidateMessage);
        } else if (signalingDataChannel == null) {
          console.log('Sending ice candidates');
          socket.current?.emit('messageOne', iceCandidateMessage);
        } else {
          console.log('Sending ice candidates through DataChannel');
          signalingDataChannel.send(JSON.stringify(iceCandidateMessage));
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
        chatDataChannelsRef.current.delete(targetPeer.peerId);
      }
    };

    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === 'closed') {
        console.log("Connection closed - answer side");
        connectionsRef.current.delete(targetPeer.peerId);
        peerConnectionTimestamps.current.delete(targetPeer.peerId);
        updatePeerStatus(targetPeer.peerId, "closed");
        dhtRef.current?.closeDataChannel(targetPeer.peerId);
        chatDataChannelsRef.current.get(targetPeer.peerId)?.close();
        chatDataChannelsRef.current.delete(targetPeer.peerId);
        connectionManagerRef.current?.closeConnectionWithPeer(targetPeer.peerId);
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
    console.log(`Added peer ${targetPeer.peerId} to connections.`);
    console.log(`connections: ${connectionsRef.current}`);
    peerConnectionTimestamps.current.set(targetPeer.peerId, Date.now());
    return peerConnection;
  };

  const initiateConnection = async (targetPeer: PeerDTO, dataChannelUsedForSignaling: RTCDataChannel | null = null, useDHTForSignaling: boolean = false): Promise<void> => {
    const peerConnection = createPeerConnection(targetPeer, dataChannelUsedForSignaling, useDHTForSignaling);

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
      updatePeerStatus(targetPeer.peerId, 'open (offer side)');
      signalingDataChannelsRef.current.set(targetPeer.peerId, signalingDataChannel);
    };
    signalingDataChannel.onmessage = async (event: MessageEvent) => {
      console.log('received message on signalingDataChannel - offer side' + event);
      handleSignalingOverDataChannels(JSON.parse(event.data) as WebSocketMessage, await profile, connectionsRef.current, createPeerConnection,
        setPeers, signalingDataChannelsRef.current, connectionManagerRef.current!, signalingDataChannel);
    };

    const pexDataChannel = peerConnection.createDataChannel('pex');
    pexDataChannel.onopen = async () => {
      pexDataChannelsRef.current.set(targetPeer.peerId, pexDataChannel);
    };
    pexDataChannel.onmessage = async (event: MessageEvent) => {
      handlePEXMessages(event, pexDataChannel, connectionsRef.current, connectionManagerRef.current!, signalingDataChannelsRef.current.get(targetPeer.peerId)!);
    };
    pexDataChannel.onclose = (event: Event) => {
      pexDataChannelsRef.current.delete(targetPeer.peerId);
    };

    const likeDataChannel = peerConnection.createDataChannel('like');
    likeDataChannel.onopen = async () => {
      likeDataChannelsRef.current.set(targetPeer.peerId, likeDataChannel);
    };
    likeDataChannel.onmessage = async (event: MessageEvent) => {
      handleLikeMessage(event, targetPeer.peerId, likedPeersRef.current, peersReceivedLikeFromRef.current, setMatchesTimestamps, setNotifyChat);
    };
    pexDataChannel.onclose = (event: Event) => {
      pexDataChannelsRef.current.delete(targetPeer.peerId);
    };

    const originalCloseLikeDataChannel = likeDataChannel.close.bind(likeDataChannel);
    likeDataChannel.close = () => {
      likeDataChannel.onopen = undefined;
      likeDataChannel.onclose = undefined;
      likeDataChannel.onmessage = undefined;
      originalCloseLikeDataChannel();
    };

    const dhtDataChannel = peerConnection.createDataChannel('dht');
    dhtRef.current!.setUpDataChannel(targetPeer.peerId, dhtDataChannel);
    console.log(dhtDataChannel);

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

    if (useDHTForSignaling) {
      sendEncryptedSDP((await profile), targetPeer, offer, socket.current, null, dhtRef.current);
    } else {
      sendEncryptedSDP((await profile), targetPeer, offer, socket.current, dataChannelUsedForSignaling);
    }

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
    setPeers((prevPeers) => prevPeers.map((peer) => (peer.id === peerId ? { ...peer, profile } : peer)));
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
      latitude: profile.latitude,
      longitude: profile.longitude,
    };
    await updateUser(peerId, updates);
  };

  const sendLikeMessage = (targetPeerId: string): void => {
    sendLikeMessageAndCheckMatch(targetPeerId, peerIdRef.current!, likedPeersRef.current, peersReceivedLikeFromRef.current, likeDataChannelsRef.current, setMatchesTimestamps, setNotifyChat);
  }

  const handleSwipe = (peerId: string, x: number, y: number, action: 'left' | 'right'): void => {
    if (action === 'right') {
      sendLikeMessage(peerId);
    }
    addToDisplayedPeers(peerId);
    connectionManagerRef.current?.logSwipeAction(peerId, x, y, action);
  }

  const addToDisplayedPeers = (peerId: string): void => {
    displayedPeersRef.current.add(peerId);
  };

  const checkConnectingPeers = () => {
    const now = Date.now();
    const timeoutMs = 10 * 1000; // 10 seconds
    peerConnectionTimestamps.current.forEach((timestamp, peerId) => {
      if (now - timestamp > timeoutMs) {
        const peerConnection = connectionsRef.current.get(peerId);
        if (peerConnection && peerConnection.iceConnectionState !== 'connected' && peerConnection.iceConnectionState !== 'completed') {
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

  const updateUserFilter = (newFilter: UserFilter) => {
    userFilterRef.current = newFilter;
    setUserFilterChangeCount((prev) => prev + 1);
  };

  useEffect(() => {
    console.log("User Filter change triggered");
    if (connectionManagerRef.current) {
      connectionManagerRef.current.triggerFiltersChange();
    }
  }, [userFilterChangeCount]);

  useEffect(() => {
    currentSwiperIndexRef.current = currentSwiperIndex
  }, [currentSwiperIndex]);


  useEffect(() => {
    const initDependencies = async () => {
      await loadPersistentData();
      const loadedUserFilter = await loadUserFiltration();
      updateUserFilter(loadedUserFilter);
      userFilterRef.current = loadedUserFilter;

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
        receiveSignalingMessageOnDHT(dhtRef.current, resolvedProfile, connectionsRef.current, connectionManagerRef.current!, createPeerConnection, setPeers, signalingDataChannelsRef.current);
        setupUserDatabase();
        if (!connectionManagerRef.current) {
          connectionManagerRef.current = new ConnectionManager(
            connectionsRef.current,
            pexDataChannelsRef.current,
            dhtRef.current,
            userFilterRef,
            resolvedProfile,
            profilesToDisplayRef,
            displayedPeersRef.current,
            currentSwiperIndexRef,
            setPeers,
            initiateConnection,
            notifyProfilesChange
          );
          connectionManagerRef.current.start();
        }
        handleWebSocketMessages(
          socket.current!,
          resolvedProfile,
          connectionsRef.current,
          connectionManagerRef.current,
          createPeerConnection,
          setPeers
        );
        saveIntervalRef.current = setInterval(async () => {
          await savePersistentData();
          if (dhtRef.current) {
            dhtRef.current.saveState().catch(err => console.error(`Failed to save DHT state: ${err}`));
          }
        }, 5 * 1000);
      } catch (error) {
        console.error('Error resolving profile and DHT in useEffect:', error);
      }
    };
    initDependencies();
    const connectionCheckInterval = setInterval(checkConnectingPeers, 10 * 1000);
    return () => {
      savePersistentData().catch(err => console.error('Error saving data on cleanup:', err));
      disconnectSocket();
      Object.values(connectionsRef.current).forEach((pc) => pc.close());
      connectionManagerRef.current?.stop();
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

  const value: WebRTCContextValue = {
    peers,
    profilesToDisplayRef,
    matchesTimestamps,
    setPeers,
    profile,
    setProfile,
    userFilterRef,
    updateUserFilter,
    currentSwiperIndex,
    setCurrentSwiperIndex,
    peerIdRef,
    socket: socket.current,
    connectionsRef,
    chatDataChannels: chatDataChannelsRef.current,
    createPeerConnection,
    updatePeerStatus,
    initiateConnection,
    sendMessageChatToPeer,
    handleSwipe,
    disconnectFromWebSocket,
    chatMessagesRef,
    notifyChat,
    closePeerConnection,
    dhtRef,
    setMatchesTimestamps,
    peersReceivedLikeFromRef,
    likedPeersRef,
    displayedPeersRef
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