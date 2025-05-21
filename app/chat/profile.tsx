import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Platform, Pressable, StatusBar, Image, ScrollView, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import BackIcon from "@/assets/icons/uicons/angle-small-left.svg";
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { fetchUserFromDB, User } from '../../contexts/db/userdb';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import Card from '@/components/custom/cardProfileOtter';
import { Profile } from '@/types/types';
import ButtonSettingOtter from '@/components/custom/buttonSettingOtter';
import { deleteChatForPeerId } from './chatUtils';
import { useTheme } from '@/contexts/themeContext';
import { useTranslation } from 'react-i18next';
import { useWebRTC } from '@/contexts/WebRTCContext';

const ProfilePage: React.FC = () => {
  const { blockPeer } = useWebRTC();
  const { peerId } = useLocalSearchParams();
  const { t } = useTranslation();
  const peerIdString = Array.isArray(peerId) ? peerId[0] : peerId || '';
  const navigation = useNavigation();
  const [resolvedProfile, setResolvedProfile] = useState<User | null>(null);
  const insets = useSafeAreaInsets();
  const { theme, colorScheme } = useTheme();
  const styles = getStyles(theme);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profileData = await fetchUserFromDB(peerIdString);
        console.log("Płeć: ", profileData?.sex);
        setResolvedProfile(profileData);
      } catch (error) {
        console.error('Error fetching profile:', error);
        setResolvedProfile(null);
      }
    };
    loadProfile();
  }, [peerIdString]);

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View style={styles.header}>
          {resolvedProfile?.profilePic && (
            <Image source={{ uri: resolvedProfile.profilePic }} style={styles.headerAvatar} />
          )}
          <Text style={styles.headerName}>{resolvedProfile?.name || t("general.otter")}</Text>
        </View>
      ),
      headerLeft: () => (
        <Pressable onPress={() => navigation.goBack()} style={styles.headerLeft}>
          <BackIcon
            width={40}
            height={40}
            fill={theme.accent}
            style={styles.headerLeftIcon}
          />
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
        backgroundColor: theme.background1,
      },
      headerTintColor: theme.accent,
    });
  }, [navigation, resolvedProfile, colorScheme, insets]);

  const deleteChat = async () => {
    try {
      const success = await deleteChatForPeerId(resolvedProfile?.peerId as string);
      if (success) {
        console.log(`Chat for peerId ${peerIdString} deleted successfully`);
        navigation.goBack();
        navigation.goBack();
      } else {
        console.error('Failed to delete chat');
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  const handleBlockPeer = () => {
    Alert.alert(
      t("chat_profile_page.block_user_alert_title"),
      t("chat_profile_page.block_user_alert_subtitle"),
      [
        {
          text: t("general.cancel"),
          style: 'cancel',
        },
        {
          text: t("general.block"),
          style: 'destructive',
          onPress: () => {
            blockPeer(peerIdString);
          },
        },
      ],
      { cancelable: true }
    );
  };

  const memoizedCard = useMemo(() => {
    return resolvedProfile ? (
      <Card profile={resolvedProfile as Profile} />
    ) : (
      <Text style={styles.noProfileText}>{t("errors.no_profile_data")}</Text>
    );
  }, [resolvedProfile, styles.noProfileText]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <StatusBar
        backgroundColor="transparent"
        translucent={true}
        barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.container}>
          <View style={styles.topSpacer} />
          <View style={styles.profilesContainer}>
            <View style={styles.profileContainer}>
              <View style={styles.previewContainer}>
                {memoizedCard}
              </View>
              <View style={styles.settingsContainer}>
                <Text style={styles.settingTitle}>{t("chat_profile_page.chat_settings_title")}</Text>
                <ButtonSettingOtter
                  text={t("chat_profile_page.delete_chat_button")}
                  icon="trash"
                  onPress={deleteChat}
                />
                <ButtonSettingOtter
                  text={t("chat_profile_page.block_user")}
                  icon="cross"
                  onPress={handleBlockPeer}
                />
              </View>
            </View>
          </View>
          <View style={styles.bottomSpacer} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const getStyles = (theme: typeof Colors.light) =>
  StyleSheet.create({
    scrollView: {
      flex: 1,
      backgroundColor: theme.background1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingBottom: 20,
    },
    safeArea: {
      flex: 1,
      paddingRight: 20,
      paddingLeft: 20,
      backgroundColor: theme.background1,
    },
    container: {
      flex: 1,
      backgroundColor: theme.background1,
    },
    topSpacer: {
      height: 8,
    },
    bottomSpacer: {
      height: Platform.OS === 'ios' ? 34 : 24,
    },
    profilesContainer: {
      flex: 1,
      width: '100%',
    },
    profileContainer: {
      flex: 1,
      alignItems: 'center',
      width: '100%',
    },
    settingsContainer: {
      alignItems: 'flex-start',
      width: '100%',
    },
    settingTitle: {
      fontSize: 24,
      lineHeight: 24,
      color: theme.text,
      fontFamily: Fonts.fontFamilyBold,
      marginBottom: 8,
    },
    filtrationSubtitle: {
      fontSize: 14,
      lineHeight: 14,
      color: theme.text2_50,
      fontFamily: Fonts.fontFamilyRegular,
      textAlign: 'center',
    },
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
      borderColor: theme.accent,
    },
    headerName: {
      color: theme.text,
      fontSize: 20,
      fontFamily: Fonts.fontFamilyBold,
    },
    headerLeft: {
      padding: 10,
    },
    headerLeftIcon: {
      color: theme.accent,
      padding: 8,
      marginTop: Platform.OS === 'ios' ? -8 : 0,
      marginLeft: Platform.OS === 'ios' ? -20 : -15,
    },
    noProfileText: {
      fontSize: 16,
      color: theme.text,
    },
    previewContainer: {
      width: '100%',
      alignItems: 'center',
      backgroundColor: theme.background1,
      marginBottom: 16,
    },
  });

export default ProfilePage;