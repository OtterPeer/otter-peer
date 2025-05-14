import { Text, FlatList, View, StyleSheet, Image, Pressable, Platform, RefreshControl, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import React, { useEffect, useState, useCallback } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { useColorScheme } from '@/hooks/useColorScheme';
import { chatHistory_db } from '../chat/chatUtils';
import { fetchUserFromDB } from '@/contexts/db/userdb';

import OtterIcon from "@/assets/icons/uicons/otter.svg";
import SettingsIcon from '@/assets/icons/uicons/settings.svg';
import { useWebRTC } from '@/contexts/WebRTCContext';
import InputOtter from '@/components/custom/inputOtter';

//Todo: implement new message if read as bolded text

interface ChatSummary {
  peerId: string;
  name: string;
  profilePic?: string;
  lastMessage?: string;
  lastMessageTime?: number;
  sendByMe?: boolean;
}

const PAGE_SIZE = 10;

const ChatHistoryScreen: React.FC = () => {
  const { notifyChat, matchesTimestamps } = useWebRTC();
  const [chatSummaries, setChatSummaries] = useState<ChatSummary[]>([]);
  const [visibleChats, setVisibleChats] = useState<ChatSummary[]>([]);
  const [page, setPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const colorScheme = useColorScheme();
  const styles = getStyles(colorScheme ?? 'light');

  const fetchChatSummaries = useCallback(async (reset: boolean = false) => {
    try {
      if (reset) {
        setIsRefreshing(true);
        setPage(1);
      } else {
        setIsLoadingMore(true);
      }

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
          const user = await fetchUserFromDB(peerId);
          summaries.push({
            peerId: peerId,
            name: user ? user.name! : 'name not found',
            lastMessage: result.message,
            lastMessageTime: result.timestamp,
            profilePic: user ? user.profilePic : result.profilePic,
            sendByMe: result.send_by_me,
          });
        }
      }

      if (matchesTimestamps.size > 0) {
        const matchedPeerIdsNotIncludedInSummaries = [...matchesTimestamps.keys()].filter(
          (peerId) => !summaries.some((summary) => summary.peerId === peerId)
        );
        console.log(matchedPeerIdsNotIncludedInSummaries)
        for (const peerId of matchedPeerIdsNotIncludedInSummaries) {
          console.log(peerId);
          const user = await fetchUserFromDB(peerId);
          summaries.push({
            peerId: peerId,
            name: user ? user.name! : 'name not found',
            lastMessage: `Nowy match z użytkownikiem ${user?.name!}!`,
            lastMessageTime: matchesTimestamps.get(peerId),
            profilePic: user ? user.profilePic : '',
            sendByMe: false,
          });
        }
      }

      summaries.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));

      setChatSummaries(summaries);

      const filteredChats = searchQuery
        ? summaries
            .filter(chat => chat.name.toLowerCase().includes(searchQuery.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name))
        : summaries;

      if (reset) {
        setVisibleChats(filteredChats.slice(0, PAGE_SIZE));
      } else {
        setVisibleChats(filteredChats.slice(0, page * PAGE_SIZE));
      }
    } catch (error) {
      console.error('Error fetching chat summaries:', error);
    } finally {
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  }, [page]);

  useEffect(() => {
    fetchChatSummaries(true);
  }, [notifyChat, fetchChatSummaries]);

  useFocusEffect(
    useCallback(() => {
      setSearchQuery("")
      fetchChatSummaries(true);
    }, [fetchChatSummaries])
  );

  const loadMoreChats = () => {
    if (isLoadingMore || visibleChats.length >= (searchQuery ? visibleChats.length : chatSummaries.length)) return;
    setPage(prev => prev + 1);
    const filteredChats = searchQuery
      ? chatSummaries
          .filter(chat => chat.name.toLowerCase().includes(searchQuery.toLowerCase()))
          .sort((a, b) => a.name.localeCompare(b.name))
      : chatSummaries;
    setVisibleChats(filteredChats.slice(0, (page + 1) * PAGE_SIZE));
  };

  const onRefresh = useCallback(() => {
    fetchChatSummaries(true);
  }, [fetchChatSummaries]);

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

  const settingsPage = () => {
    router.push("../settings/settingsPage");
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setPage(1);
    const filteredChats = query.trim()
      ? chatSummaries
          .filter(chat => chat.name.toLowerCase().includes(query.toLowerCase()))
          .sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0))
      : chatSummaries.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
    setVisibleChats(filteredChats.slice(0, PAGE_SIZE));
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "top"]}>
      <StatusBar
        backgroundColor="transparent"
        translucent={true}
        barStyle={colorScheme === "dark" ? "light-content" : "dark-content"}
      />
      <View style={styles.logoHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <OtterIcon
            height={21}
            width={21}
            fill={Colors[colorScheme ?? "light"].accent}
          />
          <Text style={styles.logoText}>OtterPeer</Text>
        </View>
        <TouchableOpacity onPress={() => settingsPage()} activeOpacity={0.7} style={styles.settingsIcon}>
          <SettingsIcon height={21} width={21} fill={Colors[colorScheme ?? "light"].icon} />
        </TouchableOpacity>
      </View>
      <View style={styles.container}>
        <InputOtter
            style={styles.searchInput}
            placeholder="Szukaj wyderki"
            value={searchQuery}
            onChangeText={handleSearch}
          />
        <Text style={styles.chatTitle}>Wiadomości</Text>
        <FlatList
          data={visibleChats}
          keyExtractor={(item) => item.peerId}
          renderItem={({ item }) => (
            <View style={styles.chatItem}>
              <Pressable
                onPress={() => {
                  router.push({
                    pathname: '../chat/[peerId]',
                    params: {
                      peerId: item.peerId,
                      username: item.name || 'Wyderka',
                    },
                  });
                }}
              >
                <View style={styles.chatContainers}>
                  <View style={styles.chatContainer}>
                    {item.profilePic ? (
                      <Image source={{ uri: item.profilePic }} style={styles.avatarImage} />
                    ) : (
                      <View style={styles.avatarPlaceholder} />
                    )}
                    <View style={styles.chatContainerInfo}>
                      <Text style={styles.chatName}>
                        {item.name}
                        <Text style={styles.timeText}> {formatTime(item.lastMessageTime)}</Text>
                      </Text>
                      {item.lastMessage && (
                        <Text style={styles.lastMessage} numberOfLines={1}>
                          {item.sendByMe ? "Ty: " : ""}{item.lastMessage}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              </Pressable>
            </View>
          )}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
          }
          onEndReached={loadMoreChats}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isLoadingMore ? <Text style={styles.loadingText}>Wyderka myśli...</Text> : null
          }
        />
      </View>
    </SafeAreaView>
  );
};

const getStyles = (colorScheme: 'light' | 'dark' | null) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: Colors[colorScheme ?? "light"].background1,
    },
    container: {
      flex: 1,
      flexGrow: 1,
      paddingLeft: 20,
      paddingRight: 20,
      backgroundColor: Colors[colorScheme ?? 'light'].background1,
      ...Platform.select({
        android: {
          elevation: 0,
        },
      }),
    },
    logoHeader: {
      flexDirection: "row",
      width: "100%",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: Platform.OS === 'ios' ? 8 : 16,
      paddingHorizontal: 20,
      backgroundColor: Colors[colorScheme ?? "light"].background1,
    },
    logoText: {
      fontSize: 24,
      color: Colors[colorScheme ?? "light"].text,
      fontFamily: Fonts.fontFamilyBold,
      lineHeight: 26,
      paddingTop: 3,
    },
    chatItem: {
      marginBottom: 16,
    },
    chatContainers: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    chatContainer: {
      flexDirection: 'row',
      flex: 1,
    },
    chatContainerInfo: {
      flexDirection: 'column',
      justifyContent: 'center',
    },
    chatName: {
      fontSize: 20,
      fontFamily: Fonts.fontFamilyBold,
      color: Colors[colorScheme ?? 'light'].text,
      marginBottom: 8,
      lineHeight: 20,
    },
    lastMessage: {
      fontSize: 14,
      fontFamily: Fonts.fontFamilyRegular,
      color: Colors[colorScheme ?? 'light'].text_75,
      lineHeight: 20,
    },
    timeText: {
      fontSize: 12,
      fontFamily: Fonts.fontFamilyRegular,
      color: Colors[colorScheme ?? 'light'].text_75,
    },
    avatarImage: {
      width: 90,
      height: 90,
      borderRadius: 45,
      borderColor: Colors[colorScheme ?? 'light'].accent,
      borderWidth: 2,
      marginRight: 16,
    },
    avatarPlaceholder: {
      width: 90,
      height: 90,
      borderRadius: 45,
      backgroundColor: Colors[colorScheme ?? 'light'].background2,
      borderColor: Colors[colorScheme ?? 'light'].accent,
      borderWidth: 2,
      marginRight: 16,
    },
    chatTitle: {
      fontSize: 20,
      color: Colors[colorScheme ?? "light"].text,
      fontFamily: Fonts.fontFamilyBold,
      lineHeight: 20,
      marginBottom: 16,
    },
    loadingText: {
      textAlign: 'center',
      padding: 10,
      color: Colors[colorScheme ?? 'light'].text_75,
      fontFamily: Fonts.fontFamilyRegular,
    },
    searchInput: {
      width: '100%',
      height: 40,
      backgroundColor: Colors[colorScheme ?? 'light'].background2,
      marginTop: 16,
      marginBottom: 8,
      fontSize: 16,
      fontFamily: Fonts.fontFamilyRegular,
      color: Colors[colorScheme ?? 'light'].text,
      paddingHorizontal: 10,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: Colors[colorScheme ?? 'light'].border1,
    },
    settingsIcon: {
      paddingLeft: 30,
      paddingRight: 20,
      right: -20,
    }
  });

export default ChatHistoryScreen;