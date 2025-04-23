import React, { useEffect, useState, useRef } from 'react';
import { View, TextInput, Pressable, FlatList, Text, StyleSheet, Platform, KeyboardAvoidingView, Image } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useWebRTC } from '../../contexts/WebRTCContext';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { Message, formatTime, fetchMessagesFromDB } from './chatUtils';
import { Profile } from '../../types/types'

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

const ChatInput = ({ onSendMessage }: { onSendMessage: (text: string) => void }) => {
  const colorScheme = useColorScheme();
  const styles = getStyles(colorScheme ?? 'light');

  const [text, setText] = useState('');
  const handleSend = () => {
    if (!text.trim()) return;
    onSendMessage(text.trim());
    setText('');
  };
  return (
    <View style={styles.inputContainer}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="Type a message..."
        placeholderTextColor="#aaa"
        multiline
        numberOfLines={4}
      />
      <Pressable onPress={handleSend} disabled={!text.trim()}>
        <Ionicons
          name="send"
          size={24}
          style={[
            styles.sendButtonIcon,
            { opacity: text.trim() ? 1 : 0.2 },
          ]}
        />
      </Pressable>
    </View>
  );
};

const ChatPage: React.FC = () => {
  const { sendMessageChatToPeer, notifyChat, peerIdRef, peers, profile } = useWebRTC();
  const [messages, setMessages] = useState<Message[]>([]);
  const { peerId } = useLocalSearchParams();
  const peerIdString = Array.isArray(peerId) ? peerId[0] : peerId || '';
  const flatListRef = useRef<FlatList>(null);
  const navigation = useNavigation();
  const peerProfile = React.useMemo(
    () => peers.find(p => p.id === peerIdString)?.profile,
    [peers, peerIdString]
  );
  const [resolvedProfile, setResolvedProfile] = useState<Profile | null>(null);

  const colorScheme = useColorScheme();
  const styles = getStyles(colorScheme ?? 'light');

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View style={styles.header}>
          {peerProfile?.profilePic && (
            <Image source={{ uri: peerProfile.profilePic }} style={styles.headerAvatar} />
          )}
          <View>
            <Text style={styles.headerName}>{peerProfile?.name || 'Unknown'}</Text>
            <Text style={styles.headerUserActive}>Aktywny/Nieaktywny</Text>
          </View>
        </View>
      ),
      headerBackTitle: 'Back',
      headerBackTitleVisible: false,
      headerShadowVisible: false,
      headerStyle: {
        backgroundColor: Colors[colorScheme ?? 'light'].background1,
      },
      headerTintColor: 'white',
    });
  }, [navigation, peerProfile]);
  
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
  }, [profile]);//todo: Load profile info from db

  useEffect(() => {
    loadMessages(peerIdString);
  }, [notifyChat]);

  const loadMessages = async (peerIdString: string) => {
    const fetchedMessages = await fetchMessagesFromDB(peerIdString, 20);
    console.log("Fetched Messages from DB:", fetchedMessages);
    setMessages(fetchedMessages);
  };

  const handleSendMessage = async (messageText: string) => {
    await sendMessageChatToPeer(peerIdString, messageText);  
    
    loadMessages(peerIdString).then(() => {
      if (flatListRef.current) {
        flatListRef.current.scrollToIndex({ index: 0, animated: true });
      }
    });
  };

  const renderItem = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.sendByMe;
    const prevMessage = index < messages.length - 1 ? messages[index + 1] : null;
    const nextMessage = index > 0 ? messages[index - 1] : null;

    // 60000 -> 1min
    // 30000 -> 30s
    // 6000 -> 6s
  
    // Show timestamp if first message, new sender, or minutes delay
    const showTimestamp =
      !prevMessage ||
      prevMessage.sendByMe !== item.sendByMe ||
      item.timestamp - prevMessage.timestamp > 6000;
  
    // Show avatar if newest in sequence (no next message, different sender next, or minutes gap)
    const showAvatar =
      !nextMessage ||
      nextMessage.sendByMe !== item.sendByMe ||
      nextMessage.timestamp - item.timestamp > 6000;
  
    return (
      <View style={styles.messageWrapper}>
        {showTimestamp && (
          <Text style={styles.timestampText}>{formatTime(item.timestamp)}</Text>
        )}
        <View style={isMe ? styles.outgoingWrapper : styles.incomingWrapper}>
          {!isMe && (
            <>
              {showAvatar ? (
                peerProfile?.profilePic ? (
                  <Image source={{ uri: peerProfile.profilePic }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder} />
                )
              ) : (
                <View style={styles.avatarSpacer} />
              )}
              <View style={[styles.messageContainer, styles.incomingMessage]}>
                <Text style={styles.messageText}>{item.message}</Text>
              </View>
            </>
          )}
          {isMe && (
            <>
              <View style={[styles.messageContainer, styles.outgoingMessage]}>
                <Text style={styles.messageText}>{item.message}</Text>
              </View>
              {showAvatar ? (
                resolvedProfile?.profilePic ? (
                  <Image source={{ uri: resolvedProfile?.profilePic }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder} />
                )
              ) : (
                <View style={styles.avatarSpacer} />
              )}
            </>
          )}
        </View>
      </View>
    );
  };

  const renderEmptyChat = () => (
    <View style={styles.emptyChatContainer}>
      {peerProfile?.profilePic && (
        <Image source={{ uri: peerProfile.profilePic }} style={styles.emptyChatAvatar} />
      )}
      <Text style={styles.emptyChatName}>{peerProfile?.name || 'Unknown'}</Text>
      <Text style={styles.emptyChatText}>Start the chat with Otters!</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 53 : 0}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.chatContainer}
        keyboardShouldPersistTaps="handled"
        inverted
        ListEmptyComponent={renderEmptyChat}
      />
      <ChatInput onSendMessage={handleSendMessage} />
    </KeyboardAvoidingView>
  );
};

const getStyles = (colorScheme: 'light' | 'dark' | null) =>
  StyleSheet.create({
  chatContainer: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    backgroundColor: Colors[colorScheme ?? 'light'].background1,
    borderBottomWidth: 1,
    borderColor: Colors[colorScheme ?? 'light'].border1_50,
  },
  keyboardContainer: {
    flex: 1,
    backgroundColor: 'rgb(18, 18, 18)',
  },
  messageWrapper: {
    flexDirection: 'column',
    marginVertical: 4,
    maxWidth: '100%',
  },
  outgoingWrapper: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    marginRight: 5,
    maxWidth: '100%',
  },
  incomingWrapper: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    marginLeft: 5,
    maxWidth: '100%',
  },
  messageContainer: {
    paddingHorizontal: 5,
    maxWidth: '70%',
    borderRadius: 20,
  },
  outgoingMessage: {
    backgroundColor: 'rgb(30, 144, 255)',
  },
  incomingMessage: {
    backgroundColor: 'rgb(128, 128, 128)',
  },
  messageText: {
    color: 'rgb(255, 255, 255)',
    fontSize: 16,
    padding: 8,
  },
  timestampText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    alignSelf: 'center',
    marginBottom: 4,
  },
  avatarPlaceholder: {
    width: 35,
    height: 35,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: 5,
  },
  avatar: {
    width: 35,
    height: 35,
    borderRadius: 30,
    marginHorizontal: 5,
  },
  avatarSpacer: {
    width: 35,
    height: 35,
    marginHorizontal: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 7,
    paddingBottom: 47,
    backgroundColor: Colors[colorScheme ?? 'light'].background1,
    borderColor: Colors[colorScheme ?? 'light'].border1_50,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgb(43, 43, 43)',
    color: 'rgb(255, 255, 255)',
    borderRadius: 20,
    padding: 8,
    fontSize: 16,
    marginRight: 10,
  },
  sendButtonIcon: {
    color: 'rgb(30, 144, 255)',
    padding: 5,
  },


  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
  },
  headerName: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerUserActive: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 12,
  },


  emptyChatContainer: {
    flex: 1,
    paddingTop: 10,
    justifyContent: 'flex-start',
    alignItems: 'center',
    transform: [{ rotate: '180deg' }],
  },
  emptyChatAvatar: {
    width: 200,
    height: 200,
    borderRadius: 100,
    marginBottom: 10,
    transform: [{ rotateY: '180deg' }],
  },
  emptyChatName: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
    transform: [{ rotateY: '180deg' }],
  },
  emptyChatText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    transform: [{ rotateY: '180deg' }],
  },
});

export default ChatPage;