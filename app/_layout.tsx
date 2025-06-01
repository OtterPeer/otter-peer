import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, Appearance, Image } from 'react-native';
import { useWebRTC, WebRTCProvider } from '../contexts/WebRTCContext';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { install } from 'react-native-quick-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider, useTheme } from '../contexts/themeContext';
import { loadLanguage } from '@/contexts/languages/i18next';
import { fetchProfile } from '../contexts/profile';
import { Profile } from '../types/types';
import { EventEmitter } from "events";
import { NotificationProvider, useNotification } from '@/contexts/notificationContext/notificationContext';

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// Set the duration of fade animation at the end of the splash screen
SplashScreen.setOptions({
  duration: 200,
  fade: true,
});

type RootStackParamList = {
  'chat/[peerId]': { username?: string };
};

const profileEventEmitter = new EventEmitter();

export default function RootLayout() {
  // const signalingServerURL = "http://10.0.2.2:3030";
  const signalingServerURL = process.env.EXPO_PUBLIC_SIGNALING_SERVER_URL;
  const TOKEN = process.env.EXPO_PUBLIC_SIGNALING_SERVER_TOKEN;
  const TURN_PASSWORD = process.env.EXPO_PUBLIC_TURN_PASSWORD;
  const TURN_SERVER_URL = process.env.EXPO_PUBLIC_TURN_SERVER_URL;

  const [loaded] = useFonts({
    'Rubik-Regular': require('../assets/fonts/Rubik-Regular.ttf'),
    'Rubik-Bold': require('../assets/fonts/Rubik-Bold.ttf'),
  });
  const [appIsReady, setAppIsReady] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    const handleProfileDeleted = () => {
      console.log('Profile deleted, resetting layout');
      setAppIsReady(false); // Reset appIsReady to trigger remount
      setResetKey((prev) => prev + 1); // Increment to force useEffect rerun
    };

    profileEventEmitter.on('profileDeleted', handleProfileDeleted);

    return () => {
      profileEventEmitter.off('profileDeleted', handleProfileDeleted);
    };
  }, []);

  useEffect(() => {
    loadLanguage();
  }, []);

  useEffect(() => {
    if (loaded) {
      setAppIsReady(true);
    }
  }, [loaded, resetKey]);

  // Hide splash screen after layout
  const onLayoutRootView = useCallback(async () => {
    if (appIsReady && loaded) {
      console.log("Hiding splash screen")
      await SplashScreen.hideAsync();
    }
  }, [appIsReady, loaded]);


  if (!loaded || !appIsReady) {
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
    { urls: TURN_SERVER_URL!, username: "webrtc-react-native-demo", credential: TURN_PASSWORD },
  ];

  install();

  return (
    <NotificationProvider>
      <ThemeProvider>
        <RootLayoutContent iceServers={iceServers} signalingServerURL={signalingServerURL!} token={TOKEN!} onLayoutRootView={onLayoutRootView} />
      </ThemeProvider>
    </NotificationProvider>
  );
}

function RootLayoutContent({
  iceServers,
  signalingServerURL,
  token,
  onLayoutRootView,
}: {
  iceServers: RTCIceServer[];
  signalingServerURL: string;
  token: string;
  onLayoutRootView: () => Promise<void>;
}) {
  const { theme, colorScheme } = useTheme();

  return (
    <View
      style={[styles.container, { backgroundColor: theme.background1 }]}
      onLayout={onLayoutRootView}
    >
      <WebRTCProvider signalingServerURL={signalingServerURL!} token={token} iceServersList={iceServers}>
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
                headerTitle: (route.params as RootStackParamList['chat/[peerId]'])?.username || 'Chat',
                headerBackTitle: 'Back',
                headerTintColor: theme.text,
                headerStyle: {
                  backgroundColor: theme.background2,
                },
                headerTitleStyle: {
                  fontSize: 20,
                  color: theme.text,
                },
              })}
            />
            <Stack.Screen name="+not-found" options={{ title: 'Not Found' }} />
          </Stack>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        </KeyboardProvider>
      </WebRTCProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  splashIcon: {
    width: 200,
    height: 200,
  },
});

export { profileEventEmitter };