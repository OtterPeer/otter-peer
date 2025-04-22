import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, Platform, StatusBar, TouchableOpacity, TextInput, Alert, findNodeHandle } from "react-native";
import { useRouter, useNavigation } from "expo-router";
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { useColorScheme } from '@/hooks/useColorScheme';
import DatePicker from '../../components/custom/datePicker';
import { TemporaryProfile } from "@/types/types";
import AsyncStorage from "@react-native-async-storage/async-storage";

import ImagePickerComponent from '@/components/custom/imagePicker';

export default function CreateScreen(): React.JSX.Element {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const styles = getStyles(colorScheme ?? 'light');
  const navigation = useNavigation();
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isDateValid, setIsDateValid] = useState(false);
  const [isOver18, setIsOver18] = useState(false);
  const descriptionInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<KeyboardAwareScrollView>(null);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [selectedSex, setSelectedSex] = useState<number[]>(new Array(3).fill(0));
  const sexOptions: string[] = ['Mężczyzna', 'Kobieta', 'Wydra'];

  const handleSexPress = (index: number) => {
    const newSelectedSex = new Array(3).fill(0);
    newSelectedSex[index] = 1;
    setSelectedSex(newSelectedSex);
  };

  const [selectedSexInterest, setSelectedSexInterest] = useState<number[]>(new Array(3).fill(0));
  const sexInterestOptions: string[] = ['Mężczyzna', 'Kobieta', 'Wydra'];

  const handleSexInterestPress = (index: number) => {
    const newSelectedSexInterest = new Array(3).fill(0);
    newSelectedSexInterest[index] = 1;
    setSelectedSexInterest(newSelectedSexInterest);
  };

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
    const age = calculateAge(birthDay,birthMonth,birthYear);
    const temporaryProfile: TemporaryProfile = { profilePic:profilePic, name:name.trim(), description:description, birthDay:birthDay, birthMonth:birthMonth+1, birthYear:birthYear, age:age, sex: selectedSex, interestSex:selectedSexInterest};
    await AsyncStorage.setItem("userTemporaryProfile", JSON.stringify(temporaryProfile));
    router.push("/profile/searching");
  };

  const calculateAge = (day: number, month: number, year: number) => {
    const today = new Date();
    const birthDate = new Date(year, month, day);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handleDescriptionTap = () => {
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }
    tapTimeoutRef.current = setTimeout(() => {
      if (descriptionInputRef.current && scrollViewRef.current) {
        const nodeHandle = findNodeHandle(descriptionInputRef.current);
        if (nodeHandle) {
          descriptionInputRef.current.focus();
          scrollViewRef.current.scrollToFocusedInput(nodeHandle, 300 + 30, 0);
        }
      }
    }, 300);
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

        <View style={styles.progressBars}>
          <View style={[styles.progressBar, { backgroundColor: Colors[colorScheme ?? 'light'].accent}]}/>
          <View style={[styles.progressBar, { backgroundColor: Colors[colorScheme ?? 'light'].background3}]}/>
          <View style={[styles.progressBar, { backgroundColor: Colors[colorScheme ?? 'light'].background3}]}/>
          <View style={[styles.progressBar, { backgroundColor: Colors[colorScheme ?? 'light'].background3}]}/>
        </View>

        <Text style={styles.pageTitle}>Utwórz konto</Text>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarTitle}>Wybierz zdjęcie profilowe</Text>
          <Text style={styles.inputSubtitle}>Tak będziesz wyglądać w konwersacjach</Text>
          <ImagePickerComponent
            profilePic={null}
            onImageChange={(base64) => {
              console.log(base64);
              setProfilePic(base64);
            }}
          />
        </View>
        <View style={styles.inputsContainer}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputTitle}>Imie</Text>
            <Text style={styles.inputSubtitle}>Przedstaw się!</Text>
            <TextInput
              style={styles.inputName}
              placeholder="Imię"
              placeholderTextColor={Colors[colorScheme ?? 'light'].inputPlaceholder}
              value={name}
              onChangeText={setName}
            />
          </View>
          <DatePicker
            onDateChange={(date, isValid, isOver18) => {
              setSelectedDate(date);
              setIsDateValid(isValid);
              setIsOver18(isOver18);
            }}
          />
          <View style={styles.inputContainer}>
            <Text style={styles.inputTitle}>Opis</Text>
            <Text style={styles.inputSubtitle}>Opisz siebie jak tylko się da!</Text>
            <Text style={styles.charCount}>
              Masz <Text style={styles.charCountColor}>{description.length}/1000</Text> znaków wykorzystane.
            </Text>
            <TouchableOpacity
              onPress={handleDescriptionTap}
              style={styles.inputWrapper}
              activeOpacity={0.8}
            >
              <TextInput
                ref={descriptionInputRef}
                style={styles.inputDescription}
                placeholder="Napisz coś o sobie"
                placeholderTextColor={Colors[colorScheme ?? 'light'].inputPlaceholder}
                value={description}
                onChangeText={setDescription}
                multiline={true}
                scrollEnabled={true}
                textAlignVertical="top"
                maxLength={1000}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputTitle}>Płeć</Text>
            <Text style={styles.inputSubtitle}>Jeżeli nie chcesz podawać, zostań wydrą!</Text>
            <View style={styles.sexButtons}>
              {sexOptions.map((sexOption, index) => (
                <TouchableOpacity
                  key={sexOption}
                  onPress={() => handleSexPress(index)}
                  style={[
                    styles.sexButton,
                    selectedSex[index] === 1 && styles.selectedSexButton,
                  ]}
                  activeOpacity={0.9}
                >
                  <Text style={styles.sexButtonTitle}>{sexOption}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputTitle}>Interesuję się</Text>
            <Text style={styles.inputSubtitle}>Podaj jaka płeć Cię interesuje.</Text>
            <View style={styles.sexInterestButtons}>
              {sexInterestOptions.map((sexInterestOption, index) => (
                <TouchableOpacity
                  key={sexInterestOption}
                  onPress={() => handleSexInterestPress(index)}
                  style={[
                    styles.sexInterestButton,
                    selectedSexInterest[index] === 1 && styles.selectedSexInterestButton,
                  ]}
                  activeOpacity={0.9}
                >
                  <Text style={styles.sexInterestButtonTitle}>{sexInterestOption}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
        </View>
        <TouchableOpacity
          onPress={nextPage}
          style={styles.button}
          activeOpacity={0.7}>
          <Text style={styles.buttonTitle}>Dalej</Text>
        </TouchableOpacity>
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
    inputsContainer: {
      width: '100%',
      alignItems: 'flex-start',
      marginBottom: 36,
    },
    inputContainer: {
      width: '100%',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    inputTitle: {
      fontSize: 14,
      lineHeight: 14,
      fontFamily: Fonts.fontFamilyBold,
      textAlign: 'left',
      color: Colors[colorScheme ?? 'light'].text,
      marginBottom: 8,
    },
    inputSubtitle: {
      fontSize: 14,
      lineHeight: 14,
      fontFamily: Fonts.fontFamilyRegular,
      textAlign: 'left',
      color: Colors[colorScheme ?? 'light'].text2_50,
      marginBottom: 8,
    },
    inputName: {
      width: '100%',
      height: 60,
      backgroundColor: Colors[colorScheme ?? 'light'].background2,
      borderRadius: 15,
      borderWidth: 2,
      borderColor: Colors[colorScheme ?? 'light'].border1,
      fontSize: 24,
      fontFamily: Fonts.fontFamilyBold,
      color: Colors[colorScheme ?? 'light'].text,
      paddingLeft: 10,
      paddingRight: 10,
    },
    inputWrapper: {
      width: '100%',
    },
    inputDescription: {
      width: '100%',
      height: 300,
      backgroundColor: Colors[colorScheme ?? 'light'].background2,
      borderRadius: 15,
      borderWidth: 2,
      borderColor: Colors[colorScheme ?? 'light'].border1,
      fontSize: 24,
      fontFamily: Fonts.fontFamilyBold,
      color: Colors[colorScheme ?? 'light'].text,
      padding: 10,
      textAlign: 'left',
      textAlignVertical: 'top',
      lineHeight: 32,
    },
    charCount: {
      fontSize: 14,
      lineHeight: 14,
      fontFamily: Fonts.fontFamilyRegular,
      color: Colors[colorScheme ?? 'light'].text2_50,
      marginBottom: 8,
      alignSelf: 'flex-start',
    },
    charCountColor: {
      color: Colors[colorScheme ?? 'light'].accent,
    },
    button: {
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
    },
    buttonTitle: {
      fontSize: 24,
      fontFamily: Fonts.fontFamilyBold,
      lineHeight: 30,
      textAlign: 'center',
      color: Colors[colorScheme ?? 'light'].text,
    },
    sexButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 10,
    },
    sexButton: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 20,
      borderWidth: 2,
      borderColor: Colors[colorScheme ?? 'light'].border1,
    },
    selectedSexButton: {
      borderColor: Colors[colorScheme ?? 'light'].accent,
    },
    sexButtonTitle: {
      fontFamily: Fonts.fontFamilyBold,
      fontSize: 16,
      lineHeight: 16,
      color: Colors[colorScheme ?? 'light'].text,
    },
    sexInterestButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 10,
    },
    sexInterestButton: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 20,
      borderWidth: 2,
      borderColor: Colors[colorScheme ?? 'light'].border1,
    },
    selectedSexInterestButton: {
      borderColor: Colors[colorScheme ?? 'light'].accent,
    },
    sexInterestButtonTitle: {
      fontFamily: Fonts.fontFamilyBold,
      fontSize: 16,
      lineHeight: 16,
      color: Colors[colorScheme ?? 'light'].text,
    }
  });