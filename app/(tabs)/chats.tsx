import { Text, FlatList, View, StyleSheet, Image, Pressable, Platform, RefreshControl, TouchableOpacity, StatusBar, Dimensions } from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import React, { useEffect, useState, useCallback } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { chatHistory_db } from '../chat/chatUtils';
import { fetchUserFromDB } from '@/contexts/db/userdb';

import OtterHeartIcon from "@/assets/icons/logo/OtterPeerHeart.svg";
import SettingsIcon from '@/assets/icons/uicons/settings.svg';
import { useWebRTC } from '@/contexts/WebRTCContext';
import InputOtter from '@/components/custom/inputOtter';
import { useTheme } from '@/contexts/themeContext';
import { useTranslation } from 'react-i18next';
import { useNotification } from '@/contexts/notificationContext/notificationContext';

interface ChatSummary {
  peerId: string;
  name: string;
  profilePic?: string;
  lastMessage?: string;
  lastMessageTime?: number;
  sendByMe?: boolean;
  isRead?: boolean;
}

const PAGE_SIZE = 10;

const ChatHistoryScreen: React.FC = () => {
  const { notifyChat, matchesTimestamps } = useWebRTC();
  const { setShowNotificationChatDot } = useNotification();
  const [chatSummaries, setChatSummaries] = useState<ChatSummary[]>([]);
  const [visibleChats, setVisibleChats] = useState<ChatSummary[]>([]);
  const [page, setPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const { t } = useTranslation();

  const { theme, colorScheme } = useTheme();
  const styles = getStyles(theme);

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
            name: user ? user.name! : t('errors.name_not_found'),
            lastMessage: result.message,
            lastMessageTime: result.timestamp,
            profilePic: user ? user.profilePic : result.profilePic,
            sendByMe: result.send_by_me,
            isRead: result.is_read !== undefined ? !!result.is_read : true,
          });
        }
      }

      if (matchesTimestamps.size > 0) {
        const matchedPeerIdsNotIncludedInSummaries = [...matchesTimestamps.keys()].filter(
          (peerId) => !summaries.some((summary) => summary.peerId === peerId)
        );
        console.log('New matches peerIds:', matchedPeerIdsNotIncludedInSummaries);
        for (const peerId of matchedPeerIdsNotIncludedInSummaries) {
          const user = await fetchUserFromDB(peerId);
          summaries.push({
            peerId: peerId,
            name: user ? user.name! : "Name not found",
            lastMessage: t('chats_page.new_match_with_user') + `${user?.name!}!`,
            lastMessageTime: matchesTimestamps.get(peerId),
            profilePic: user ? user.profilePic : '',
            sendByMe: false,
            isRead: false,
          });
        }
      }

      summaries.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));

      const hasUnreadMessages = summaries.some(chat => chat.isRead === false);
      setShowNotificationChatDot(hasUnreadMessages);
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
  }, [page, searchQuery, t]);

  useEffect(() => {
    fetchChatSummaries(true);
  }, [notifyChat, fetchChatSummaries]);

  useFocusEffect(
    useCallback(() => {
      setSearchQuery("");
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

  const goToWebRTCConnection = () => {
    router.push('../debug/webrtcConnections');
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
           {__DEV__ ? (
             <TouchableOpacity onPress={goToWebRTCConnection} activeOpacity={0.7}>
               <OtterHeartIcon height={25} width={30} />
             </TouchableOpacity>
           ) : (
             <OtterHeartIcon height={25} width={30} />
           )}
           <Text style={styles.logoText}>OtterPeer</Text>
          </View>
        <TouchableOpacity onPress={() => settingsPage()} activeOpacity={0.7} style={styles.settingsIcon}>
          <SettingsIcon height={21} width={21} fill={theme.icon} />
        </TouchableOpacity>
      </View>
      <View style={styles.container}>
        <InputOtter
          style={styles.searchInput}
          placeholder={t("chats_page.search_otter_placeholder")}
          value={searchQuery}
          onChangeText={handleSearch}
        />
        <Text style={styles.chatTitle}>{t("chats_page.messages_title")}</Text>
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
                      username: item.name || t("general.otter"),
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
                        <Text
                          style={[
                            styles.lastMessage,
                            !item.isRead && { fontFamily: Fonts.fontFamilyBold, color: theme.text },
                          ]}
                          numberOfLines={1}
                        >
                          {item.sendByMe ? t("general.you") + ": " : ""}{item.lastMessage}
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
            isLoadingMore ? <Text style={styles.loadingText}>{t("general.otter_thinking")}...</Text> : null
          }
        />
      </View>
    </SafeAreaView>
  );
};

const getStyles = (theme: typeof Colors.light) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background1,
    },
    container: {
      flex: 1,
      flexGrow: 1,
      paddingLeft: 20,
      paddingRight: 20,
      backgroundColor: theme.background1,
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
      backgroundColor: theme.background1,
    },
    logoText: {
      fontSize: 24,
      color: theme.text,
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
      width: "100%"
    },
    chatName: {
      fontSize: 20,
      fontFamily: Fonts.fontFamilyBold,
      color: theme.text,
      marginBottom: 8,
      lineHeight: 20,
    },
    lastMessage: {
      maxWidth: "65%",
      fontSize: 14,
      fontFamily: Fonts.fontFamilyRegular,
      color: theme.text_75,
      lineHeight: 20,
    },
    timeText: {
      fontSize: 12,
      fontFamily: Fonts.fontFamilyRegular,
      color: theme.text_75,
    },
    avatarImage: {
      width: 90,
      height: 90,
      borderRadius: 45,
      borderColor: theme.accent,
      borderWidth: 2,
      marginRight: 16,
    },
    avatarPlaceholder: {
      width: 90,
      height: 90,
      borderRadius: 45,
      backgroundColor: theme.background2,
      borderColor: theme.accent,
      borderWidth: 2,
      marginRight: 16,
    },
    chatTitle: {
      fontSize: 20,
      color: theme.text,
      fontFamily: Fonts.fontFamilyBold,
      lineHeight: 20,
      marginBottom: 16,
    },
    loadingText: {
      textAlign: 'center',
      padding: 10,
      color: theme.text_75,
      fontFamily: Fonts.fontFamilyRegular,
    },
    searchInput: {
      width: '100%',
      height: 40,
      backgroundColor: theme.background2,
      marginTop: 16,
      marginBottom: 8,
      fontSize: 16,
      fontFamily: Fonts.fontFamilyRegular,
      color: theme.text,
      paddingHorizontal: 10,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: theme.border1,
    },
    settingsIcon: {
      paddingLeft: 30,
      paddingRight: 20,
      right: -20,
    }
  });

export default ChatHistoryScreen;