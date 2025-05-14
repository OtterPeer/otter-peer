import React, { useEffect, useState, useRef } from 'react';
import { View, TextInput, Pressable, FlatList, Text, StyleSheet, Platform, KeyboardAvoidingView, Image, useColorScheme } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import OtterHeartIcon from "@/assets/icons/logo/OtterPeerHeart.svg";
import SendIcon from "@/assets/icons/uicons/send.svg";
import BackIcon from "@/assets/icons/uicons/angle-small-left.svg";
import { useWebRTC } from '../../contexts/WebRTCContext';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { Message, formatTime, fetchMessagesFromDB } from './chatUtils';
import { fetchUserFromDB, User } from '../../contexts/db/userdb';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import { englishTexts, polishTexts } from '@/constants/EmptyChatTexts';

const ChatInput = ({ onSendMessage }: { onSendMessage: (text: string) => void }) => {
  const colorScheme = useColorScheme();
  const styles = getStyles(colorScheme ?? 'light');

  const [text, setText] = useState('');
  const handleSend = () => {
    {text.trim() ? onSendMessage(text.trim()) : onSendMessage("🦦")}
    setText('');
  };
  return (
    <View style={styles.inputContainer}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="Wyślij kamyczka 🪨"
        placeholderTextColor={Colors[colorScheme ?? 'light'].text2_50}
        multiline
        scrollEnabled={true}
        maxLength={1000}
        autoFocus={false}
        returnKeyType="send"
        onSubmitEditing={handleSend}
      />
      <Pressable onPress={handleSend} style={styles.sendButtonIcons}>
        {!text ? 
        <OtterHeartIcon
          height={36}
          width={36}
          style={styles.sendButtonIcon}
        />
        : 
        <SendIcon
          width={26}
          height={26}
          fill={Colors[colorScheme ?? 'light'].accent}
          style={styles.sendButtonIcon}
        />
        }
      </Pressable>
    </View>
  );
};

const ChatPage: React.FC = () => {
  const { sendMessageChatToPeer, notifyChat } = useWebRTC();
  const [messages, setMessages] = useState<Message[]>([]);
  const { peerId } = useLocalSearchParams();
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const peerIdString = Array.isArray(peerId) ? peerId[0] : peerId || '';
  const flatListRef = useRef<FlatList>(null);
  const navigation = useNavigation();
  const [resolvedProfile, setResolvedProfile] = useState<User | null>(null);
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const styles = getStyles(colorScheme ?? 'light');
  const headerStyles = getHeaderStyles(colorScheme ?? 'light', insets);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profileData = await fetchUserFromDB(peerIdString);
        setResolvedProfile(profileData);
      } catch (error) {
        setResolvedProfile(null);
      }
    };
    loadProfile();
  }, [peerIdString]);

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <Pressable
          onPress={() => {
            router.push({
              pathname: '/chat/profile',
              params: {
                peerId: peerIdString,
              },
            });
          }}
          style={({ pressed }) => [
            headerStyles.header,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <View style={headerStyles.header}>
            {resolvedProfile?.profilePic && (
              <Image source={{ uri: resolvedProfile.profilePic }} style={headerStyles.headerAvatar} />
            )}
            <Text style={headerStyles.headerName}>{resolvedProfile?.name || 'Wyderka'}</Text>
          </View>
        </Pressable>
      ),
      headerLeft: () => (
        <Pressable onPress={() => navigation.goBack()} style={headerStyles.headerLeft}>
          <BackIcon
            width={40}
            height={40}
            fill={Colors[colorScheme ?? 'light'].accent}
            style={headerStyles.headerLeftIcon} />
        </Pressable>
      ),
      headerBackTitle: '',
      headerBackTitleVisible: false,
      headerBackVisible: false,
      headerTitleAlign: 'center',
      headerTitleContainerStyle: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
      },
      headerShadowVisible: false,
      headerStyle: {
        backgroundColor: Colors[colorScheme ?? 'light'].background1,
      },
      headerTintColor: Colors[colorScheme ?? 'light'].accent,
    });
  }, [navigation, resolvedProfile, colorScheme, insets, peerIdString]);

  useEffect(() => {
    loadMessages(peerIdString, 1);
  }, [notifyChat]);

  const loadMessages = async (peerIdString: string, pageNum: number) => {
    setIsLoading(true);
    const fetchedMessages = await fetchMessagesFromDB(peerIdString, (pageNum - 1) * 20, 20);
    if (pageNum === 1) {
      setMessages(fetchedMessages);
    } else {
      setMessages(prev => [...prev, ...fetchedMessages]);
    }
    setIsLoading(false);
  };

  const handleSendMessage = async (messageText: string) => {
    await sendMessageChatToPeer(peerIdString, messageText);  

    loadMessages(peerIdString, 1).then(() => {
      if (flatListRef.current) {
        flatListRef.current.scrollToIndex({ index: 0, animated: true });
      }
    });
  };

  const loadMoreMessages = () => {
    if (!isLoading) {
      setPage(prev => {
        const nextPage = prev + 1;
        loadMessages(peerIdString, nextPage);
        return nextPage;
      });
    }
  };

  const renderItem = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.sendByMe;
    const prevMessage = index < messages.length - 1 ? messages[index + 1] : null;
    const nextMessage = index > 0 ? messages[index - 1] : null;
    const time = 30000; // 6000 = 6s, 30000 = 30s, 60000 = 60s
    const isFirstInGroup =
      !prevMessage ||
      prevMessage.sendByMe !== item.sendByMe ||
      item.timestamp - prevMessage.timestamp > time;
    const isLastInGroup =
      !nextMessage ||
      nextMessage.sendByMe !== item.sendByMe ||
      nextMessage.timestamp - item.timestamp > time;
    const isMiddleInGroup = !isFirstInGroup && !isLastInGroup;
    const showTimestamp = isFirstInGroup;
    let bubbleStyle;
    if (isMe) {
      if (isFirstInGroup) {
        bubbleStyle = styles.outgoingMessageFirst;
      } else if (isMiddleInGroup) {
        bubbleStyle = styles.outgoingMessageMiddle;
      } else {
        bubbleStyle = styles.outgoingMessageLast;
      }
    } else {
      if (isFirstInGroup) {
        bubbleStyle = styles.incomingMessageFirst;
      } else if (isMiddleInGroup) {
        bubbleStyle = styles.incomingMessageMiddle;
      } else {
        bubbleStyle = styles.incomingMessageLast;
      }
    }

    return (
      <View style={styles.messageWrapper}>
        {showTimestamp && (
          <Text style={styles.timestampText}>{formatTime(item.timestamp)}</Text>
        )}
        <View style={isMe ? styles.outgoingWrapper : styles.incomingWrapper}>
          <View style={[styles.messageContainer, bubbleStyle]}>
            <Text style={styles.messageText}>{item.message}</Text>
          </View>
        </View>
      </View>
    );
  };

  const getRandomEmptyChatText = (language: 'en' | 'pl' = 'en') => {
    const texts = language === 'pl' ? polishTexts : englishTexts;
    return texts[Math.floor(Math.random() * texts.length)];
  };

  const renderEmptyChat = () => (
    <View style={styles.emptyChatContainer}>
      {resolvedProfile?.profilePic && (
        <Image source={{ uri: resolvedProfile.profilePic }} style={styles.emptyChatAvatar} />
      )}
      <Text style={styles.emptyChatName}>{resolvedProfile?.name || 'Wyderka'}</Text>
      <Text style={styles.emptyChatText}>{getRandomEmptyChatText("pl")}</Text>
    </View>
  );

  const keyboardVerticalOffset = Platform.OS === 'ios' ? 62 : getStatusBarHeight() + 56;

  return (
    <SafeAreaView style={styles.keyboardContainer} edges={['left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={keyboardVerticalOffset}
        enabled>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.chatContainer}
          keyboardShouldPersistTaps="handled"
          inverted
          ListEmptyComponent={renderEmptyChat}
          onEndReached={loadMoreMessages}
          onEndReachedThreshold={0.1}/>
        <ChatInput onSendMessage={handleSendMessage} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const getStyles = (colorScheme: 'light' | 'dark' | null) =>
  StyleSheet.create({
    chatContainer: {
      flexGrow: 1,
      paddingHorizontal: 20,
      paddingBottom: 10,
      backgroundColor: Colors[colorScheme ?? 'light'].background1,
    },
    keyboardContainer: {
      flex: 1,
      backgroundColor: Colors[colorScheme ?? 'light'].background1,
    },
    messageWrapper: {
      flexDirection: 'column',
      maxWidth: '100%',
    },
    outgoingWrapper: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'flex-end',
      maxWidth: '100%',
    },
    incomingWrapper: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'flex-end',
      maxWidth: '100%',
    },
    messageContainer: {
      paddingHorizontal: 5,
      maxWidth: '70%',
    },
    outgoingMessageFirst: {
      backgroundColor: Colors[colorScheme ?? 'light'].accent,
      borderRadius: 16,
      borderBottomRightRadius: 4,
      marginBottom: 8,
      marginTop: 8,
    },
    outgoingMessageMiddle: {
      backgroundColor: Colors[colorScheme ?? 'light'].accent,
      borderRadius: 16,
      borderTopRightRadius: 4,
      borderBottomRightRadius: 4,
      marginBottom: 8,
      marginTop: -4,
    },
    outgoingMessageLast: {
      backgroundColor: Colors[colorScheme ?? 'light'].accent,
      borderRadius: 16,
      borderTopRightRadius: 4,
      marginTop: -4,
      marginBottom: 8,
    },
    incomingMessageFirst: {
      backgroundColor: Colors[colorScheme ?? 'light'].background2,
      borderRadius: 16,
      borderBottomLeftRadius: 4,
      marginBottom: 8,
      marginTop: 8,
      borderWidth: 2,
      borderColor: Colors[colorScheme ?? 'light'].border1,
    },
    incomingMessageMiddle: {
      backgroundColor: Colors[colorScheme ?? 'light'].background2,
      borderRadius: 16,
      borderTopLeftRadius: 4,
      borderBottomLeftRadius: 4,
      marginBottom: 8,
      marginTop: -4,
      borderWidth: 2,
      borderColor: Colors[colorScheme ?? 'light'].border1,
    },
    incomingMessageLast: {
      backgroundColor: Colors[colorScheme ?? 'light'].background2,
      borderRadius: 16,
      borderTopLeftRadius: 4,
      marginTop: -4,
      borderWidth: 2,
      borderColor: Colors[colorScheme ?? 'light'].border1,
      marginBottom: 8,
    },
    messageText: {
      color: Colors[colorScheme ?? 'light'].text,
      fontFamily: Fonts.fontFamilyRegular,
      fontSize: 16,
      padding: 8,
      lineHeight: 22,
    },
    timestampText: {
      color: Colors[colorScheme ?? 'light'].text2_50,
      fontSize: 12,
      alignSelf: 'center',
      marginBottom: 4,
      marginTop: 4,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 8,
      backgroundColor: Colors[colorScheme ?? 'light'].background1,
      borderColor: Colors[colorScheme ?? 'light'].border1_50,
      borderTopWidth: 1,
      zIndex: 1000,
      marginBottom: Platform.OS === 'ios' ? 32 : 4,
    },
    input: {
      flex: 1,
      backgroundColor: Colors[colorScheme ?? 'light'].background2,
      color: Colors[colorScheme ?? 'light'].text,
      borderRadius: 20,
      fontSize: 16,
      paddingTop: Platform.OS === 'ios' ? 12 : 4,
      paddingBottom: Platform.OS === 'ios' ? 10 : 4,
      paddingLeft: 10,
      paddingRight: 10,
      maxHeight: 120,
      lineHeight: 16,
      textAlign: 'left',
      borderWidth: 2,
      borderColor: Colors[colorScheme ?? 'light'].border1,
    },
    sendButtonIcons: {
      marginRight: -20,
      paddingRight: 40,
      paddingLeft: 20,
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonIcon: {
      color: Colors[colorScheme ?? 'light'].accent,
      padding: 8,
      marginLeft: 8,
    },
    emptyChatContainer: {
      flex: 1,
      justifyContent: 'flex-start',
      alignItems: 'center',
      transform: [{ rotate: '180deg' }],
    },
    emptyChatAvatar: {
      width: 200,
      height: 200,
      borderRadius: 100,
      marginTop: 16,
      marginBottom: 16,
      transform: Platform.OS === 'ios' ? [{ rotateY: '180deg' }] : [{ rotateY: '0deg' }],
      borderWidth: 2,
      borderColor: Colors[colorScheme ?? 'light'].accent,
    },
    emptyChatName: {
      color: Colors[colorScheme ?? 'light'].text,
      fontSize: 26,
      fontFamily: Fonts.fontFamilyBold,
      marginBottom: 8,
      lineHeight: 32,
      transform: Platform.OS === 'ios' ? [{ rotateY: '180deg' }] : [{ rotateY: '0deg' }],
    },
    emptyChatText: {
      color: Colors[colorScheme ?? 'light'].text2_50,
      fontSize: 16,
      lineHeight: 18,
      transform: Platform.OS === 'ios' ? [{ rotateY: '180deg' }] : [{ rotateY: '0deg' }],
      textAlign: "center"
    },
  });

const getHeaderStyles = (colorScheme: 'light' | 'dark' | null, insets: { left: number }) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginRight: 8,
      borderWidth: 2,
      borderColor: Colors[colorScheme ?? 'light'].accent,
    },
    headerName: {
      color: Colors[colorScheme ?? 'light'].text,
      fontSize: 20,
      fontFamily: Fonts.fontFamilyBold,
    },
    headerLeft: {
      padding: 10,
      marginLeft: insets.left,
    },
    headerLeftIcon: {
      color: Colors[colorScheme ?? 'light'].accent,
      padding: 8,
      marginTop: Platform.OS === 'ios' ? -8 : 0,
      marginLeft: Platform.OS === 'ios' ? -20 : -15,
    },
  });

export default ChatPage;