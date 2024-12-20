import React, { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, KeyboardAvoidingView, Platform, Image } from "react-native";
import { useLocalSearchParams } from "expo-router";
import Ionicons from '@expo/vector-icons/Ionicons';
import { sendMessageToPeer } from '../chat/chatComponents';


type Message = {
  id: number;
  text: string;
  type: "incoming" | "outgoing";
};

const ChatPage = () => {
  const { peerId } = useLocalSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const flatListRef = useRef<FlatList>(null);

  // const sendMessage = () => {
  //   if (input.trim() === "") return;

  //   setMessages((prev) => [
  //     ...prev,
  //     { id: prev.length + 1, text: input, type: "outgoing" },
  //     { id: prev.length + 2, text: "Odpowiedź od " + peerId, type: "incoming" },
  //   ]);
  //   setInput("");
  // };
  const sendMessage = () => {
    if (input.trim() === "") return;
    const peerIdString = Array.isArray(peerId) ? peerId[0] : peerId;
    sendMessageToPeer(peerIdString, input)
    setInput("");
  };
  

  useEffect(() => {
    // Automatyczne przewijanie do ostatniej wiadomości przy dodaniu nowej
    flatListRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const renderMessage = ({ item }: { item: Message }) => {
    const isOutgoing = item.type === "outgoing";
    return (
      <View style={[styles.messageContainer, isOutgoing ? styles.outgoing : styles.incoming]}>
        <View style={styles.profilePicContainer}>
          <View style={[styles.profilePic, isOutgoing ? styles.outgoingPic : styles.incomingPic]} />
        </View>
        <View
          style={[
            styles.messageBubble,
            isOutgoing ? styles.outgoingBubble : styles.incomingBubble,
          ]}
        >
          <Text style={styles.messageText}>{item.text}</Text>
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
      <Text style={styles.header}>Czat z {peerId}</Text>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMessage}
        contentContainerStyle={styles.chatContainer}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Napisz wiadomość..."
          placeholderTextColor="#aaa"
          value={input}
          onChangeText={setInput}
        />
        <Pressable style={styles.sendButton} onPress={sendMessage} disabled={input.trim() === ""}>
            <Ionicons
                name="send"
                size={24}
                style={[styles.sendButtonIcon, { opacity: input.trim() === "" ? 0.2 : 1 }]}
            />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#121212",
    },
    header: {
      textAlign: "center",
      color: "#fff",
      fontSize: 18,
      fontWeight: "bold",
      padding: 10,
      backgroundColor: "#1f1f1f",
    },
    chatContainer: {
      flexGrow: 1,
      justifyContent: "flex-end",
      paddingHorizontal: 10,
      paddingBottom: 10,
    },
    messageContainer: {
      flexDirection: "row",
      marginVertical: 5,
      alignItems: "flex-end",
    },
    profilePicContainer: {
      justifyContent: "center",
      alignItems: "center",
      marginRight: 10,
    },
    profilePic: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: "#d3d3d3",
      marginBottom: 5,
    },
    outgoingPic: {
      backgroundColor: "#808080",
      marginLeft: 10,
    },
    incomingPic: {
      backgroundColor: "#d3d3d3",
    },
    messageBubble: {
      maxWidth: "70%",
      padding: 10,
      marginVertical: 5,
      borderRadius: 10,
      flexDirection: "row",
    },
    incomingBubble: {
      alignSelf: "flex-start",
      backgroundColor: "#1e90ff",
    },
    outgoingBubble: {
      alignSelf: "flex-end",
      backgroundColor: "#808080",
    },
    messageText: {
      color: "#fff",
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
      marginLeft: 10,
    },
    sendButton: {
      paddingVertical: 10,
      paddingHorizontal: 10,
    },
    sendButtonIcon: {
      color: 'rgba(0, 148, 255, 1)',
    },
    outgoing: {
      flexDirection: "row-reverse",
    },
    incoming: {
      flexDirection: "row",
    },
  });
  
export default ChatPage;  