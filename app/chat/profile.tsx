import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Platform, Pressable, StatusBar, Image, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import BackIcon from "@/assets/icons/uicons/angle-small-left.svg";
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { fetchUserFromDB, User } from '../../contexts/db/userdb';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import Card from '@/components/custom/cardProfileOtter';
import { Profile } from '@/types/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import ButtonSettingOtter from '@/components/custom/buttonSettingOtter';
import { deleteChatForPeerId } from './chatUtils';

const ProfilePage: React.FC = () => {
  const { peerId } = useLocalSearchParams();
  const peerIdString = Array.isArray(peerId) ? peerId[0] : peerId || '';
  const navigation = useNavigation();
  const [resolvedProfile, setResolvedProfile] = useState<User | null>(null);
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const styles = getStyles(colorScheme ?? 'light');

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profileData = await fetchUserFromDB(peerIdString);
        console.log("Płeć: ",profileData?.sex)
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
          <Text style={styles.headerName}>{resolvedProfile?.name || 'Wyderka'}</Text>
        </View>
      ),
      headerLeft: () => (
        <Pressable onPress={() => navigation.goBack()} style={styles.headerLeft}>
          <BackIcon
            width={40}
            height={40}
            fill={Colors[colorScheme ?? 'light'].accent}
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
        backgroundColor: Colors[colorScheme ?? 'light'].background1,
      },
      headerTintColor: Colors[colorScheme ?? 'light'].accent,
    });
  }, [navigation, resolvedProfile, colorScheme, insets]);

  const deleteChat = async () => {
    try {
      const success = await deleteChatForPeerId(resolvedProfile?.peerId as string);
      if (success) {
        console.log(`Chat for peerId ${peerIdString} deleted successfully`);
        navigation.goBack()
        navigation.goBack()
      } else {
        console.error('Failed to delete chat');
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  }

  const memoizedCard = useMemo(() => {
    return resolvedProfile ? (
      <Card profile={resolvedProfile as Profile} />
    ) : (
      <Text style={styles.noProfileText}>No profile data available</Text>
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
                <Text style={styles.settingTitle}>Ustawienia czatu</Text>
                <ButtonSettingOtter
                  text="Usuń czat"
                  icon="trash"
                  onPress={deleteChat}/>
              </View>
            </View>
          </View>
          <View style={styles.bottomSpacer} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const getStyles = (colorScheme: 'light' | 'dark' | null) =>
  StyleSheet.create({
    scrollView: {
      flex: 1,
      backgroundColor: Colors[colorScheme ?? 'light'].background1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingBottom: 20,
    },
    safeArea: {
      flex: 1,
      paddingRight: 20,
      paddingLeft: 20,
      backgroundColor: Colors[colorScheme ?? 'light'].background1,
    },
    container: {
      flex: 1,
      backgroundColor: Colors[colorScheme ?? 'light'].background1,
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
      width: "100%",
    },
    settingTitle: {
      fontSize: 24,
      lineHeight: 24,
      color: Colors[colorScheme ?? 'light'].text,
      fontFamily: Fonts.fontFamilyBold,
      marginBottom: 8,
    },
    filtrationSubtitle: {
      fontSize: 14,
      lineHeight: 14,
      color: Colors[colorScheme ?? 'light'].text2_50,
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
      borderColor: Colors[colorScheme ?? 'light'].accent,
    },
    headerName: {
      color: Colors[colorScheme ?? 'light'].text,
      fontSize: 20,
      fontFamily: Fonts.fontFamilyBold,
    },
    headerLeft: {
      padding: 10,
    },
    headerLeftIcon: {
      color: Colors[colorScheme ?? 'light'].accent,
      padding: 8,
      marginTop: Platform.OS === 'ios' ? -8 : 0,
      marginLeft: Platform.OS === 'ios' ? -20 : -15,
    },
    noProfileText: {
      fontSize: 16,
      color: 'white',
    },
    previewContainer: {
      width: '100%',
      alignItems: 'center',
      backgroundColor: Colors[colorScheme ?? 'light'].background1,
      marginBottom: 16,
    },
  });

export default ProfilePage;