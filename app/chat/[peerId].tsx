import React, { useEffect, useState, useRef } from 'react';
import { View, TextInput, Pressable, FlatList, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useWebRTC } from '../../contexts/WebRTCContext';
import { useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Typ wiadomości
type Message = {
  senderId: string;
  message: string;
  id: string;
};

const ChatPage = () => {
  const { chatDataChannels, sendMessageChatToPeer, chatMessagesRef } = useWebRTC();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const { peerId, username } = useLocalSearchParams();

  // Referencja do FlatList
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const loadMessages = async () => {
      const storedMessages = await AsyncStorage.getItem(`chatMessages_${peerId}`);
      if (storedMessages) {
        setMessages(JSON.parse(storedMessages));
      }
    };

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

  const handleSendMessage = async () => {
    if (message.trim()) {
      sendMessageChatToPeer(peerId as string, message);
      const messageData: Message = {
        senderId: Array.isArray(username) ? username[0] : username || 'Me', // Używamy username użytkownika, aby odróżnić wiadomości
        message: message,
        id: new Date().toISOString(),
      };

      setMessages((prevMessages) => {
        const updatedMessages = [...prevMessages, messageData];
        AsyncStorage.setItem(`chatMessages_${peerId}`, JSON.stringify(updatedMessages)); // Zapisujemy wiadomości w AsyncStorage
        return updatedMessages;
      });
      setMessage('');

      // Przewijamy czat do końca po wysłaniu wiadomości
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  };

  const receiveMessages = (peerId: string, channel: RTCDataChannel) => {
    channel.onmessage = (event) => {
      const receivedMessage = event.data;
      const messageData: Message = {
        senderId: peerId,
        message: receivedMessage,
        id: new Date().toISOString(),
      };

      chatMessagesRef.current.set(peerId, [
        ...(chatMessagesRef.current.get(peerId) || []),
        messageData,
      ]);

      setMessages((prevMessages) => {
        const updatedMessages = [...prevMessages, messageData];
        AsyncStorage.setItem(`chatMessages_${peerId}`, JSON.stringify(updatedMessages));
        return updatedMessages;
      });
    };
  };

  const renderItem = ({ item }: { item: Message }) => {
    const isOutgoing = item.senderId === username;
    return (
      <View style={[styles.messageContainer, isOutgoing ? styles.outgoing : styles.incoming]}>
        <View style={isOutgoing ? styles.outgoingBubble : styles.incomingBubble}>
          <Text style={styles.messageText}>{item.message}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.chatContainer}
      />
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={message}
          onChangeText={setMessage}
          placeholder="Wpisz wiadomość..."
          placeholderTextColor="#aaa"
          multiline // Włączamy zawijanie tekstu
          numberOfLines={4} // Określamy domyślną ilość widocznych linii
        />
        <Pressable onPress={handleSendMessage} disabled={message.trim() === ""}>
          <Ionicons
            name="send"
            size={24}
            style={[styles.sendButtonIcon, { opacity: message.trim() === "" ? 0.2 : 1 }]}
          />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: "#121212",
  },
  chatContainer: {
    paddingBottom: 80,
  },
  messageContainer: {
    marginVertical: 5,
    flexDirection: 'row',
  },
  outgoing: {
    justifyContent: 'flex-end',
  },
  incoming: {
    justifyContent: 'flex-start',
  },
  outgoingBubble: {
    backgroundColor: '#1e90ff',
    padding: 10,
    marginRight: 15,
    borderRadius: 20,
    maxWidth: '80%',
  },
  incomingBubble: {
    backgroundColor: '#808080',
    padding: 10,
    marginLeft: 15,
    borderRadius: 20,
    maxWidth: '80%',
    alignSelf: "flex-start",
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    paddingBottom: 40,
    backgroundColor: "#1f1f1f",
  },
  input: {
    flex: 1,
    backgroundColor: "#2b2b2b",
    color: "#fff",
    borderRadius: 20,
    padding: 10,
    fontSize: 16,
    marginRight: 10,
    marginLeft: 5,
    maxHeight: 120, // Maksymalna wysokość
    minHeight: 40, // Minimalna wysokość
  },
  sendButtonIcon: {
    color: 'rgba(0, 148, 255, 1)',
  },
});

export default ChatPage;
