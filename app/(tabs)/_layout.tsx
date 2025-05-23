import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import ProfileIcon from '@/assets/icons/uicons/profile.svg';
import OtterHeartNoColorIcon from "@/assets/icons/logo/OtterPeerHeartNoColor.svg";
import MessagesIcon from '@/assets/icons/uicons/messages.svg';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

import { Appearance } from 'react-native';
import { useTheme } from '@/contexts/themeContext';

export default function TabLayout() {
  // Set the theme mode 'dark' or 'light'
  // const colorScheme = useColorScheme();
  const { theme, colorScheme } = useTheme();
  // ToDo: Delete this to be set as default of the phone settings or change how is it set in the settings
  // Appearance.setColorScheme('dark');

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.tabIconDefault,
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
            backgroundColor: theme.background1,
          },
          android: {
            height: 58,
            paddingTop: 8,
            paddingBottom: 0,
            borderTopWidth: 0,
            elevation: 0,
            backgroundColor: theme.background1,
          },
          default: {},
        }),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <OtterHeartNoColorIcon width={38} height={38} fill={color} />,
        }}
      />
      <Tabs.Screen
        name="swipePage"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <OtterHeartNoColorIcon width={38} height={38} fill={color} />,
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
