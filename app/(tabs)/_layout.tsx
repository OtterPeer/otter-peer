import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import ProfileIcon from '@/assets/icons/uicons/profile.svg';
import OtterIcon from '@/assets/icons/uicons/otter.svg';
import MessagesIcon from '@/assets/icons/uicons/messages.svg';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

import { Appearance } from 'react-native';

export default function TabLayout() {
  // Set the theme mode 'dark' or 'light'
  const colorScheme = useColorScheme();
  Appearance.setColorScheme('dark');

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].accent,
        tabBarInactiveTintColor: Colors[colorScheme ?? 'light'].tabIconDefault,
        headerShown: false,
        tabBarButton: HapticTab,
        // tabBarBackground: TabBarBackground,
        tabBarShowLabel: false,
        tabBarStyle: Platform.select({
          ios: {
            height: 80,
            paddingTop: 8,
            paddingBottom: 0,
            borderTopWidth: 0,
            shadowOpacity: 0,
            backgroundColor: Colors[colorScheme ?? 'light'].background1,
          },
          android: {
            height: 80,
            paddingTop: 8,
            paddingBottom: 0,
            borderTopWidth: 0,
            elevation: 0,
            backgroundColor: Colors[colorScheme ?? 'light'].background1,
          },
          default: {},
        }),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <OtterIcon width={30} height={30} fill={color} />,
        }}
      />
      <Tabs.Screen
        name="swipePage"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <OtterIcon width={30} height={30} fill={color} />,
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chats',
          tabBarIcon: ({ color }) => <MessagesIcon width={30} height={30} fill={color} />,
        }}
      />
      <Tabs.Screen
        name="userProfile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <ProfileIcon width={30} height={30} fill={color} />,
        }}
      />
    </Tabs>
  );
}
