import { useFonts } from 'expo-font';
import { router, SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme } from '@/hooks/useColorScheme';
import { WebRTCProvider } from '../contexts/WebRTCContext';
import React from 'react';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { install } from 'react-native-quick-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Define types for your navigation stack
type RootStackParamList = {
  "chat/[peerId]": { username?: string };
};

export default function RootLayout() {
  const signalingServerURL = process.env.EXPO_PUBLIC_SIGNALING_SERVER_URL;
  const TOKEN = process.env.EXPO_PUBLIC_SIGNALING_SERVER_TOKEN;
  const TURN_PASSWORD = process.env.EXPO_PUBLIC_TURN_PASSWORD;
  const TURN_SERVER_URL = process.env.EXPO_PUBLIC_TURN_SERVER_URL;

  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    // SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    'Rubik-Regular': require('../assets/fonts/Rubik-Regular.ttf'),
    'Rubik-Bold': require('../assets/fonts/Rubik-Bold.ttf'),
  });

  const [isProfile, setIsProfile] = useState<boolean>();

  useEffect(() => {
    const loadProfile = async () => {
      const userProfile = await AsyncStorage.getItem("userProfile");
      if(userProfile){
        // alert("Profile")
        setIsProfile(true)
      }else{
        // alert("no Profile")
        setIsProfile(false)
      }
    };
    loadProfile();
  }, [loaded]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  const iceServers: RTCIceServer[] = [
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
    { urls: TURN_SERVER_URL!, username: "webrtc-react-native-demo", credential: TURN_PASSWORD }
  ];

  install();

  return (
    <WebRTCProvider signalingServerURL={signalingServerURL!} token={TOKEN!} iceServersList={iceServers}>
      <>
        {/* Define your stack navigator */}
        <KeyboardProvider>
        <Stack>
          <Stack.Screen
            name="(tabs)"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="chat/[peerId]"
            options={({ route }) => ({
              headerShown: true,
              headerTitle: (route.params as RootStackParamList["chat/[peerId]"])?.username || "Chat",
              headerBackTitle: 'Back',
              headerTintColor: '#fff',
              headerStyle: {
                backgroundColor: 'black',
              },
              headerTitleStyle: {
                fontSize: 20,
              },
            })}
          />
          <Stack.Screen name="+not-found" options={{ title: 'Not Found' }} />
        </Stack>
        </KeyboardProvider>
        <StatusBar style="auto" />
      </>
    </WebRTCProvider>
  );
}
