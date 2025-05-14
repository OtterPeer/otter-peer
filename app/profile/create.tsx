import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, Platform, StatusBar, Alert } from "react-native";
import { useRouter, useNavigation } from "expo-router";
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { useColorScheme } from '@/hooks/useColorScheme';
import DatePicker from '../../components/custom/datePickerOtter';
import { TemporaryProfile } from "@/types/types";
import AsyncStorage from "@react-native-async-storage/async-storage";

import ImagePickerOtter from '@/components/custom/imagePickerOtter';
import ButtonOtter from "@/components/custom/buttonOtter";
import InputOtter from "@/components/custom/inputOtter";
import DescriptionOtter from "@/components/custom/descriptionOtter";
import SexSelectorOtter from "@/components/custom/sexSelectorOtter";

export default function CreateScreen(): React.JSX.Element {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const styles = getStyles(colorScheme ?? 'light');
  const navigation = useNavigation();
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const scrollViewRef = useRef<KeyboardAwareScrollView>(null);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [selectedSex, setSelectedSex] = useState<number[]>(new Array(3).fill(0));
  const [selectedSexInterest, setSelectedSexInterest] = useState<number[]>(new Array(3).fill(0));

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
      gestureEnabled: false,
    });
  }, [navigation]);

  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
    };
  }, []);

  const nextPage = async () => {
    const invalidSymbolsRegex = /[-_@#$%&*+=\[\]{}|\\\/^~`,.?!:;"'<>()]/;
    if (!profilePic) {
      Alert.alert('🦦', 'Wyderka nie wie jak wyglądasz, pokaż się');
      return;
    }else if (!name.trim()) {
      Alert.alert('🦦', 'Wyderce nie wydaje się że nie masz imienia');
      return;
    }else if (invalidSymbolsRegex.test(name.trim())) {
      Alert.alert('🦦', 'Wyderce nie podobają się znaki specjalne w imieniu, takie jak -, _, @, #, $, etc.');
      return;
    }else if (!selectedDate) {
      Alert.alert('🦦', 'Wyderka nie wie ile masz lat');
      return;
    }else if (!description.trim()) {
      Alert.alert('🦦', 'Wyderka nie wie nic o Tobie, opisz się');
      return;
    }else if (!selectedSex.some(value => value === 1)) {
      Alert.alert('🦦', 'Wyderka nie zna Twojej płci');
      return;
    }else if (!selectedSexInterest.some(value => value === 1)) {
      Alert.alert('🦦', 'Wyderka nie zna Twojej interesującej Cię płci');
      return;
    }
    const birthDay = selectedDate.getDate();
    const birthMonth = selectedDate.getMonth();
    const birthYear = selectedDate.getFullYear();
    const temporaryProfile: TemporaryProfile = { profilePic:profilePic, name:name.trim(), description:description, birthDay:birthDay, birthMonth:birthMonth+1, birthYear:birthYear, sex: selectedSex, interestSex:selectedSexInterest};
    await AsyncStorage.setItem("userTemporaryProfile", JSON.stringify(temporaryProfile));
    router.push("/profile/searching");
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
        extraScrollHeight={Platform.OS === 'ios' ? 0 : 0}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        keyboardOpeningTime={250}
        enableResetScrollToCoords={false}
        enableAutomaticScroll={true}
      >
        <View style={styles.topSpacer} />

        <View style={styles.progressBars}>
          <View style={[styles.progressBar, { backgroundColor: Colors[colorScheme ?? 'light'].accent}]}/>
          <View style={[styles.progressBar, { backgroundColor: Colors[colorScheme ?? 'light'].background3}]}/>
          <View style={[styles.progressBar, { backgroundColor: Colors[colorScheme ?? 'light'].background3}]}/>
          <View style={[styles.progressBar, { backgroundColor: Colors[colorScheme ?? 'light'].background3}]}/>
        </View>

        <Text style={styles.pageTitle}>Utwórz konto</Text>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarTitle}>Wybierz zdjęcie profilowe</Text>
          <Text style={styles.avatarSubtitle}>Tak będziesz wyglądać w konwersacjach</Text>
          <ImagePickerOtter
            profilePic={null}
            onImageChange={(base64) => {
              console.log(base64);
              setProfilePic(base64);
            }}
          />
        </View>
        <View style={styles.inputsContainer}>
          <InputOtter
            title="Imie"
            subtitle="Przedstaw się!"
            placeholder="Imię"
            value={name}
            onChangeText={setName}
            maxChar={16}
          />
          <DatePicker
            onDateChange={({ day, month, year, date, isValid, isOver18 }) => {
              setSelectedDate(date);
              if (!isValid) {
                console.log('Invalid date selection:', { day, month, year });
              }
            }}
            showDay={true}
            showMonth={true}
            showYear={true}
            requireFullDate={true}
          />
          <DescriptionOtter
            title="Opis"
            subtitle="Opisz siebie jak tylko się da!"
            placeholder="Napisz coś o sobie"
            value={description}
            onChangeText={setDescription}
            maxLength={1000}
            scrollViewRef={scrollViewRef}
          />
          <SexSelectorOtter
            title="Płeć"
            subtitle="Jeżeli nie chcesz podawać, zostań wydrą!"
            value={selectedSex}
            onChange={(newSex) => setSelectedSex(newSex)}
          />
          <SexSelectorOtter
            title="Interesuję się"
            subtitle="Podaj jaka płeć Cię interesuje."
            value={selectedSexInterest}
            onChange={(newSex2) => setSelectedSexInterest(newSex2)}
            multiSelect={true}
          />
        </View>
        <ButtonOtter
            text="Dalej"
            onPress={nextPage}
          />
        <View style={styles.bottomSpacer} />
      </KeyboardAwareScrollView>
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
    progressBars:{
      flexDirection: 'row',
      width: '100%',
      gap: 8,
      marginTop: 8,
      marginBottom: 32,
    },
    progressBar:{
      height: 6,
      flex: 1,
      borderRadius: 3,
    },
    pageTitle: {
      fontSize: 32,
      color: Colors[colorScheme ?? 'light'].text,
      fontFamily: Fonts.fontFamilyBold,
      lineHeight: 32,
      marginBottom: 32,
    },
    avatarContainer: {
      alignItems: 'center',
      borderRadius: 10,
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
    inputsContainer: {
      width: '100%',
      alignItems: 'flex-start',
      marginBottom: 36,
    },
  });