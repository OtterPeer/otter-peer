import React, { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';
import {
  RTCPeerConnection,
  RTCDataChannel,
  RTCDataChannelEvent,
  RTCIceCandidateEvent,
  MessageEvent,
  Event,
  RTCSessionDescription,
  RTCIceCandidate
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
import { handlePEXMessages, sendPEXRequest } from './pex'
import uuid from "react-native-uuid";
import DHT from './dht/dht';
import { fetchUserFromDB, saveUserToDB, setupUserDatabase } from './db/userdb';
import { AppState, AppStateStatus } from 'react-native';

const WebRTCContext = createContext<WebRTCContextValue | undefined>(undefined);

interface WebRTCProviderProps {
  children: ReactNode;
  signalingServerURL: string;
  token: string;
  iceServersList: RTCIceServer[];
}

interface ConnectionConfig {
  peerId: string;
  iceServers: RTCIceServer[];
  localDescription?: RTCSessionDescription;
  remoteDescription?: RTCSessionDescription;
  iceCandidates: RTCIceCandidate[];
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
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const iceCandidatesRef = useRef<Map<string, RTCIceCandidate[]>>(new Map());

  const iceServers: RTCIceServer[] = iceServersList;

  const saveConnectionsToStorage = async () => {
    try {
      const connectionConfigs: ConnectionConfig[] = Array.from(connectionsRef.current.entries()).map(([peerId, peerConnection]) => ({
        peerId,
        iceServers,
        localDescription: peerConnection.localDescription ? peerConnection.localDescription : undefined,
        remoteDescription: peerConnection.remoteDescription ? peerConnection.remoteDescription : undefined,
        iceCandidates: iceCandidatesRef.current.get(peerId) || [],
      }));
      await AsyncStorage.setItem('savedConnections', JSON.stringify(connectionConfigs));
      console.log('Saved connection configs to storage:', connectionConfigs);
    } catch (error) {
      console.error('Error saving connections to storage:', error);
    }
  };

  const restoreConnectionsFromStorage = async () => {
    try {
      const savedConnections = await AsyncStorage.getItem('savedConnections');
      if (!savedConnections) {
        console.log('No saved connections found in storage.');
        return;
      }

      const connectionConfigs: ConnectionConfig[] = JSON.parse(savedConnections);
      console.log('Restoring connections:', connectionConfigs);

      for (const config of connectionConfigs) {
        let user;
        try {
          user = await fetchUserFromDB(config.peerId);
          if (!user || !user.publicKey) {
            throw Error("User not in the db or public key is missing");
          }
        } catch (err) {
          console.error(`Error fetching user for peer ${config.peerId}:`, err);
          continue;
        }
        const peerDTO: PeerDTO = { peerId: config.peerId, publicKey: user?.publicKey };
        try {
          console.log('Config for peer:', config);

          // Validate configuration
          if (!config.iceServers || !config.iceServers.length) {
            console.warn(`Skipping restoration for peer ${config.peerId}: Missing ICE servers.`);
            continue;
          }

          if (!config.localDescription || !config.remoteDescription) {
            console.warn(`Skipping restoration for peer ${config.peerId}: Missing local or remote description.`);
            continue;
          }

          const peerConnection = new RTCPeerConnection({ iceServers: config.iceServers });

          // Reattach event handlers
          peerConnection.onicecandidate = (event: RTCIceCandidateEvent<'icecandidate'>) => {
            if (event.candidate) {
              socket.current?.emit('messageOne', {
                target: config.peerId,
                from: peerIdRef.current,
                candidate: event.candidate,
              });
              const candidates = iceCandidatesRef.current.get(config.peerId) || [];
              candidates.push(event.candidate);
              iceCandidatesRef.current.set(config.peerId, candidates);
            }
          };

          peerConnection.oniceconnectionstatechange = () => {
            console.log(`ICE connection state for peer ${config.peerId}: ${peerConnection.iceConnectionState}`);
            if (peerConnection.iceConnectionState === "disconnected" || peerConnection.iceConnectionState === "failed" || peerConnection.iceConnectionState === "closed") {
              peerConnection.close();
              dhtRef.current?.closeDataChannel(config.peerId);
              chatDataChannelsRef.current.get(config.peerId)?.close();
            }
          };

          peerConnection.onconnectionstatechange = () => {
            if (peerConnection.connectionState === 'closed') {
              console.log(`Connection closed for peer ${config.peerId} - restored connection`);
              dhtRef.current?.closeDataChannel(config.peerId);
              chatDataChannelsRef.current.delete(config.peerId);
            }
          };

          peerConnection.ondatachannel = (event: RTCDataChannelEvent<'datachannel'>) => {
            const dataChannel: RTCDataChannel = event.channel;
            if (dataChannel.label === 'chat') {
              chatDataChannelsRef.current.set(config.peerId, dataChannel);
              initiateDBTable(config.peerId, dataChannel);
              receiveMessageFromChat(dataChannel, dhtRef.current!, setNotifyChat);
            } else if (dataChannel.label === 'signaling') {
              signalingDataChannelsRef.current.set(config.peerId, dataChannel);
              dataChannel.onmessage = async (event: MessageEvent) => {
                handleSignalingOverDataChannels(event, await profile, connectionsRef.current, createPeerConnection,
                  setPeers, signalingDataChannelsRef.current, dataChannel);
              };
            } else if (dataChannel.label === 'profile') {
              dataChannel.onopen = async () => {
                updatePeerStatus(config.peerId, 'open (restored)');
                const storedProfile = await AsyncStorage.getItem('userProfile');
                const profile = storedProfile ? JSON.parse(storedProfile) : null;
                if (profile) {
                  const profileMessage: ProfileMessage = {
                    profile: profile as Profile,
                    type: 'profile'
                  };
                  sendData(dataChannel, JSON.stringify(profileMessage));
                }
              };
              let receivedChunks: string[] = [];
              dataChannel.onmessage = (event: MessageEvent) => {
                if (event.data === 'EOF') {
                  const message = JSON.parse(receivedChunks.join('')) as ProfileMessage;
                  updatePeerProfile(config.peerId, message.profile);
                  receivedChunks = [];
                } else {
                  receivedChunks.push(event.data);
                }
              };
            } else if (dataChannel.label === 'pex') {
              dataChannel.onopen = async () => {
                await delay(3000);
                sendPEXRequest(dataChannel);
              };
              dataChannel.onmessage = (event: MessageEvent) => {
                handlePEXMessages(event, dataChannel, connectionsRef.current, peerIdRef.current!, initiateConnection, signalingDataChannelsRef.current.get(config.peerId)!);
              };
            } else if (dataChannel.label === 'dht') {
              dhtRef.current!.setUpDataChannel(config.peerId, dataChannel);
            }
          };

          // Restore descriptions based on local description type
          console.log(`Signaling state before restoration for peer ${config.peerId}: ${peerConnection.signalingState}`);

          if (config.localDescription.type === 'answer') {
            // Answerer: Set remote offer first, then local answer
            try {
              await peerConnection.setRemoteDescription(new RTCSessionDescription(config.remoteDescription));
              console.log(`Restored remote description (offer) for peer ${config.peerId}`);
            } catch (error) {
              console.error(`Error setting remote description for peer ${config.peerId}:`, error);
              continue;
            }

            try {
              await peerConnection.setLocalDescription(new RTCSessionDescription(config.localDescription));
              console.log(`Restored local description (answer) for peer ${config.peerId}`);
            } catch (error) {
              console.error(`Error setting local description for peer ${config.peerId}:`, error);
              continue;
            }
          } else if (config.localDescription.type === 'offer') {
            // Offerer: Set local offer first, then remote answer
            try {
              await peerConnection.setLocalDescription(new RTCSessionDescription(config.localDescription));
              console.log(`Restored local description (offer) for peer ${config.peerId}`);
            } catch (error) {
              console.error(`Error setting local description for peer ${config.peerId}:`, error);
              continue;
            }

            try {
              await peerConnection.setRemoteDescription(new RTCSessionDescription(config.remoteDescription));
              console.log(`Restored remote description (answer) for peer ${config.peerId}`);
            } catch (error) {
              console.error(`Error setting remote description for peer ${config.peerId}:`, error);
              continue;
            }
          } else {
            console.warn(`Invalid local description type for peer ${config.peerId}: ${config.localDescription.type}`);
            continue;
          }

          // Restore ICE candidates
          if (config.iceCandidates && config.iceCandidates.length) {
            for (const candidate of config.iceCandidates) {
              try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                console.log(`Restored ICE candidate for peer: ${config.peerId}`);
              } catch (error) {
                console.error(`Error adding ICE candidate for peer ${config.peerId}:`, error);
              }
            }
          } else {
            console.log(`No ICE candidates to restore for peer ${config.peerId}`);
          }

          connectionsRef.current.set(config.peerId, peerConnection);
          iceCandidatesRef.current.set(config.peerId, config.iceCandidates);

          // Restart ICE to attempt reconnection
          try {
            peerConnection.restartIce();
            console.log(`Restarted ICE for peer: ${config.peerId}`);
          } catch (error) {
            console.error(`Error restarting ICE for peer ${config.peerId}:`, error);
          }

          setPeers((prev) => {
            if (!prev.some((peer) => peer.id === config.peerId)) {
              return [...prev, { id: config.peerId, status: 'reconnecting' }];
            }
            return prev;
          });
        } catch (error) {
          console.error(`Error restoring connection for peer ${config.peerId}:`, error);
        }
      }
    } catch (error) {
      console.error('Error restoring connections from storage:', error);
    }
  };


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
        dhtRef.current!.setUpDataChannel(targetPeer.peerId, dataChannel)
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
        const candidates = iceCandidatesRef.current.get(targetPeer.peerId) || [];
        candidates.push(event.candidate);
        iceCandidatesRef.current.set(targetPeer.peerId, candidates);
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log(`ICE connection state: ${peerConnection.iceConnectionState}`);
      if (peerConnection.iceConnectionState === "failed" || peerConnection.iceConnectionState === "disconnected") {
        peerConnection.restartIce();
      } else if (peerConnection.iceConnectionState === "closed") {
        peerConnection.close();
        dhtRef.current?.closeDataChannel(targetPeer.peerId);
        chatDataChannelsRef.current.get(targetPeer.peerId)?.close;
      }
    };

    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === 'closed') {
        console.log("Connection closed - answer side")
        dhtRef.current?.closeDataChannel(targetPeer.peerId);
        chatDataChannelsRef.current.delete(targetPeer.peerId);
      }
    };

    const originalClose = peerConnection.close.bind(peerConnection);
    peerConnection.close = () => {
      peerConnection.ondatachannel = undefined;
      peerConnection.onicecandidate = undefined;
      peerConnection.oniceconnectionstatechange = undefined;
      originalClose();
    };  

    connectionsRef.current.set(targetPeer.peerId, peerConnection);
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
      await delay(3000);
      sendPEXRequest(pexDataChannel);
    };
    pexDataChannel.onmessage = async (event: MessageEvent) => {
      handlePEXMessages(event, pexDataChannel, connectionsRef.current, peerIdRef.current!, initiateConnection, signalingDataChannelsRef.current.get(targetPeer.peerId)!);
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
        console.log("Connection closed - offer side")
        dhtRef.current?.closeDataChannel(targetPeer.peerId);
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

  const updatePeerProfile = (peerId: string, profile: Profile): void => {
    setPeers((prevPeers) => prevPeers.map((peer) => (peer.id === peerId ? { ...peer, profile } : peer)));
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

        console.log(resolvedProfile.peerId)
  
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

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        saveConnectionsToStorage();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      socket.current?.disconnect();
      saveConnectionsToStorage();
      subscription.remove();
      Object.values(connectionsRef.current).forEach((pc) => pc.close());
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }
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

  const restartIceCandidates = (peerId: string): void => {
    let connection = connectionsRef.current.get(peerId);
    connection?.restartIce();
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
    restoreConnectionsFromStorage,
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