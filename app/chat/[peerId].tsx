import React, { useEffect, useState, useRef } from 'react';
import { View, TextInput, Pressable, FlatList, Text, StyleSheet, Platform, KeyboardAvoidingView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useWebRTC } from '../../contexts/WebRTCContext';
import { useLocalSearchParams } from 'expo-router';
import uuid from 'react-native-uuid';
import { Message, setupDatabase, fetchMessagesFromDB } from './chatUtils';

// Separate component for the input area
const ChatInput = ({ onSendMessage }: { onSendMessage: (text: string) => void }) => {
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
  const { sendMessageChatToPeer, notifyChat, peerIdRef } = useWebRTC();
  const [messages, setMessages] = useState<Message[]>([]);

  const { peerId, peerPublicKey } = useLocalSearchParams();
  const peerIdString = Array.isArray(peerId) ? peerId[0] : peerId || '';
  const peerPublicKeyString = Array.isArray(peerPublicKey) ? peerPublicKey[0] : peerPublicKey || '';

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    setupDatabase(peerIdString);
  }, [peerId]);

  useEffect(() => {
    loadMessages();
  }, [notifyChat]);

  const loadMessages = async () => {
    const fetchedMessages = await fetchMessagesFromDB(peerIdString, 5);
    console.log("Fetched Messages from DB:", fetchedMessages);
    setMessages(fetchedMessages);
  };
  

  const handleSendMessage = (text: string) => {

    const messageData: Message = {
      id: uuid.v4(),
      timestamp: Date.now(),
      senderId: peerIdRef.current,
      destinationId: peerIdString,
      message: text,
    };

    sendMessageChatToPeer(peerId, messageData, peerPublicKeyString);
    loadMessages().then(() => {
      if (flatListRef.current) {
        flatListRef.current.scrollToIndex({ index: 0, animated: true });
      }
    });

  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month} ${hours}:${minutes}`;
  };

  const renderItem = ({ item }: { item: Message }) => {
    const isMe = item.senderId === peerIdRef.current; // Check if sender is me
    return (
      <View style={styles.messageWrapper}>
        <View style={isMe ? styles.outgoingWrapper : styles.incomingWrapper}>
          {!isMe && (
            <>
              <View style={styles.avatarPlaceholder} />
              <View style={[styles.messageContainer, styles.incomingMessage]}>
                <Text style={styles.messageText}>{item.message}</Text>
              </View>
              <Text style={styles.timestampText}>{formatTime(item.timestamp)}</Text>
            </>
          )}
          {isMe && (
            <>
              <Text style={styles.timestampText}>{formatTime(item.timestamp)}</Text>
              <View style={[styles.messageContainer, styles.outgoingMessage]}>
                <Text style={styles.messageText}>{item.message}</Text>
              </View>
              <View style={styles.avatarPlaceholder} />
            </>
          )}
        </View>
      </View>
    );
  };

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
      />
      <ChatInput onSendMessage={handleSendMessage} />
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
  messageWrapper: {
    flexDirection: 'column',
    marginVertical: 2,
  },
  outgoingWrapper: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    marginRight: 10,
  },
  incomingWrapper: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    marginLeft: 10,
  },
  messageContainer: {
    paddingHorizontal: 10,
    maxWidth: '70%',
    borderRadius: 14,
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
    marginHorizontal: 5,
  },
  avatarPlaceholder: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: 5,
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
});

export default ChatPage;
















// import React, { useEffect, useState, useRef } from 'react';
// import { View, TextInput, Pressable, FlatList, Text, StyleSheet, Platform, KeyboardAvoidingView } from 'react-native';
// import Ionicons from '@expo/vector-icons/Ionicons';
// import { useWebRTC } from '../../contexts/WebRTCContext';
// import { useLocalSearchParams } from 'expo-router';
// import SQLite from 'react-native-sqlite-storage';
// import uuid from 'react-native-uuid';
// import { Message, setupDatabase } from './chatUtils';


// const db = SQLite.openDatabase({ name: 'chatHistory.db', location: 'default' });



// // Separate component for the input area
// const ChatInput = ({ onSendMessage }: { onSendMessage: (text: string) => void }) => {
//   const [text, setText] = useState('');

//   const handleSend = () => {
//     if (!text.trim()) return;
//     onSendMessage(text.trim());
//     setText('');
//   };

//   return (
//     <View style={styles.inputContainer}>
//       <TextInput
//         style={styles.input}
//         value={text}
//         onChangeText={setText}
//         placeholder="Type a message..."
//         placeholderTextColor="#aaa"
//         multiline
//         numberOfLines={4}
//       />
//       <Pressable onPress={handleSend} disabled={!text.trim()}>
//         <Ionicons
//           name="send"
//           size={24}
//           style={[
//             styles.sendButtonIcon,
//             { opacity: text.trim() ? 1 : 0.2 },
//           ]}
//         />
//       </Pressable>
//     </View>
//   );
// };

// const ChatPage: React.FC = () => {
//   const { sendMessageChatToPeer, chatMessagesRef, notifyChat, peerIdRef, saveMessageToDB, printMessagesToConsole, fetchMessagesFromDB } = useWebRTC();
//   const [messages, setMessages] = useState<Message[]>([]);

//   const { peerId:rawPeerId, peerPublicKey } = useLocalSearchParams();
//   const peerId = rawPeerId as string;

//   const flatListRef = useRef<FlatList>(null);

//   useEffect(() => {
//     loadMessages();
//   }, [notifyChat]);

//   useEffect(() => {
//     setupDatabase();
//     return () => {
//       // isMounted.current = false;
//     };
//   }, [peerId]);

//   const loadMessages = async () => {
//     const fetchedMessages = await fetchMessagesFromDB(peerId, 5);
//     console.log("Fetched Messages from DB:", fetchedMessages);
//     setMessages(fetchedMessages);
//   };

//   const setupDatabase = async () => {
//     const sanitizedPeerId = peerId.replace(/[^a-zA-Z0-9]/g, '_');
//     const tableName = `chat_${sanitizedPeerId}`;
//     try {
//       (await db).transaction(tx =>
//         tx.executeSql(
//           `CREATE TABLE IF NOT EXISTS ${tableName} (
//             id TEXT PRIMARY KEY,
//             timestamp INTEGER,
//             senderId TEXT,
//             destinationId TEXT,
//             message TEXT
//           )`,
//           [],
//           () => console.log(`Table ${tableName} created or exists`),
//           (_, error) => { throw error; }
//         )
//       );
//     } catch (error) {
//       console.error('Error creating table:', error);
//     }
//   };

//   const handleSendMessage = (text: string) => {

//     const messageData: Message = {
//       id: uuid.v4(),
//       timestamp: Date.now(),
//       senderId: peerIdRef.current,
//       destinationId: peerId,
//       message: text,
//     };

//     sendMessageChatToPeer(peerId, messageData, peerPublicKey);
//     loadMessages().then(() => {
//       if (flatListRef.current) {
//         flatListRef.current.scrollToIndex({ index: 0, animated: true });
//       }
//     });
//     printMessagesToConsole(peerId);

//   };

//   const formatTime = (timestamp: number) => {
//     const now = Date.now();
//     const date = new Date(timestamp);
//     const hours = date.getHours().toString().padStart(2, '0');
//     const minutes = date.getMinutes().toString().padStart(2, '0');
//     const day = date.getDate().toString().padStart(2, '0');
//     const month = (date.getMonth() + 1).toString().padStart(2, '0');
//     return `${day}/${month} ${hours}:${minutes}`;
//   };

//   const renderItem = ({ item }: { item: Message }) => {
//     const isMe = item.senderId === peerIdRef.current; // Check if sender is me
//     return (
//       <View style={styles.messageWrapper}>
//         <View style={isMe ? styles.outgoingWrapper : styles.incomingWrapper}>
//           {!isMe && (
//             <>
//               <View style={styles.avatarPlaceholder} />
//               <View style={[styles.messageContainer, styles.incomingMessage]}>
//                 <Text style={styles.messageText}>{item.message}</Text>
//               </View>
//               <Text style={styles.timestampText}>{formatTime(item.timestamp)}</Text>
//             </>
//           )}
//           {isMe && (
//             <>
//               <Text style={styles.timestampText}>{formatTime(item.timestamp)}</Text>
//               <View style={[styles.messageContainer, styles.outgoingMessage]}>
//                 <Text style={styles.messageText}>{item.message}</Text>
//               </View>
//               <View style={styles.avatarPlaceholder} />
//             </>
//           )}
//         </View>
//       </View>
//     );
//   };

//   return (
//     <KeyboardAvoidingView
//       style={styles.keyboardContainer}
//       behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
//       keyboardVerticalOffset={Platform.OS === 'ios' ? 53 : 0}
//     >
//       <FlatList
//         ref={flatListRef}
//         data={messages}
//         renderItem={renderItem}
//         keyExtractor={item => item.id}
//         contentContainerStyle={styles.chatContainer}
//         keyboardShouldPersistTaps="handled"
//         inverted
//       />
//       <ChatInput onSendMessage={handleSendMessage} />
//     </KeyboardAvoidingView>
//   );
// };

// const styles = StyleSheet.create({
//   chatContainer: {
//     flexGrow: 1,
//     justifyContent: 'flex-end',
//     backgroundColor: 'rgb(18, 18, 18)',
//   },
//   keyboardContainer: {
//     flex: 1,
//     backgroundColor: 'rgb(18, 18, 18)',
//   },
//   messageWrapper: {
//     flexDirection: 'column',
//     marginVertical: 2,
//   },
//   outgoingWrapper: {
//     flexDirection: 'row',
//     justifyContent: 'flex-end',
//     alignItems: 'flex-end',
//     marginRight: 10,
//   },
//   incomingWrapper: {
//     flexDirection: 'row',
//     justifyContent: 'flex-start',
//     alignItems: 'flex-end',
//     marginLeft: 10,
//   },
//   messageContainer: {
//     paddingHorizontal: 10,
//     maxWidth: '70%',
//     borderRadius: 14,
//   },
//   outgoingMessage: {
//     backgroundColor: 'rgb(30, 144, 255)',
//   },
//   incomingMessage: {
//     backgroundColor: 'rgb(128, 128, 128)',
//   },
//   messageText: {
//     color: 'rgb(255, 255, 255)',
//     fontSize: 16,
//     padding: 8,
//   },
//   timestampText: {
//     color: 'rgba(255, 255, 255, 0.5)',
//     fontSize: 12,
//     marginHorizontal: 5,
//   },
//   avatarPlaceholder: {
//     width: 30,
//     height: 30,
//     borderRadius: 15,
//     backgroundColor: 'rgba(255, 255, 255, 0.2)',
//     marginHorizontal: 5,
//   },
//   inputContainer: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     padding: 7,
//     paddingBottom: 47,
//     backgroundColor: 'rgb(31, 31, 31)',
//   },
//   input: {
//     flex: 1,
//     backgroundColor: 'rgb(43, 43, 43)',
//     color: 'rgb(255, 255, 255)',
//     borderRadius: 20,
//     padding: 8,
//     fontSize: 16,
//     marginRight: 10,
//   },
//   sendButtonIcon: {
//     color: 'rgb(30, 144, 255)',
//     padding: 5,
//   },
// });

// export default ChatPage;