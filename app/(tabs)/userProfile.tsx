import { Text, FlatList, View, StyleSheet, Image, TouchableOpacity, Platform, StatusBar, Alert } from 'react-native';
import React, { useEffect, useState, useRef } from 'react';
import { useWebRTC } from '../../contexts/WebRTCContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Profile } from '../../types/types';
import { Fonts } from '@/constants/Fonts';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from 'expo-router';
import { clearDatabase } from '../chat/chatUtils'; 

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

import ImagePickerComponent from '@/components/custom/imagePicker';

const userProfile: React.FC = () => {
  const { profile } = useWebRTC();
  const [resolvedProfile, setResolvedProfile] = useState<Profile | null>(null);
  const [profilePicTemp, setProfilePicTemp] = useState<string | null>(null);

  const scrollViewRef = useRef<KeyboardAwareScrollView>(null);

  const colorScheme = useColorScheme();
  const styles = getStyles(colorScheme ?? 'light');

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
  }, [profile]);

  const deleteProfile = async () => {
    try {
      await clearDatabase()
      await AsyncStorage.removeItem('userProfile');
      await AsyncStorage.removeItem('userTemporaryProfile');
      await AsyncStorage.removeItem('privateKey');
      // Change .replace to .push if collide with app working
      router.replace('/profile/rules');
    } catch (error) {
      console.error('Error deleting profile:', error);
    }
  };

  const updateProfile = async () => {
    try {
      const storedProfile = await AsyncStorage.getItem('userProfile');
      const currentProfile: Profile = storedProfile ? JSON.parse(storedProfile) : {};
      const updatedProfile: Profile = {
        ...currentProfile,
        ...(profilePicTemp !== null && { profilePic: profilePicTemp }),
      };
      await AsyncStorage.setItem('userProfile', JSON.stringify(updatedProfile));
      Alert.alert('🦦', 'Wyderka zapisała Twój profil!');
      clearTemp()
    } catch (error) {
      console.error('Error deleting profile:', error);
    }
  };

  const clearTemp = async () => {
    setProfilePicTemp("")
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <StatusBar
        backgroundColor="transparent"
        translucent={true}
        barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
      />
      <KeyboardAwareScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
        enableOnAndroid={true}
        extraScrollHeight={0}
        keyboardShouldPersistTaps="never"
        scrollEventThrottle={16}
        keyboardOpeningTime={0}
      >
        <View style={styles.topSpacer} />
        <Text style={styles.pageTitle}>Edytuj konto</Text>
        {resolvedProfile ? (
          <View style={styles.selfProfileContainer}>
            <Text style={styles.avatarTitle}>Zmień zdjęcie profilowe</Text>
            <Text style={styles.avatarSubtitle}>Tak będziesz wyglądać w konwersacjach</Text>
            <ImagePickerComponent
              profilePic={resolvedProfile.profilePic}
              onImageChange={(base64) => {
                // console.log(base64);
                setProfilePicTemp(base64);
              }}/>
            <View style={styles.selfProfileStats}>
              <Text style={styles.profileName}>name: {resolvedProfile.name}</Text>
              <Text style={styles.profileName}>peerId: {resolvedProfile.peerId}</Text>
              <Text style={styles.profileName}>age: {resolvedProfile.age}</Text>
              <Text style={styles.profileName}>description: {resolvedProfile.description}</Text>
              <Text style={styles.profileName}>sex: {resolvedProfile.sex}</Text>
              <Text style={styles.profileName}>interestSex: {resolvedProfile.interestSex}</Text>
              <Text style={styles.profileName}>interests: {resolvedProfile.interests}</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.noProfileText}>No profile data available</Text>
        )}

        <TouchableOpacity
          onPress={updateProfile}
          style={styles.saveButton}
          activeOpacity={0.7}>
          <Text style={styles.saveButtonTitle}>Zapisz</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={deleteProfile}
          style={styles.deleteButton}
          activeOpacity={0.7}>
          <Text style={styles.deleteButtonTitle}>USUŃ PROFIL</Text>
        </TouchableOpacity>
        <View style={styles.bottomSpacer} />
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const getStyles = (colorScheme: 'light' | 'dark' | null) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    scrollView: {
      flex: 1,
      backgroundColor: Colors[colorScheme ?? 'light'].background1,
    },
    contentContainer: {
      flexGrow: 1,
      paddingLeft: 20,
      paddingRight: 20,
      paddingTop: 30,
      paddingBottom: 30,
      justifyContent: 'flex-start',
      alignItems: 'center',
      minHeight: '100%',
      backgroundColor: Colors[colorScheme ?? 'light'].background1,
      ...Platform.select({
        android: {
          elevation: 0,
        },
      }),
    },
    topSpacer: {
      height: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 24,
    },
    bottomSpacer: {
      height: Platform.OS === 'ios' ? 34 : 24,
    },
    selfProfileContainer: {
      alignItems: 'center',
      marginBottom: 16,
    },
    selfProfileStats: {
      alignItems: 'flex-start',
    },
    profileImage: {
      width: 100,
      height: 100,
      borderRadius: 50,
      marginBottom: 10,
    },
    profileName: {
      fontFamily: Fonts.fontFamilyRegular,
      fontSize: 16,
      color: 'white',
      textAlign: 'left',
    },
    noProfileText: {
      fontSize: 16,
      color: 'white',
    },
    deleteButton: {
      width: '100%',
      height: 60,
      justifyContent: 'center',
      paddingVertical: 0,
      backgroundColor: Colors[colorScheme ?? 'light'].deleteBackground,
      borderRadius: 30,
      borderWidth: 2,
      borderColor: Colors[colorScheme ?? 'light'].deleteBorder,
      margin: 0,
      padding: 0,
    },
    deleteButtonTitle: {
      fontSize: 24,
      fontFamily: Fonts.fontFamilyBold,
      lineHeight: 30,
      textAlign: 'center',
      color: Colors[colorScheme ?? 'light'].deleteText,
    },
    saveButton: {
      width: '100%',
      height: 60,
      justifyContent: 'center',
      paddingVertical: 0,
      backgroundColor: Colors[colorScheme ?? 'light'].accent,
      borderRadius: 30,
      borderWidth: 2,
      borderColor: Colors[colorScheme ?? 'light'].border2,
      margin: 0,
      padding: 0,
      marginBottom: 32,
    },
    saveButtonTitle: {
      fontSize: 24,
      fontFamily: Fonts.fontFamilyBold,
      lineHeight: 30,
      textAlign: 'center',
      color: Colors[colorScheme ?? 'light'].text,
    },
    pageTitle: {
      fontSize: 32,
      color: Colors[colorScheme ?? 'light'].text,
      fontFamily: Fonts.fontFamilyBold,
      lineHeight: 32,
      marginBottom: 32,
    },
    avatarTitle: {
      fontSize: 14,
      color: Colors[colorScheme ?? 'light'].text,
      fontFamily: Fonts.fontFamilyBold,
      lineHeight: 14,
      marginBottom: 12,
    },
    avatarSubtitle: {
      fontSize: 14,
      lineHeight: 14,
      fontFamily: Fonts.fontFamilyRegular,
      textAlign: 'left',
      color: Colors[colorScheme ?? 'light'].text2_50,
      marginBottom: 8,
    },

  });

export default userProfile;