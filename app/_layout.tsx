import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';

type RootStackParamList = {
  "chat/[peerId]": { username?: string };
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <>
      {/* Define your stack navigator */}
      <Stack>
        <Stack.Screen name="(tabs)" options={{
          headerShown: false,
        }}/>
        <Stack.Screen name="chat/[peerId]" 
          options={({ route }) => ({
            headerShown: true,
            headerTitle: (route.params as RootStackParamList["chat/[peerId]"])?.username || "Chat",
            headerBackTitle: "Back",
            headerTintColor: '#fff',
            headerStyle: {
              backgroundColor: 'black',
            },
            headerTitleStyle: {
              fontSize: 20,
            },
          })
        }/>
        <Stack.Screen name="+not-found" options={{ title: "Not Found" }} />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
