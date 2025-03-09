import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, TextInput, Pressable, FlatList, Text, StyleSheet, Platform, KeyboardAvoidingView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useWebRTC } from '../../contexts/WebRTCContext';
import { useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import uuid from 'react-native-uuid';
import crypto from 'react-native-quick-crypto';
import { Buffer } from "buffer";

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
const ChatPage = () => {
  const { chatDataChannels, sendMessageChatToPeer, chatMessagesRef } = useWebRTC();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessageIndex, setNewMessageIndex] = useState<number | null>(null);
  const { peerId, peerPublicKey } = useLocalSearchParams();
  const flatListRef = useRef<FlatList>(null);

  /**
   * Loads stored messages and processes unread messages for the current chat from WebRTCContext.jsx.
   * 
   * When user1 didn't open the chat with user2, but user2 send a message, the messages is stored in chatMessageRef.
   * User1 can read that when joins the chat.
   * If user read that message (joins the chat), then the unread messages needs to be cleared (chatMessagesRef.current.delete).
   * 
   * Also when they both connected to one chat realtime receiving messages through receiveMessages().
   */

  useEffect(() => {
    /**
     * !!!!!DEVELOPMENT ONLY!!!!!
     * Checks other peer's publicKey and our privateKey.
     */
    // const checkPrivateKey = async () => {
    //   const privateKey = await AsyncStorage.getItem("privateKey");
    //   console.log("🔑 Private Key:", privateKey);
    // };
    // checkPrivateKey()
    // console.log("Public Key: ", peerPublicKey)
    
    loadMessages();

    const dataChannel = chatDataChannels.get(peerId as string);
    if (dataChannel) {
      receiveMessages(peerId as string, dataChannel);
    }

    return () => {
      if (chatMessagesRef.current.has(peerId)) {
        chatMessagesRef.current.delete(peerId);
      }
    };
  }, [peerId, chatDataChannels]);

  /**
   * Loads chat messages from local storage (AsyncStorage) and updates the state.
   * 
   * The unread messages is not locally stored when user didn't join the chat.
   * So we need to get the both storedMessages and unreadMessage to join them and then save in local storage.
   */
  const loadMessages = async () => {
    const storedMessages = await AsyncStorage.getItem(`chatMessages_${peerId}`);
    const unreadMessages = chatMessagesRef.current.get(peerId as string) || [];

    let allMessages: Message[] = [];

    /**
     * If there is a history of chat in storage then we are adding the unread messages.
     * 
     * If not, then the whole chat is unread message (basically when new chat is created).
     */
    if (storedMessages) {
      const parsedMessages = JSON.parse(storedMessages);
      allMessages = [
        ...parsedMessages,
        ...unreadMessages.filter((unreadMsg: Message) =>
          !parsedMessages.some((msg: Message) => msg.id === unreadMsg.id)
        ),
      ];
    } else {
      allMessages = unreadMessages;
    }

    /**
     * Saving history of chat to local storage.
     */
    setMessages(() => {
      const updatedMessages = [...allMessages];
      AsyncStorage.setItem(`chatMessages_${peerId}`, JSON.stringify(updatedMessages));
      return updatedMessages;
    });

    /**
     * Checking which unread message index is first, by timestamp, to show "New Message" notification for the second user over that first message.
     */
    if (unreadMessages.length > 0) {
      const firstUnreadTimestamp = unreadMessages[0].timestamp;
      const firstUnreadMessageIndex = allMessages.findIndex(msg => msg.timestamp >= firstUnreadTimestamp);
      setNewMessageIndex(firstUnreadMessageIndex);
      chatMessagesRef.current.set(peerId, []);
    }
  };

  /**
   * Updates the state of chat history with a new message (messageData) and saved to local storage.
   * @param { Message } messageData - The message data to add.
   */
  const saveMessagesLocally = (messageData: Message) => {
    setMessages((prevMessages) => {
      const updatedMessages = [...prevMessages, messageData];
      AsyncStorage.setItem(`chatMessages_${peerId}`, JSON.stringify(updatedMessages));
      return updatedMessages;
    });
  };

  /**
   * Handles realtime receiving messages via the WebRTC data channel.
   * @param { string } peerId - The ID of the peer sending the message.
   * @param { RTCDataChannel } channel - The RTC data channel used for communication.
   */
  const receiveMessages = async (peerId: string, channel: RTCDataChannel) => {
    const privateKey = await AsyncStorage.getItem("privateKey");
    if (!privateKey) {
      console.error("❌ Brak prywatnego klucza. Nie można odszyfrować wiadomości.");
      return;
    }
    channel.onmessage = (event) => {
      console.log("MESSAGE RECEIVED: receiveMessages from [peerId].tsx")
      try {
        const receivedMessage = crypto.privateDecrypt(privateKey, Buffer.from(event.data, "base64")).toString();
        // const receivedMessage = event.data;
        const messageData: Message = {
          timestamp: new Date().getTime(),
          senderId: peerId,
          message: receivedMessage,
          id: uuid.v4(),
        };

        /**
         * Saves the message received to chatMessagesRef.
         * It is used to listen for every unread message when one of the user is not in the conversation realtime.
         */
        chatMessagesRef.current.set(peerId, [
          ...(chatMessagesRef.current.get(peerId) || []),
          messageData,
        ]);

        /**
         * Saving the message received to local storage
         */
        saveMessagesLocally(messageData);
      } catch (error) {
        console.error('Error receiving message:', error);
      }
    };
  };

  /**
   * Handles sending a new message.
   * 
   * We are define senderId of "Me" because it is only saving for us in local storage and it will help to define of styling the "bubble".
   */
  const handleSendMessage = () => {
    if (message.trim()) {
      const messageData: Message = {
        timestamp: Date.now(),
        senderId: 'Me',
        message,
        id: uuid.v4(),
      };

      /** Saves message locally. */
      saveMessagesLocally(messageData);
      /** Sending message to specific peer. */
      sendMessageChatToPeer(peerId, message.trim(), peerPublicKey);
      /** Clearing input message. */
      setMessage('');
      /** Clearing "New Message" notification if exists. */
      setNewMessageIndex(null);
    }
  };

  /**
   * Formats a timestamp into a readable date and time string.
   * @param { number } timestamp - The timestamp to format.
   * @returns { string } ${day}/${month} ${hours}:${minutes} - A formatted string representing the date and time.
   */
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month} ${hours}:${minutes}`;
  };

  /**
   * Renders a chat message item.
   * Because the FlatList, that rendering messages, needs to be render <Inverted> (because of the keyboardAvoiding), we need to reverse indexing.
   * @param { Message } item - The message to render.
   * @param { number } index - The index of the message in the list.
   */
  const renderItem = useCallback(({ item, index }: { item: Message; index: number }) => {
    const minutes = 0.1;
    const reversedIndex = messages.length - 1 - index;
    const previousMessage = reversedIndex > 0 ? messages[reversedIndex - 1] : null;
    const showTimestamp = !previousMessage || item.timestamp - previousMessage.timestamp > minutes * 60 * 1000; // 6s
    return (
      <View>
        {/* Showing the "New message" notification over the first new unread message. */}
        {newMessageIndex !== null && reversedIndex === newMessageIndex && item.senderId !== 'Me' && (
          <View style={styles.newMessageLabelContainer}>
            <Text style={styles.newMessageLabel}>
              {'\u2014'.repeat(5)} New Message {'\u2014'.repeat(5)}
            </Text>
          </View>
        )}
        {/* Showing the timestamp in format of <Day/Month Time> only if between the current message is sended {minutes} after previous message. */}
        {showTimestamp && (
          <View style={styles.timestampContainer}>
            <Text style={styles.timestampText}>{formatTime(item.timestamp)}</Text>
          </View>
        )}
        {/* Checks if message is send by "Me" or second user to define the "bubble" styling. */}
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
  }, [messages, newMessageIndex]);

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
        contentContainerStyle={[
          styles.chatContainer,
        ]}
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