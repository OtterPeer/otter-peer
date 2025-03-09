import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from 'react-native-webrtc';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initSocket, sendData, getConnections, addChatDataChannel, removeConnection } from './webrtcService';
import { io } from 'socket.io-client';
import uuid from 'react-native-uuid';
import { useRouter } from "expo-router";
import crypto from 'react-native-quick-crypto';
import { Buffer } from "buffer";

const WebRTCContext = createContext();

export const WebRTCProvider = ({ children, signalingServerURL, token, iceServersList }) => {
  const [peers, setPeers] = useState([]); // List of peers with connection status
  const connections = {}; // Map to hold RTCPeerConnection objects
  const [profile, setProfile] = useState(null);
  const router = useRouter();
  const socket = io(signalingServerURL, {
    auth: {
      token: token,
    },
  });
  const peerIdRef = useRef(null);
  const chatDataChannelsRef = useRef(new Map());
  const chatMessagesRef = useRef(new Map());

  const iceServers = iceServersList;

  const createPeerConnection = (peerId) => {
    const peerConnection = new RTCPeerConnection({ iceServers });

    peerConnection.ondatachannel = (event) => {
      const dataChannel = event.channel;
      if (dataChannel.label === 'chat') {
        chatDataChannelsRef.current.set(peerId, dataChannel); // can be used for sending messages? (to discuss)
        receiveMessageFromChat(peerId, dataChannel)

      } else if (dataChannel.label === 'profile') {
        dataChannel.onopen = async () => {
          updatePeerStatus(peerId, 'open (answer side)');

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
      }
    };

    peerConnection.onicecandidate = (event) => {
      console.log("Sending ice cadidates");
      if (event.candidate) {
        socket.emit('messageOne', { target: peerId, from: peerIdRef.current, candidate: event.candidate });
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log(`ICE connection state: ${peerConnection.iceConnectionState}`);
    };

    return peerConnection;
  };

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

  const initiateConnection = async (peerId) => {
    const peerConnection = createPeerConnection(peerId);
    connections[peerId] = peerConnection;

    const chatDataChannel = peerConnection.createDataChannel('chat');
    chatDataChannelsRef.current.set(peerId, chatDataChannel);
    receiveMessageFromChat(peerId, chatDataChannel);

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
    // dataChannel.onmessage = (event) => {
    //   console.log("recieved message on datachannel - offer side" + message)
    //   const message = JSON.parse(event.data);
    //   if (message.type === 'profile') {
    //     console.log("received message with profile: " + JSON.stringify(message));
    //     console.log("Received profile from peer:", message.profile.name);
    //     updatePeerProfile(peerId, message.profile); // Update the peer's profile in your state
    //   }
    // };



    // peerConnection.ondatachannel = (event) => {
    //   const dataChannel = event.channel;
    //   console.log("Data channel received:", dataChannel.label);

    //   if (dataChannel.label === 'chat') {
    //     dataChannel.onmessage = (event) => {
    //       console.log("Message on 'chat' channel:", event.data);
    //     };
    //   }
    // };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('messageOne', { target: peerId, from: peerIdRef.current, offer });

    setPeers((prev) => {
      if (prev.some((peer) => peer.id === peerId)) {
          return prev;
      }
      return [...prev, { id: peerId, status: 'connecting' }];
    });
  };

  // const sendMessageChatToPeer = (peerId, message) => {
  //   const dataChannel = chatDataChannelsRef.current.get(peerId);
  //   if (dataChannel?.readyState === 'open') {
  //     dataChannel.send(message);
  //     console.log(`Message sent to peer ${peerId}: ${message}`);

  //     const messageData = {
  //       timestamp: new Date().getTime(),
  //       senderId: peerIdRef.current,
  //       message: message,
  //       id: uuid.v4(),
  //     };

  //     chatMessagesRef.current.set(peerId, [
  //       ...(chatMessagesRef.current.get(peerId) || []),
  //       messageData,
  //     ]);
  //   } else {
  //     console.log(`Data channel for peer ${peerId} is not ready`);
  //   }
  // };
  
  // const receiveMessageFromChat = (peerId, dataChannel) => {
  //   dataChannel.onmessage = async (event) => {
  //     console.log("Odebrana wiadomość:", event.data);
  //     try {
  //       const message = event.data;
  //       const messageData = {
  //         timestamp: new Date().getTime(),
  //         senderId: peerId,
  //         message,
  //         id: uuid.v4(),
  //       };
  
  //       const currentMessages = chatMessagesRef.current.get(peerId) || [];
  //       const updatedMessages = [...currentMessages, messageData];
  //       chatMessagesRef.current.set(peerId, updatedMessages);
  
  //       await AsyncStorage.setItem(`chatMessages_${peerId}`, JSON.stringify(updatedMessages));
  //       console.log(chatMessagesRef.current.get(peerId));
  //     } catch (error) {
  //       console.log("Error receiving message:", error);
  //     }
  //   };
  // };

  const sendMessageChatToPeer = (peerId, message, peerPublicKey) => {
    const dataChannel = chatDataChannelsRef.current.get(peerId);

    if (!peerPublicKey) {
        console.error(`❌ Nie można pobrać klucza publicznego.`);
        return;
      }

    if (dataChannel?.readyState === 'open') {
      const encryptedMessage = crypto.publicEncrypt(peerPublicKey, Buffer.from(message)).toString("base64");
      dataChannel.send(encryptedMessage);
      console.log(`Message sent to peer ${peerId}: ${message}`);
      console.log(`encryptedMessage sent to peer ${peerId}: ${encryptedMessage}`);

      const messageData = {
        timestamp: new Date().getTime(),
        senderId: peerIdRef.current,
        message: message,
        id: uuid.v4(),
      };

      chatMessagesRef.current.set(peerId, [
        ...(chatMessagesRef.current.get(peerId) || []),
        messageData,
      ]);
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
      console.log("MESSAGE RECEIVED: receiveMessageFromChat from WebRTCContext.jsx")
      const decryptedMessage = crypto.privateDecrypt(privateKey, Buffer.from(event.data, "base64")).toString();
      console.log("Got message: ", event.data);
      console.log("Got decryptedMessage:", decryptedMessage);
      // message = event.data;
      try {
        const messageData = {
          timestamp: new Date().getTime(),
          senderId: peerId,
          message: decryptedMessage,
          id: uuid.v4(),
        };
  
        const currentMessages = chatMessagesRef.current.get(peerId) || [];
        const updatedMessages = [...currentMessages, messageData];
        chatMessagesRef.current.set(peerId, updatedMessages);
  
        await AsyncStorage.setItem(`chatMessages_${peerId}`, JSON.stringify(updatedMessages));
        console.log(chatMessagesRef.current.get(peerId));
      } catch (error) {
        console.log("Error receiving message:", error);
      }
    };
  };

  // const sendMessageChatToPeer = async (peerId, message) => {
  //   const dataChannel = chatDataChannelsRef.current.get(peerId);

  //   // Pobranie profilu Peera B
  //   const storedProfile = await AsyncStorage.getItem(`userProfile_${peerId}`);
  //   if (!storedProfile) {
  //     console.error(`❌ Brak profilu dla Peera ${peerId}. Nie można pobrać klucza publicznego.`);
  //     return;
  //   }

  //   const { publicKey: peerPublicKey } = JSON.parse(storedProfile);
  //   if (!peerPublicKey) {
  //     console.error(`❌ Brak klucza publicznego w profilu Peera ${peerId}.`);
  //     return;
  //   }

  //   try {
  //     // Szyfrowanie wiadomości kluczem publicznym Peera B
  //     const encryptedMessage = crypto.publicEncrypt(peerPublicKey, Buffer.from(message)).toString("base64");

  //     console.log(`🔒 Wysyłanie zaszyfrowanej wiadomości do Peera ${peerId}:`, encryptedMessage);

  //     if (dataChannel?.readyState === 'open') {
  //       dataChannel.send(encryptedMessage);
  //       console.log(`Message sent to peer ${peerId}: ${message}`);

  //       const messageData = {
  //         timestamp: new Date().getTime(),
  //         senderId: peerIdRef.current,
  //         message: encryptedMessage,
  //         id: uuid.v4(),
  //       };

  //       chatMessagesRef.current.set(peerId, [
  //         ...(chatMessagesRef.current.get(peerId) || []),
  //         messageData,
  //       ]);
  //     } else {
  //       console.log(`Data channel for peer ${peerId} is not ready`);
  //     }
  //   } catch (error) {
  //     console.error("❌ Błąd szyfrowania wiadomości:", error);
  //   }
  // };
  
  // const receiveMessageFromChat = async (peerId, dataChannel) => {
  //   dataChannel.onmessage = async (event) => {
  //     const encryptedMessage = event.data;
  //     console.log("📥 Otrzymano zaszyfrowaną wiadomość:", encryptedMessage);
  
  //     // Pobranie klucza prywatnego użytkownika
  //     const storedPrivateKey = await AsyncStorage.getItem("privateKey");
  //     if (!storedPrivateKey) {
  //       console.error("❌ Brak prywatnego klucza. Nie można odszyfrować wiadomości.");
  //       return;
  //     }
  
  //     try {
  //       // Odszyfrowanie wiadomości
  //       const decryptedMessage = crypto.privateDecrypt(storedPrivateKey, Buffer.from(encryptedMessage, "base64")).toString();
  //       console.log("🔓 Odszyfrowana wiadomość:", decryptedMessage);
  
  //       const messageData = {
  //         timestamp: new Date().getTime(),
  //         senderId: peerId,
  //         decryptedMessage,
  //         id: uuid.v4(),
  //       };
  
  //       const currentMessages = chatMessagesRef.current.get(peerId) || [];
  //       chatMessagesRef.current.set(peerId, [...currentMessages, messageData]);
  
  //       await AsyncStorage.setItem(`chatMessages_${peerId}`, JSON.stringify(chatMessagesRef.current.get(peerId)));
  //     } catch (error) {
  //       console.error("❌ Błąd podczas odszyfrowywania wiadomości:", error);
  //     }
  //   };
  // };  
  
  const handleOffer = async (sdp, sender) => {
    const peerConnection = createPeerConnection(sender);
    connections[sender] = peerConnection;
    await peerConnection.setRemoteDescription(sdp);
    console.log("remote description set")
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit('messageOne', { target: sender, from: peerIdRef.current, answer });
    console.log("message emitted: " + answer)


    setPeers((prev) => {
      if (prev.some((peer) => peer.id === sender)) {
          return prev;
      }
      return [...prev, { id: sender, status: 'connecting' }];
    });
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
    socket.on('message', (message) => {
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
        } else if(message?.offer) {
          console.log("type present")
          const offer = message.offer
          const from = message.from
          console.log("sdp:" + offer.sdp)
          handleOffer(offer, from);
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
      } else if (message.target === "all"){
        if (message.payload?.action === 'close') {
          const disconnectingPeerId = message.from;
          console.log(`Peer disconnected: ${disconnectingPeerId}`);
    
          if (connections[disconnectingPeerId]) {
            connections[disconnectingPeerId].close();
            delete connections[disconnectingPeerId];
          }
    
          setPeers((prev) => prev.filter((peer) => peer.id !== disconnectingPeerId));
        }
      } else {
        console.log('Message not intended for this peer, ignoring.');
      }
    });

    // socket.on('receivePublicKey', ({ peerId, publicKey }) => {
    //   if (!publicKeys.has(peerId)) {
    //     publicKeys.set(peerId, publicKey);
    //     console.log(`📥 Otrzymano i zapisano klucz publiczny Peera ${peerId}`);
    //   } else {
    //     console.log(`✅ Klucz publiczny Peera ${peerId} już istnieje`);
    //   }
    // });    

    socket.on('connect', () => {
      console.log('Connected to signaling server123');
      const generatedPeerId = uuid.v4()
      peerIdRef.current = generatedPeerId;
      console.log("emitting ready event with peerId: " + generatedPeerId);
      socket.emit('ready', generatedPeerId, 'type-emulator');

      // if (keys.publicKey) {
      //   socket.emit('sendPublicKey', { peerId: peerIdRef.current, publicKey: keys.publicKey });
      //   console.log("🔑 Public key wysłany do serwera:", keys.publicKey);
      // } else {
      //   console.error("❌ Klucz publiczny nie jest jeszcze dostępny!");
      // }
    });

    return () => {
      // socket.off('receivePublicKey');
      socket.disconnect();
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
              chatMessagesRef,
          }}
      >
          {children}
      </WebRTCContext.Provider>
  );
};

export const useWebRTC = () => useContext(WebRTCContext);