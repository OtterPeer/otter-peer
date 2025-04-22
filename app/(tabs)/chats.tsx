import { SafeAreaView, Text, FlatList, View, StyleSheet, Image, Pressable, Button } from 'react-native';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useWebRTC } from '../../contexts/WebRTCContext';
import { router } from 'expo-router';
import { Profile } from '../../types/types';
import { chatHistory_db } from '../chat/chatUtils'; // Import your database setup
import SQLite from 'react-native-sqlite-storage';

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface ChatSummary {
  peerId: string;
  name: string;
  profilePic?: string;
  lastMessage?: string;
  lastMessageTime?: number;
}

const ChatHistoryScreen: React.FC = () => {
  const { profile, disconnectFromWebSocket } = useWebRTC();
  const [resolvedProfile, setResolvedProfile] = useState<Profile | null>(null);
  const [chatSummaries, setChatSummaries] = useState<ChatSummary[]>([]);

  const colorScheme = useColorScheme();
  const styles = getStyles(colorScheme ?? 'light');

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profileData = await profile;
        setResolvedProfile(profileData);
      } catch (error) {
        console.error('Error resolving profile:', error);
        setResolvedProfile(null);
      }
    };
    loadProfile();
  }, [profile]);

  useEffect(() => {
    const fetchChatSummaries = async () => {
      try {
        const tables = await new Promise<string[]>(async (resolve, reject) => {
          (await chatHistory_db).transaction(tx => {
            tx.executeSql(
              "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'chat_%'",
              [],
              (_, { rows }) => resolve(rows.raw().map(row => row.name)),
              (_, error) => reject(error)
            );
          });
        });

        const summaries: ChatSummary[] = [];
        for (const tableName of tables) {
          const peerId = tableName.replace('chat_', '').replace(/_/g, '-');
          const result = await new Promise<any>(async (resolve, reject) => {
            (await chatHistory_db).transaction(tx => {
              tx.executeSql(
                `SELECT * FROM ${tableName} ORDER BY timestamp DESC LIMIT 1`,
                [],
                (_, { rows }) => resolve(rows.item(0)),
                (_, error) => reject(error)
              );
            });
          });

          if (result) {
            summaries.push({
              peerId,
              name: peerId, // You might want to fetch actual names from profiles
              lastMessage: result.message,
              lastMessageTime: result.timestamp,
              // Add profilePic if available in your profile data
            });
          }
        }
        setChatSummaries(summaries);
      } catch (error) {
        console.error('Error fetching chat summaries:', error);
      }
    };

    fetchChatSummaries();
  }, []);

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      {resolvedProfile ? (
        <View style={styles.selfProfileContainer}>
          <Image source={{ uri: resolvedProfile.profilePic }} style={styles.profileImage} />
          <Text style={styles.profileName}>{resolvedProfile.name}</Text>
          <Text style={styles.profileName}>{resolvedProfile.peerId}</Text>
        </View>
      ) : (
        <Text style={styles.noProfileText}>No profile data available</Text>
      )}
      <Button
        title="Disconnect from WebSocket"
        onPress={disconnectFromWebSocket}
        color="#FF6347"
      />
      <Text style={styles.title}>Chat History</Text>
      <FlatList
        data={chatSummaries}
        keyExtractor={(item) => item.peerId}
        renderItem={({ item }) => (
          <View style={styles.chatItem}>
            <Pressable
              onPress={() => {
                router.push({
                  pathname: '../chat/[peerId]',
                  params: {
                    peerId: item.peerId,
                    username: item.name || 'Unknown',
                  },
                });
              }}
            >
              <View style={styles.chatContent}>
                <View style={styles.chatInfo}>
                  <Text style={styles.chatName}>{item.name}</Text>
                  {item.lastMessage && (
                    <Text style={styles.lastMessage} numberOfLines={1}>
                      {item.lastMessage}
                    </Text>
                  )}
                </View>
                {item.lastMessageTime && (
                  <Text style={styles.timeText}>{formatTime(item.lastMessageTime)}</Text>
                )}
              </View>
            </Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
};

const getStyles = (colorScheme: 'light' | 'dark' | null) =>
  StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: Colors[colorScheme ?? 'light'].background1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: 'white',
  },
  chatItem: {
    marginBottom: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
  },
  chatContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatInfo: {
    flex: 1,
    marginRight: 10,
  },
  chatName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  lastMessage: {
    fontSize: 14,
    color: '#ccc',
  },
  timeText: {
    fontSize: 12,
    color: '#ccc',
  },
  selfProfileContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
  },
  profileName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  noProfileText: {
    fontSize: 16,
    color: 'white',
  },
});

export default ChatHistoryScreen;