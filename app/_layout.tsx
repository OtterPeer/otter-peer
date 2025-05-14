import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useCallback } from 'react';
import { useColorScheme } from '@/hooks/useColorScheme';
import { WebRTCProvider } from '../contexts/WebRTCContext';
import { View, StyleSheet, Appearance } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { install } from 'react-native-quick-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// Set the duration of fade animation at the end of the splash screen
SplashScreen.setOptions({
  duration: 200,
  fade: true,
});

type RootStackParamList = {
  "chat/[peerId]": { username?: string };
};

export default function RootLayout() {
  const signalingServerURL = process.env.EXPO_PUBLIC_SIGNALING_SERVER_URL;
  const TOKEN = process.env.EXPO_PUBLIC_SIGNALING_SERVER_TOKEN;
  const TURN_PASSWORD = process.env.EXPO_PUBLIC_TURN_PASSWORD;
  const TURN_SERVER_URL = process.env.EXPO_PUBLIC_TURN_SERVER_URL;

  const colorScheme = useColorScheme();
  // ToDo: Delete this to be set as default of the phone settings or change how is it set in the settings
  Appearance.setColorScheme('dark');
  const [loaded] = useFonts({
    'Rubik-Regular': require('../assets/fonts/Rubik-Regular.ttf'),
    'Rubik-Bold': require('../assets/fonts/Rubik-Bold.ttf'),
  });
  const [isProfile, setIsProfile] = useState<boolean>();
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        const userProfile = await AsyncStorage.getItem("userProfile");
        setIsProfile(!!userProfile);
        // Set here after how many seconds do splash screen needs to disappear
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }
    if (loaded) {
      prepare();
    }
  }, [loaded]);

  // Hide splash screen after layout
  const onLayoutRootView = useCallback(async () => {
    if (appIsReady && loaded) {
      await SplashScreen.hideAsync();
    }
  }, [appIsReady, loaded]);

  if (!loaded || !appIsReady) {
    return null; // Keep splash screen visible
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
    { urls: TURN_SERVER_URL!, username: "webrtc-react-native-demo", credential: TURN_PASSWORD },
  ];

  install();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colorScheme === 'dark' ? '#161616' : '#FFFFFF' },
      ]}
      onLayout={onLayoutRootView}
    >
      <WebRTCProvider signalingServerURL={signalingServerURL!} token={TOKEN!} iceServersList={iceServers}>
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
          <StatusBar style="auto" />
        </KeyboardProvider>
      </WebRTCProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});