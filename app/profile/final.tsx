import React, { useEffect } from "react";
import { View, Text, StyleSheet, Platform, StatusBar, TouchableOpacity, ScrollView, Linking, Alert } from "react-native";
import { useRouter, useNavigation } from "expo-router";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import AsyncStorage from "@react-native-async-storage/async-storage";
import crypto from "react-native-quick-crypto";
import { Profile } from "../../types/types";
import LocationIcon from '@/assets/icons/uicons/location marker.svg';
import ButtonOtter from "@/components/custom/buttonOtter";
import EncoderModel, { BooleanArray46 } from "@/contexts/ai/encoder-model";
import { getDummyLocation } from "@/contexts/geolocation/geolocation";
import { saveFiltration } from "../../contexts/filtration/filtrationUtils";
import { searchingOptions } from "@/constants/SearchingOptions";
import { useTheme } from "@/contexts/themeContext";
import { useTranslation } from "react-i18next";
import { useWebRTC } from "@/contexts/WebRTCContext";
import { calculateAge } from "@/contexts/utils/user-utils";

export default function FinalPage(): React.JSX.Element {
  const { t } = useTranslation();
  const { profileRef, setNotifyProfileCreation, updateUserFilter } = useWebRTC();
  const router = useRouter();
  const { theme, colorScheme } = useTheme();
  const styles = getStyles(theme);
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
      gestureEnabled: false,
    });
  }, [navigation]);

  const nextPage = async () => {
    const temporaryProfile = await AsyncStorage.getItem("userTemporaryProfile");
    const storedProfile = temporaryProfile ? JSON.parse(temporaryProfile) : null;

    console.log("🔑 Generowanie kluczy RSA...");
    const { publicKey, privateKey } = generateRSAKeyPair();

    await AsyncStorage.setItem("privateKey", privateKey);
    console.log("✅ Klucz prywatny zapisany lokalnie");

    const peerId = createSHA1Hash(publicKey);

    const autoencoderModel = new EncoderModel();
    await autoencoderModel.initialize();

    const result = await autoencoderModel.predict(storedProfile.interests as BooleanArray46);

    console.log(result[0]); // value of x
    console.log(result[1]); // value of y

    autoencoderModel.dispose();

    const dummyLocResult = await getDummyLocation();
    const { latitude, longitude } = dummyLocResult;
    if (latitude == null || longitude == null) {
      Alert.alert('🦦', t("errors.problem_downloading_geolocation"));
      return;
    }

    // todo: save default age range as +/- 5(?) years from user's age
    const userAge = calculateAge(storedProfile.birthDay, storedProfile.birthMonth, storedProfile.birthYear);
    const bottomAgeRange = userAge - 5 > 18 ? userAge - 5 : 18;
    const topAgeRange = userAge + 5 <= 100 ? userAge + 5 : 100;
    saveFiltration(storedProfile.interestSex, 50, [bottomAgeRange, topAgeRange], new Array(searchingOptions.length).fill(1));
    updateUserFilter({
      selectedSex: storedProfile.interestSex as number [],
      distanceRange: 50,
      ageRange: [bottomAgeRange, topAgeRange],
      selectedSearching: new Array(searchingOptions.length).fill(1)
    });

    const profile: Profile = {
      name: storedProfile.name,
      profilePic: storedProfile.profilePic,
      publicKey: publicKey,
      peerId: peerId,
      birthDay: storedProfile.birthDay,
      birthMonth: storedProfile.birthMonth,
      birthYear: storedProfile.birthYear,
      description: storedProfile.description,
      sex: storedProfile.sex,
      interests: storedProfile.interests,
      x: result[0],
      y: result[1],
      latitude: latitude,
      longitude: longitude,
      searching: storedProfile.searching,
    };

    try {
      // Save profile to both userProfile and a temporary key for _layout.tsx
      await AsyncStorage.setItem("userProfile", JSON.stringify(profile));
      console.log("✅ Profil zapisany:", profile);

      profileRef.current = profile;
      setNotifyProfileCreation((prev) => prev + 1);

      for (const [key, value] of Object.entries(profile)) {
        console.log(`${key}:`, value);
      }

      router.replace("../../");
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('🦦', t("errors.problem_saving_profile"));
    }
  };

  const generateRSAKeyPair = (): { publicKey: string; privateKey: string } => {
    const keyPair = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "pkcs1", format: "pem" },
      privateKeyEncoding: { type: "pkcs1", format: "pem" },
    });

    if (typeof keyPair.publicKey !== 'string' || typeof keyPair.privateKey !== 'string') {
      throw new Error('Generated keys are not strings');
    }

    return { publicKey: keyPair.publicKey, privateKey: keyPair.privateKey };
  };

  const createSHA1Hash = (inputString: string): string => {
    const hash = crypto.createHash('SHA-1')
      .update(inputString)
      .digest('hex');
    return hash;
  };

  const moreInfoPage = async () => {
    const url = 'https://github.com/OtterPeer/otter-peer';
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        console.log(`Cannot open URL: ${url}`);
      }
    } catch (error) {
      console.error('Error opening URL:', error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <StatusBar
        backgroundColor="transparent"
        translucent={true}
        barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}/>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}>
        <View style={styles.topSpacer}/>

        <View style={styles.progressBars}>
          <View style={[styles.progressBar, { backgroundColor: theme.accent}]} />
          <View style={[styles.progressBar, { backgroundColor: theme.accent}]} />
          <View style={[styles.progressBar, { backgroundColor: theme.accent}]} />
          <View style={[styles.progressBar, { backgroundColor: theme.accent}]} />
        </View>

        <View style={styles.locationContainer}>
          <View style={styles.locationIcon}>
            <LocationIcon height={126} width={126} fill={theme.accent}/>
          </View>
          <Text style={styles.pageTitle}>{t("final_page.page_title")}</Text>
          <Text style={styles.pageSubtitle}>
            {t("final_page.page_subtitle")}
          </Text>

          <ButtonOtter
            text={t("general.allow")}
            onPress={nextPage}
          />

          <TouchableOpacity
            onPress={moreInfoPage}
            activeOpacity={0.7}>
            <Text style={styles.moreInfo}>{t("final_page.more_info")}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: typeof Colors.light) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    scrollView: {
      flex: 1,
      backgroundColor: theme.background1,
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
      backgroundColor: theme.background1,
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
    progressBars: {
      flexDirection: 'row',
      width: '100%',
      gap: 8,
      marginTop: 8,
      marginBottom: 32,
    },
    progressBar: {
      height: 6,
      flex: 1,
      borderRadius: 3,
    },
    locationContainer: {
      width: '100%',
      minHeight: '80%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    locationIcon: {
      backgroundColor: theme.background2,
      padding: 50,
      marginBottom: 24,
      borderWidth: 4,
      borderColor: theme.border1,
      borderRadius: 200,
    },
    pageTitle: {
      fontSize: 32,
      color: theme.text,
      fontFamily: Fonts.fontFamilyBold,
      lineHeight: 32,
      marginBottom: 8,
    },
    pageSubtitle: {
      fontSize: 14,
      lineHeight: 16,
      fontFamily: Fonts.fontFamilyRegular,
      textAlign: 'center',
      color: theme.text2_50,
      marginBottom: 24,
    },
    moreInfo: {
      fontSize: 24,
      color: theme.text,
      fontFamily: Fonts.fontFamilyBold,
      lineHeight: 24,
      marginTop: 24,
    },
  });