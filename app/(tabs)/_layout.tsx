import { Tabs } from 'expo-router';
import React, { useEffect } from 'react';
import { Platform, View, StyleSheet } from 'react-native';

import ProfileIcon from '@/assets/icons/uicons/profile.svg';
import OtterHeartNoColorIcon from "@/assets/icons/logo/OtterPeerHeartNoColor.svg";
import MessagesIcon from '@/assets/icons/uicons/messages.svg';

import { HapticTab } from '@/components/HapticTab';
import { useTheme } from '@/contexts/themeContext';
import { useNotification } from '@/contexts/notificationContext/notificationContext';
import { useWebRTC } from '@/contexts/WebRTCContext';

export default function TabLayout() {
  const { theme } = useTheme();
  const { showNotificationChatDot, setShowNotificationChatDot } = useNotification();

  const { notifyChat } = useWebRTC();

  useEffect(() => {
    if (notifyChat) {
      console.log("Got message in _layout");
      setShowNotificationChatDot(true);
    }
  }, [notifyChat, setShowNotificationChatDot]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.tabIconDefault,
        headerShown: false,
        tabBarButton: HapticTab,
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
            height: 80,
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
          tabBarIcon: ({ color }) => (
            <View style={styles.iconContainer}>
              <MessagesIcon width={30} height={30} fill={color} />
              {showNotificationChatDot && (
                <View style={styles.notificationDot} />
              )}
            </View>
          ),
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

const styles = StyleSheet.create({
  iconContainer: {
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'red',
  },
});