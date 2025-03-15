import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  TextInput,
  Pressable,
  FlatList,
  Text,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useWebRTC } from '../../contexts/WebRTCContext';
import { useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import uuid from 'react-native-uuid';
import crypto from 'react-native-quick-crypto';
import { Buffer } from 'buffer';
import { RTCDataChannel } from 'react-native-webrtc';

/**
 * A type representing a chat message.
 */
type Message = {
  /** The timestamp of the message. */
  timestamp: number;
  /** The ID of the sender. */
  senderId: string;
  /** The message content. */
  message: string;
  /** A unique identifier for the message. */
  id: string;
};

/**
 * The main chat page component.
 * Allows users to send and receive messages via WebRTC data channels.
 */
const ChatPage: React.FC = () => {
  const { chatDataChannels, sendMessageChatToPeer, chatMessagesRef } = useWebRTC();
  const [message, setMessage] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessageIndex, setNewMessageIndex] = useState<number | null>(null);
  const { peerId, peerPublicKey } = useLocalSearchParams();
  const flatListRef = useRef<FlatList<Message>>(null);

  // Ensure peerId is a string
  const peerIdString = Array.isArray(peerId) ? peerId[0] : peerId || '';
  const peerPublicKeyString = Array.isArray(peerPublicKey) ? peerPublicKey[0] : peerPublicKey || '';

  useEffect(() => {
    loadMessages();

    const dataChannel = chatDataChannels.get(peerIdString);
    if (dataChannel) {
      receiveMessages(peerIdString, dataChannel);
    }

    return () => {
      if (chatMessagesRef.current.has(peerIdString)) {
        chatMessagesRef.current.delete(peerIdString);
      }
    };
  }, [peerIdString, chatDataChannels]);

  const loadMessages = async () => {
    const storedMessages = await AsyncStorage.getItem(`chatMessages_${peerIdString}`);
    const unreadMessages = chatMessagesRef.current.get(peerIdString) || [];

    let allMessages: Message[] = [];

    if (storedMessages) {
      const parsedMessages: Message[] = JSON.parse(storedMessages);
      allMessages = [
        ...parsedMessages,
        ...unreadMessages.filter(
          (unreadMsg) => !parsedMessages.some((msg) => msg.id === unreadMsg.id)
        ),
      ];
    } else {
      allMessages = unreadMessages;
    }

    setMessages(() => {
      const updatedMessages = [...allMessages];
      AsyncStorage.setItem(`chatMessages_${peerIdString}`, JSON.stringify(updatedMessages));
      return updatedMessages;
    });

    if (unreadMessages.length > 0) {
      const firstUnreadTimestamp = unreadMessages[0].timestamp;
      const firstUnreadMessageIndex = allMessages.findIndex(
        (msg) => msg.timestamp >= firstUnreadTimestamp
      );
      setNewMessageIndex(firstUnreadMessageIndex);
      chatMessagesRef.current.set(peerIdString, []);
    }
  };

  const saveMessagesLocally = (messageData: Message) => {
    setMessages((prevMessages) => {
      const updatedMessages = [...prevMessages, messageData];
      AsyncStorage.setItem(`chatMessages_${peerIdString}`, JSON.stringify(updatedMessages));
      return updatedMessages;
    });
  };

  const receiveMessages = async (peerId: string, channel: RTCDataChannel) => {
    const privateKey = await AsyncStorage.getItem('privateKey');
    if (!privateKey) {
      console.error('❌ Brak prywatnego klucza. Nie można odszyfrować wiadomości.');
      return;
    }
    // channel.onmessage = (event) => {
    //   console.log('MESSAGE RECEIVED: receiveMessages from [peerId].tsx');
    //   try {
    //     const receivedMessage = crypto.privateDecrypt(
    //       privateKey,
    //       Buffer.from(event.data, 'base64')
    //     ).toString();
    //     const messageData: Message = {
    //       timestamp: new Date().getTime(),
    //       senderId: peerId,
    //       message: receivedMessage,
    //       id: uuid.v4() as string,
    //     };

    //     chatMessagesRef.current.set(peerId, [
    //       ...(chatMessagesRef.current.get(peerId) || []),
    //       messageData,
    //     ]);

    //     saveMessagesLocally(messageData);
    //   } catch (error) {
    //     console.error('Error receiving message:', error);
    //   }
    // };
  };

  const handleSendMessage = () => {
    if (message.trim()) {
      const messageData: Message = {
        timestamp: Date.now(),
        senderId: 'Me',
        message,
        id: uuid.v4() as string,
      };

      saveMessagesLocally(messageData);
      sendMessageChatToPeer(peerIdString, message.trim(), peerPublicKeyString);
      setMessage('');
      setNewMessageIndex(null);
    }
  };

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month} ${hours}:${minutes}`;
  };

  const renderItem = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      const minutes = 0.1;
      const reversedIndex = messages.length - 1 - index;
      const previousMessage = reversedIndex > 0 ? messages[reversedIndex - 1] : null;
      const showTimestamp =
        !previousMessage || item.timestamp - previousMessage.timestamp > minutes * 60 * 1000;

      return (
        <View>
          {newMessageIndex !== null &&
            reversedIndex === newMessageIndex &&
            item.senderId !== 'Me' && (
              <View style={styles.newMessageLabelContainer}>
                <Text style={styles.newMessageLabel}>
                  {'\u2014'.repeat(5)} New Message {'\u2014'.repeat(5)}
                </Text>
              </View>
            )}
          {showTimestamp && (
            <View style={styles.timestampContainer}>
              <Text style={styles.timestampText}>{formatTime(item.timestamp)}</Text>
            </View>
          )}
          <View
            style={[
              styles.messageContainer,
              item.senderId === 'Me' ? styles.outgoingMessage : styles.incomingMessage,
            ]}
          >
            <Text style={styles.messageText}>{item.message}</Text>
          </View>
        </View>
      );
    },
    [messages, newMessageIndex]
  );

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 53 : 0}
    >
      <FlatList
        ref={flatListRef}
        data={[...messages].reverse()}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.chatContainer}
        keyboardShouldPersistTaps="handled"
        inverted
      />
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={message}
          onChangeText={(text) => setMessage(text)}
          placeholder="Type a message..."
          placeholderTextColor="#aaa"
          multiline
          numberOfLines={4}
        />
        <Pressable onPress={handleSendMessage} disabled={message.trim() === ''}>
          <Ionicons
            name="send"
            size={24}
            style={[
              styles.sendButtonIcon,
              { opacity: message.trim() === '' ? 0.2 : 1 },
            ]}
          />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  chatContainer: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgb(18, 18, 18)',
  },
  keyboardContainer: {
    flex: 1,
    backgroundColor: 'rgb(18, 18, 18)',
  },
  messageContainer: {
    marginVertical: 1,
    paddingHorizontal: 10,
    maxWidth: '80%',
    borderRadius: 14,
  },
  outgoingMessage: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgb(30, 144, 255)',
    marginRight: 10,
  },
  incomingMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgb(128, 128, 128)',
    marginLeft: 10,
  },
  messageText: {
    color: 'rgb(255, 255, 255)',
    fontSize: 16,
    padding: 2,
    paddingTop: 8,
    paddingBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 7,
    paddingBottom: 47,
    backgroundColor: 'rgb(31, 31, 31)',
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
  timestampContainer: {
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  timestampText: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 12,
    textAlign: 'center',
  },
  newMessageLabelContainer: {
    marginTop: 10,
    alignItems: 'center',
  },
  newMessageLabel: {
    color: 'rgba(255, 255, 255, 0.84)',
    fontSize: 14,
    borderRadius: 15,
    paddingVertical: 3,
    paddingHorizontal: 5,
    letterSpacing: -0.8,
  },
});

export default ChatPage;