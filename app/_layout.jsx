// default code commented out:
// import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
// import { useFonts } from 'expo-font';
// import { Stack } from 'expo-router';
// import * as SplashScreen from 'expo-splash-screen';
// import { StatusBar } from 'expo-status-bar';
// import { useEffect } from 'react';
// import 'react-native-reanimated';

// import { useColorScheme } from '@/hooks/useColorScheme';

// // Prevent the splash screen from auto-hiding before asset loading is complete.
// SplashScreen.preventAutoHideAsync();

// export default function RootLayout() {
//   const colorScheme = useColorScheme();
//   const [loaded] = useFonts({
//     SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
//   });

//   useEffect(() => {
//     if (loaded) {
//       SplashScreen.hideAsync();
//     }
//   }, [loaded]);

//   if (!loaded) {
//     return null;
//   }

//   return (
//     <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
//       <Stack>
//         <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
//         <Stack.Screen name="+not-found" />
//       </Stack>
//       <StatusBar style="auto" />
//     </ThemeProvider>
//   );
// }


import React, { useEffect, useRef, useState } from 'react';
import { SafeAreaView, Text, FlatList, View, StyleSheet } from 'react-native';
import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from 'react-native-webrtc';
import io from 'socket.io-client';
import uuid from 'react-native-uuid';
import { StatusBar } from 'expo-status-bar';

// const signalingServerURL = 'http://10.0.2.2:3030';
const signalingServerURL = process.env.EXPO_PUBLIC_SIGNALING_SERVER_URL;
const TOKEN =  process.env.EXPO_PUBLIC_SIGNALING_SERVER_TOKEN;
const TURN_PASSWORD = process.env.EXPO_PUBLIC_TURN_PASSWORD;
const TURN_SERVER_URL = process.env.EXPO_PUBLIC_TURN_SERVER_URL

const iceServers = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun.l.google.com:5349" },
  { urls: "stun:stun1.l.google.com:3478" },
  { urls: "stun:stun1.l.google.com:5349" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:5349" },
  { urls: "stun:stun3.l.google.com:3478" },
  { urls: "stun:stun3.l.google.com:5349" },
  { urls: "stun:stun4.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:5349" },
  { urls: TURN_SERVER_URL, username: "webrtc-react-native-demo", credential: TURN_PASSWORD }
];


const RootLayout = () => {
  const [peers, setPeers] = useState([]); // List of peers with connection status
  const connections = {}; // Map to hold RTCPeerConnection objects
  const socket = io(signalingServerURL, {
    auth: {
      token: TOKEN,
    },
  });
  const peerIdRef = useRef(null);

  const createPeerConnection = (peerId) => {
    const peerConnection = new RTCPeerConnection({ iceServers });

    // Set up event handlers
    peerConnection.ondatachannel = (event) => {
      const dataChannel = event.channel;
      dataChannel.onopen = () => updatePeerStatus(peerId, 'open');
      dataChannel.onclose = () => updatePeerStatus(peerId, 'closed');
    };

    peerConnection.onicecandidate = (event) => {
      console.log("Sending ice cadidates");
      if (event.candidate) {
        socket.emit('messageOne', { target: peerId, from: peerIdRef.current, candidate: event.candidate });
      }
    peerConnection.oniceconnectionstatechange = () => {
      console.log(`ICE connection state: ${peerConnection.iceConnectionState}`);
    };
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

  const initiateConnection = async (peerId) => {
    const peerConnection = createPeerConnection(peerId);
    connections[peerId] = peerConnection;

    const dataChannel = peerConnection.createDataChannel('chat');
    dataChannel.onopen = () => updatePeerStatus(peerId, 'open');
    dataChannel.onclose = () => updatePeerStatus(peerId, 'closed');

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('messageOne', { target: peerId, from: peerIdRef.current, offer });

    setPeers((prev) => [...prev, { id: peerId, status: 'connecting' }]);
  };

  const handleOffer = async (sdp, sender) => {
    const peerConnection = createPeerConnection(sender);
    connections[sender] = peerConnection;
    await peerConnection.setRemoteDescription(sdp);
    console.log("remote description set")
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit('messageOne', { target: sender, from: peerIdRef.current, answer });
    console.log("message emitted: " + answer)

    setPeers((prev) => [...prev, { id: sender, status: 'connecting' }]);
  };

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

    socket.on('connect', () => {
      console.log('Connected to signaling server123');
      const generatedPeerId = uuid.v4()
      peerIdRef.current = generatedPeerId;
      console.log("emitting ready event with peerId: " + generatedPeerId);
      socket.emit('ready', generatedPeerId, 'type-emulator');
    });

    socket.on('connection', (peerList) => {
      console.log("recieved connections")
      console.log(peerList)
      peerList.forEach((peerId) => {
        if (!connections[peerId]) {
          initiateConnection(peerId);
        }
      });
    });

    socket.on('offer', async ({ offer, from }) => {
      console.log("Recieved offer from: " + from)
      await handleOffer(offer, from);
    });

    socket.on('answer', async ({ answer, from }) => {
      if (connections[from]) {
        await connections[from].setRemoteDescription(new RTCSessionDescription(answer, "answer"));
      }
    });

    socket.on('ice-candidate', async ({ candidate, from }) => {
      if (connections[from]) {
        await connections[from].addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    return () => {
      socket.disconnect();
      Object.values(connections).forEach((pc) => pc.close());
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle='light-content' />
      <Text style={styles.title}>Connected Peers</Text>
      <FlatList
        data={peers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.peerItem}>
            <Text style={styles.peerText}>
              {item.id}: {item.status}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#28292b',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: 'white',
  },
  peerItem: {
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    color: 'white',
  },
  peerText: {
    fontSize: 16,
    color: 'white',
  },
});

export default RootLayout;
