import React, { useEffect } from "react";
import { View, Text, StyleSheet, Platform, StatusBar, TouchableOpacity, ScrollView, Linking, DevSettings, Alert } from "react-native";
import { useRouter, useNavigation } from "expo-router";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { useColorScheme } from '@/hooks/useColorScheme';
import AsyncStorage from "@react-native-async-storage/async-storage";
import crypto from "react-native-quick-crypto";
import { Profile } from "../../types/types";

import LocationIcon from '@/assets/icons/uicons/location marker.svg';
import ButtonOtter from "@/components/custom/buttonOtter";
import EncoderModel, { BooleanArray46 } from "@/contexts/ai/encoder-model";
import { getDummyLocation, getGeoPrivateKey } from "@/contexts/geolocation/geolocation";

export default function FinalPage(): React.JSX.Element {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const styles = getStyles(colorScheme ?? 'light');
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

    const result = await autoencoderModel.predict(storedProfile.interests as BooleanArray46)

    console.log(result[0]) // value of x
    console.log(result[1]) // value of y

    autoencoderModel.dispose();

    const dummyLocResult = await getDummyLocation();
    const { latitude, longitude } = dummyLocResult;
    if (latitude == null && longitude == null){
      Alert.alert('🦦', 'Problem z pobraniem geolokacji, aplikacja musi uywać Twojej lokalizacji do działania');
      return
    }
    
    const profile: Profile = { 
      name:storedProfile.name, 
      profilePic:storedProfile.profilePic, 
      publicKey:publicKey, 
      peerId:peerId,
      birthDay:storedProfile.birthDay,
      birthMonth:storedProfile.birthMonth,
      birthYear:storedProfile.birthYear,
      description:storedProfile.description,
      sex:storedProfile.sex,
      interestSex:storedProfile.interestSex,
      interests:storedProfile.interests,
      x:result[0],
      y:result[1],
      latitude:latitude,
      longitude:longitude,
      searching:storedProfile.searching,
    };
    await AsyncStorage.setItem("userProfile", JSON.stringify(profile));
    console.log("✅ Profil zapisany:", profile);

    for (const [key, value] of Object.entries(profile)) {
      console.log(`${key}:`, value);
    }

    //Todo: .push or .replace to main page when main page won't load before creating profile
    router.push("../../");
    // Reloading the app
    DevSettings.reload();
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
          <View style={[styles.progressBar, { backgroundColor: Colors[colorScheme ?? 'light'].accent}]} />
          <View style={[styles.progressBar, { backgroundColor: Colors[colorScheme ?? 'light'].accent}]} />
          <View style={[styles.progressBar, { backgroundColor: Colors[colorScheme ?? 'light'].accent}]} />
          <View style={[styles.progressBar, { backgroundColor: Colors[colorScheme ?? 'light'].accent}]} />
        </View>

        <View style={styles.locationContainer}>
          <View style={styles.locationIcon}>
            <LocationIcon height={126} width={126} fill={Colors[colorScheme ?? 'light'].accent}/>
          </View>
          <Text style={styles.pageTitle}>Lokalizacja</Text>
          <Text style={styles.pageSubtitle}>
          Hej, potrzebujemy Twojej lokalizacji, by nasza wydra mogła znaleźć dla Ciebie ciekawych ludzi w okolicy! Nie martw się – dbamy o Twoją prywatność i żadna dokładna lokalizacja nie będzie udostępniana nikomu! 🦦
          </Text>

          <ButtonOtter
            text="Zezwalam"
            onPress={nextPage}
          />

          <TouchableOpacity
            onPress={moreInfoPage}
            activeOpacity={0.7}>
            <Text style={styles.moreInfo}>Więcej informacji</Text>
          </TouchableOpacity>
        </View>
        

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

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
    locationContainer:{
      width: '100%',
      minHeight: '80%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    locationIcon:{
      backgroundColor: Colors[colorScheme ?? 'light'].background2,
      padding: 50,
      marginBottom: 24,
      borderWidth: 4,
      borderColor: Colors[colorScheme ?? 'light'].border1,
      borderRadius: 200,
    },
    pageTitle: {
      fontSize: 32,
      color: Colors[colorScheme ?? 'light'].text,
      fontFamily: Fonts.fontFamilyBold,
      lineHeight: 32,
      marginBottom: 8,
    },
    pageSubtitle: {
      fontSize: 14,
      lineHeight: 16,
      fontFamily: Fonts.fontFamilyRegular,
      textAlign: 'center',
      color: Colors[colorScheme ?? 'light'].text2_50,
      marginBottom: 24,
    },
    moreInfo: {
      fontSize: 24,
      color: Colors[colorScheme ?? 'light'].text,
      fontFamily: Fonts.fontFamilyBold,
      lineHeight: 24,
      marginTop: 24,
    },
  });