import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from 'react-native-webrtc';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initSocket, sendData, getConnections, addChatDataChannel, removeConnection } from './webrtcService';
import { getSocket, disconnectSocket } from "./socket";
import uuid from 'react-native-uuid';
import { useRouter } from "expo-router";
import crypto from 'react-native-quick-crypto';
import { Buffer } from "buffer";
import SQLite from 'react-native-sqlite-storage';
import { saveMessageToDB, fetchMessagesFromDB } from '../app/chat/chatUtils';

const WebRTCContext = createContext();

export const WebRTCProvider = ({ children, signalingServerURL, token, iceServersList }) => {
  const [peers, setPeers] = useState([]); // List of peers with connection status
  const connections = {}; // Map to hold RTCPeerConnection objects
  const [profile, setProfile] = useState(null);
  const router = useRouter();
  const socket= useRef(null);
  const peerIdRef = useRef(null);
  const chatDataChannelsRef = useRef(new Map());
  const signalingDataChannelsRef = useRef(new Map());
  
  const chatMessagesRef = useRef(new Map());
  const [notifyChat, setNotifyChat] = useState(0);

  const iceServers = iceServersList;

  const createPeerConnection = (peerId, signalingDataChannel = null) => {
    const peerConnection = new RTCPeerConnection({ iceServers });

    peerConnection.ondatachannel = (event) => {
      const dataChannel = event.channel;
      if (dataChannel.label === 'chat') {
        chatDataChannelsRef.current.set(peerId, dataChannel);
        receiveMessageFromChat(peerId, dataChannel)

      } else if (dataChannel.label === 'profile') {
        // let receivedChunks = [];
        dataChannel.onopen = async () => {
          updatePeerStatus(peerId, 'open (answer side)');

          // todo use common function for offer and answer side
          const storedProfile = await AsyncStorage.getItem("userProfile");
          const profile = JSON.parse(storedProfile)// todo: use existing profile variable - we need to be sure that it was initialized first
          try {
            if (profile !== null) {
              console.log("Sending profile from offer side...");
              sendData(dataChannel, JSON.stringify({ type: 'profile', profile }))
            }
          } catch (error) {
            console.error("Error while sending profile:", error);
          }
        };
        dataChannel.onclose = (event) => {
          updatePeerStatus(peerId, 'closed');
          console.log("answer side received close event: " + event);
        }
        let receivedChunks = [];
        let receivingFile = false;

        dataChannel.onmessage = (event) => {
            if (event.data === 'EOF') {
                const receivedFile = new Blob(receivedChunks); // Combine all chunks
                console.log('File received successfully');
                const message = JSON.parse(receivedChunks)
                updatePeerProfile(peerId, message.profile)

                receivedChunks = [];
                receivingFile = false;
            } else {
                receivedChunks.push(event.data);
            }
        };
      } else if (dataChannel.label === 'pex') {
        dataChannel.onopen = async () => {
          console.log("PEX datachannel openned");
          await delay(3000);
          sendPEXRequest(dataChannel);
        }
        dataChannel.onmessage = (event) => {
          console.log("Received pex message");
          // handlePEXMessages(event, dataChannel, signalingDataChannelsRef.current.get(peerId));
          handlePEXMessages(event, dataChannel, signalingDataChannelsRef.current.get(peerId));
        };
      } else if (dataChannel.label === 'signaling') {
        dataChannel.onopen = () => {
          console.log("Signaling channel opened with peer: " + peerId)
          signalingDataChannelsRef.current.set(peerId, dataChannel);
        }

        dataChannel.onmessage = async (event) => {
          console.log("recieved message on signalingDataChannel - answer side" + event);
          handleSignalingOverDataChannels(event, dataChannel);
        };
      }
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        if (signalingDataChannel == null) {
          console.log("Sending ice cadidates");
          socket.current.emit('messageOne', { target: peerId, from: peerIdRef.current, candidate: event.candidate });
        } else {
          console.log("Sending ice candidates through DataChannel");
          signalingDataChannel.send(JSON.stringify({ target: peerId, from: peerIdRef.current, candidate: event.candidate }));
        }
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log(`ICE connection state: ${peerConnection.iceConnectionState}`);
    };

    return peerConnection;
  };

  /**
  * Initiates connection (and sends offer) to specified peerId
  * Offer is send over specified signalingDataChannel, or using Signaling Server if no datachannel
  * is provided as an argument
  */
  const initiateConnection = async (peerId, dataChannelUsedForSignaling = null) => {
    const peerConnection = createPeerConnection(peerId, dataChannelUsedForSignaling);
    connections[peerId] = peerConnection;

    const chatDataChannel = peerConnection.createDataChannel('chat');
    chatDataChannelsRef.current.set(peerId, chatDataChannel);
    receiveMessageFromChat(peerId, chatDataChannel);

    const signalingDataChannel = peerConnection.createDataChannel('signaling');
    signalingDataChannel.onopen = () => {
      signalingDataChannelsRef.current.set(peerId, signalingDataChannel);
    };

    signalingDataChannel.onmessage = (event) => {
      console.log("recieved message on signalingDataChannel - offer side" + event);

      handleSignalingOverDataChannels(event, signalingDataChannel);
    };

    const pexDataChannel = peerConnection.createDataChannel('pex');
    pexDataChannel.onopen = async () => {
      await delay(3000);
      sendPEXRequest(pexDataChannel);
    };

    pexDataChannel.onmessage = async (event) => {
      handlePEXMessages(event, pexDataChannel, signalingDataChannelsRef.current.get(peerId));
    };

    const profileDataChannel = peerConnection.createDataChannel('profile');

    profileDataChannel.onopen = async () => {
      updatePeerStatus(peerId, 'open (offer side)');

      await shareProfile(sendData, profileDataChannel);
    };
    profileDataChannel.onclose = (event) => {
      console.log("offer side received close event: " + event);
      updatePeerStatus(peerId, 'closed');
      chatDataChannelsRef.current.delete(peerId);
    }

    let receivedChunks = [];
    profileDataChannel.onmessage = (event) => {
        if (event.data === 'EOF') {
            console.log('File received successfully');
            const message = JSON.parse(receivedChunks)
            updatePeerProfile(peerId, message.profile)

            receivedChunks = [];
        } else {
            receivedChunks.push(event.data);
        }
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    if (dataChannelUsedForSignaling == null) {
      socket.current.emit('messageOne', { target: peerId, from: peerIdRef.current, offer });
    } else {
      console.log("Sending offer through DataChannel");
      dataChannelUsedForSignaling.send(JSON.stringify({ target: peerId, from: peerIdRef.current, offer }));
      // sendData(dataChannelForSignaling, JSON.stringify());
    }

    setPeers((prev) => {
      if (prev.some((peer) => peer.id === peerId)) {
          return prev;
      }
      return [...prev, { id: peerId, status: 'connecting' }];
    });
  };

  /**
  * Signaling over DataChannels: Handler
  * Handles messages received on signalingDataChannel
  */
  const handleSignalingOverDataChannels = (event, signalingDataChannel) => {
    var message = JSON.parse(event.data);
    if (message.target === peerIdRef.current) {
      console.log("Signaling over datachannels reached its destination. Handling request: " + JSON.stringify(message));
      handleWebRTCSignaling(message, signalingDataChannel);
    } else {
      targetPeer = Object.keys(connections).find(
        (peerId) => peerId === message.target
      );
      if (targetPeer) {
        console.log("proxing signaling over dataChannels. Sending request to peer: " + targetPeer);
        console.log(targetPeer);
        const dataChannelToRecepientPeer = signalingDataChannelsRef.current.get(targetPeer);
        if (dataChannelToRecepientPeer?.readyState === 'open') {
          console.log("sending signaling over dataChannels to peer" + targetPeer)
          dataChannelToRecepientPeer.send(JSON.stringify(message));
        } else {
          console.warn("Signaling DataChannel to not open to peer: " + targetPeer)
        }
        // sendData(dataChannelToRecepientPeer, message);
      } else {
        // todo, use DHT to find the target
      }
    }
  }

  /**
  * Common handler for WebRTC Signaling messages
  * Uses specified signalingDataChannel or Signaling Server if no datachannel is provided as an argument
  */
  const handleWebRTCSignaling = (message, dataChannelForSignaling = null) => {
    console.log(message);
    if(message?.offer) {
      console.log("type present")
      const offer = message.offer
      const from = message.from
      console.log("sdp:" + offer.sdp)
      handleOffer(offer, from, dataChannelForSignaling);
    } else if (message?.answer) {
      const from = message.from;
      console.log("Recieved answer from: " + from)
      if (connections[from]) {
        connections[from].setRemoteDescription(message.answer);
        console.log("remote description set for answer")
      }
    } else if (message?.candidate) {
      if (connections[message.from]) {
        connections[message.from].addIceCandidate(new RTCIceCandidate(message.candidate))
        .then(() => console.log('ICE candidate added successfully'))
        .catch((e) => console.error('Error adding ICE candidate:', e));
        console.log(connections[message.from].iceServers)
      }
    }
  }

  const handleOffer = async (sdp, sender, channelUsedForSignaling = null) => {
    const peerConnection = createPeerConnection(sender, channelUsedForSignaling);
    connections[sender] = peerConnection;
    await peerConnection.setRemoteDescription(sdp);
    console.log("remote description set")
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    if (channelUsedForSignaling == null) {
      socket.current.emit('messageOne', { target: sender, from: peerIdRef.current, answer });
    } else {
      console.log("Sending answer using signaling over datachannels to peer: " + sender);
      channelUsedForSignaling.send(JSON.stringify({ target: sender, from: peerIdRef.current, answer }));
    }
    console.log("message emitted: " + answer)


    setPeers((prev) => {
      if (prev.some((peer) => peer.id === sender)) {
          return prev;
      }
      return [...prev, { id: sender, status: 'connecting' }];
    });
  };

  /**
  * Peer Exchange Protocol: Handler
  * Common handler for messages received on pexDataChannel
  */
  const handlePEXMessages = (event, pexDataChannel, signalingDataChannel) => {
    console.log("Inside handlePEXMessages function");
    try {
      const message = JSON.parse(event.data);

      console.log("Handling pex message. Signaling datachannel: " + signalingDataChannel)
      if (message.type === 'request') {
        shareConnectedPeers(pexDataChannel, message);
      } else if (message.type === 'advertisement') {
        const receivedPeers = message.peers;
        const tableOfPeers = [];

        console.log("received pex advertisement message");

        if (Array.isArray(receivedPeers)) {
          receivedPeers.forEach((peerId) => {
            const alreadyConnected = Object.keys(connections).some((id) => id === peerId);

            if (
              !tableOfPeers.includes(peerId) &&
              !alreadyConnected &&
              peerId !== peerIdRef.current
            ) {
              tableOfPeers.push(peerId);
            }
          });
        }

        console.log("received peers from pex: " + tableOfPeers);

        tableOfPeers.forEach((peerId) => {
          initiateConnection(peerId, signalingDataChannel);
        });
      }
    } catch (error) {
      console.error('Error handling PEX request:', error);
    }
  }

  /**
  * Peer Exchange Protocol: Request
  * Requests information about peers known to already connected peer with pexDataChannel
  */
  const sendPEXRequest = (pexDataChannel) => {
    console.log("Sending PEX request");
    var requestMessage = {
      type: "request",
      maxNumberOfPeers: 20
    }

    try {
      pexDataChannel.send(JSON.stringify(requestMessage));
    } catch (error) {
      console.log("Couldn't send pex request: " + error);
    }
  }

  /**
  * Peer Exchange Protocol: Ansewer (advertisement)
  * Shares peerIds of currently connetect (known) peers
  */
  const shareConnectedPeers = (pexDataChannel, message) => {
    // const requestsNumberOfPeers = message.maxNumberOfPeers; // todo: allow requesting peer to request given number of peers
    const peersToShare = new Set();
    console.log(connections);
    console.log(peers);

    if (Object.keys(connections).length !== 0){
      Object.keys(connections).forEach(peerId => {
        peersToShare.add(peerId);
        console.log("Adding peer to be shared: " +peerId)
      });
    }

    const answer = {
      type: 'advertisement',
      peers: Array.from(peersToShare),
    };
    console.log("sending pex adverisement message with following peers: " + JSON.stringify(answer));
    pexDataChannel.send(JSON.stringify(answer));
    // sendData(pexDataChannel, JSON.stringify(answer)); //todo: add unified solution for sending messages over datachannels with chunking etc
  };

  const sendMessageChatToPeer = (peerId, messageData, peerPublicKey) => {
    const dataChannel = chatDataChannelsRef.current.get(peerId);
  
    if (!peerPublicKey) {
      console.error(`❌ Nie można pobrać klucza publicznego.`);
      return;
    }
  
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

  const receiveMessageFromChat = async (peerId, dataChannel) => {

    const privateKey = await AsyncStorage.getItem("privateKey");
    if (!privateKey) {
      console.error("❌ Brak prywatnego klucza. Nie można odszyfrować wiadomości.");
      return;
    }
  
    dataChannel.onmessage = async (event) => {
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
  
        saveMessageToDB(decryptedMessageData, decryptedMessageData.senderId); // Save the decrypted version to DB
  
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

  function handleChunkedMessages(event, receivedChunks, onComplete) {
    if (event.data === 'EOF') {
      const receivedFile = new Blob(receivedChunks);
      console.log('File received successfully');
      onComplete(JSON.parse(receivedFile));
      receivedChunks.length = 0;
    } else {
      receivedChunks.push(event.data);
    }
  }

  const updatePeerStatus = (peerId, status) => {
    setPeers((prev) =>
      prev.map((peer) =>
        peer.id === peerId ? { ...peer, status } : peer
      )
    );
  };

  const updatePeerProfile = (peerId, profile) => {
    setPeers((prevPeers) =>
      prevPeers.map((peer) =>
        peer.id === peerId ? { ...peer, profile } : peer
      )
    );
  };

  useEffect(() => {
    // AsyncStorage.removeItem("userProfile");
    const fetchProfile = async () => {
      try {
        const storedProfile = await AsyncStorage.getItem("userProfile");
        // console.log("Raw stored profile: ", storedProfile);
        if (storedProfile) {
          setProfile(JSON.parse(storedProfile));
        } else {
          console.log("navigating to profile page");
          router.push("/profile");
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      }
    };

    fetchProfile();
  }, []);

  useEffect(() => {
    socket.current = getSocket(signalingServerURL, token);

    socket.current.on('message', (message) => {
      console.log('Received event: message', message);
      console.log("message target: " + message.target);
      console.log("message target: " + message.payload);
      console.log("peerId: " + peerIdRef.current);
      console.log(message.target === peerIdRef.current)
      if (message.target === peerIdRef.current) {  
        if (message.payload?.connections) {
          const connections = message.payload.connections;
          console.log('Extracted connections:', connections);
  
          connections.forEach((peer) => {
            const peerId = peer.peerId;
            if (!connections[peerId]) {
              initiateConnection(peerId);
            }
          });
        } else {
          handleWebRTCSignaling(message);
        }
      } else if (message.target === "all"){
        if (message.payload?.action === 'close') {
          const disconnectingPeerId = message.from;
          console.log(`Peer disconnected from signaling server: ${disconnectingPeerId}`);
        }
      } else {
        console.log('Message not intended for this peer, ignoring.');
      }
    });

    socket.current.on('connect', () => {
      console.log('Connected to signaling server. SocketId: ' + socket.current.id);
      const generatedPeerId = uuid.v4()
      peerIdRef.current = generatedPeerId;
      console.log("emitting ready event with peerId: " + generatedPeerId);
      socket.current.emit('ready', generatedPeerId, 'type-emulator');
    });

    return () => {
      socket.current.disconnect();
      Object.values(connections).forEach((pc) => pc.close());
    };
  }, []);

  async function shareProfile(sendFile, dataChannel) {
    const storedProfile = await AsyncStorage.getItem("userProfile");
    const profile = JSON.parse(storedProfile);
    try {
      if (profile !== null) {
        console.log("Sending profile from offer side...");
        sendFile(dataChannel, JSON.stringify({ type: 'profile', profile }));
      }
    } catch (error) {
      console.error("Error while sending profile:", error);
    }
  }

  const disconnectFromWebSocket = () => {
    console.log("Disconnecting from signaling server. " + socket.current.id);
    disconnectSocket();
  }

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  return (
      <WebRTCContext.Provider
          value={{
              peers,
              setPeers,
              profile,
              setProfile,
              peerIdRef,
              socket: socket.current,
              connections: connections.current,
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
          }}
      >
          {children}
      </WebRTCContext.Provider>
  );
};

export const useWebRTC = () => useContext(WebRTCContext);