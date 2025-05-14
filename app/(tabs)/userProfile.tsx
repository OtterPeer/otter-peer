import { Text, View, StyleSheet, TouchableOpacity, Platform, StatusBar, Alert, LayoutChangeEvent, DevSettings, Appearance } from 'react-native';
import React, { useEffect, useState, useRef } from 'react';
import { useWebRTC } from '../../contexts/WebRTCContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Profile } from '../../types/types';
import { Fonts } from '@/constants/Fonts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { clearDatabase } from '../chat/chatUtils';
import PagerView from 'react-native-pager-view';

import Card from '@/components/custom/cardProfileOtter';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import ImagePickerComponent from '@/components/custom/imagePickerOtter';
import InputOtter from '@/components/custom/inputOtter';
import DescriptionOtter from '@/components/custom/descriptionOtter';
import DatePicker from '@/components/custom/datePickerOtter';
import SexSelectorOtter from '@/components/custom/sexSelectorOtter';
import SearchingSelectorOtter from '@/components/custom/searchingOtter';
import { searchingOptions } from '@/constants/SearchingOptions';
import InterestsOtter from '@/components/custom/interestsOtter';
import { interestsOptions } from '@/constants/InterestsOptions';

import OtterIcon from "@/assets/icons/uicons/otter.svg";
import SettingsIcon from '@/assets/icons/uicons/settings.svg';
import EncoderModel, { BooleanArray46 } from '@/contexts/ai/encoder-model';
import { deleteGeoPrivateKey } from '@/contexts/geolocation/geolocation';
import { removeFiltration } from '../filtration/filtrationUtils';

const userProfile: React.FC = () => {
  const { profile } = useWebRTC();
  const [resolvedProfile, setResolvedProfile] = useState<Profile | null>(null);
  const [profilePicTemp, setProfilePicTemp] = useState<string | null>(null);
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [day, setDay] = useState<number | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [isDateValid, setIsDateValid] = useState(true);
  const [selectedSex, setSelectedSex] = useState<number[]>(new Array(3).fill(0));
  const [selectedSexInterest, setSelectedSexInterest] = useState<number[]>(new Array(3).fill(0));
  const [selectedSearching, setSelectedSearching] = useState<number[]>(new Array(searchingOptions.length).fill(0));
  const [selectedInterests, setSelectedInterests] = useState<number[]>(new Array(interestsOptions.length).fill(0));
  const [isInterestsValid, setIsInterestsValid] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

  const [x, setX] = useState<number>();
  const [y, setY] = useState<number>();

  const scrollViewRef = useRef<KeyboardAwareScrollView>(null);
  const pagerViewRef = useRef<PagerView>(null);

  const colorScheme = useColorScheme();
  const styles = getStyles(colorScheme ?? 'light');

  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    if (Appearance.getColorScheme() !== 'dark') {
      Appearance.setColorScheme('dark');
    }
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profileData = await profile;
        if (profileData) {
          setProfilePicTemp(profileData.profilePic);
          setName(profileData.name || '');
          setDescription(profileData.description || '');
          setDay(profileData.birthDay ?? null);
          setMonth(profileData.birthMonth ?? null);
          setYear(profileData.birthYear ?? null);
          setSelectedSex(profileData.sex || new Array(3).fill(0));
          setSelectedSexInterest(profileData.interestSex || new Array(3).fill(0));
          setSelectedSearching(profileData.searching || new Array(searchingOptions.length).fill(0));
          setSelectedInterests(profileData.interests || new Array(interestsOptions.length).fill(0));
          setIsInterestsValid(
            (profileData.interests || new Array(interestsOptions.length).fill(0)).reduce((sum, val) => sum + val, 0) === 5
          );
          setX(profileData.x)
          setY(profileData.y)
        }
        setResolvedProfile(profileData);
      } catch (error) {
        console.error('Error resolving profile:', error);
        setResolvedProfile(null);
      }
    };
    loadProfile();
  }, [profile]);

  const handleContainerLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setContainerHeight(height - 16);
  };

  const deleteProfile = async () => {
    try {
      await clearDatabase();
      await AsyncStorage.removeItem('userProfile');
      await AsyncStorage.removeItem('userTemporaryProfile');
      await AsyncStorage.removeItem('privateKey');
      deleteGeoPrivateKey()
      removeFiltration()
      router.replace('/profile/rules');
    } catch (error) {
      console.error('Error deleting profile:', error);
    }
  };

  const generateInterestsXY = async (selectedInterests: any) => {
    const autoencoderModel = new EncoderModel();
    await autoencoderModel.initialize();

    const result = await autoencoderModel.predict(selectedInterests as BooleanArray46)

    console.log("X value",result[0]) // value of x
    console.log("Y value",result[1]) // value of y

    autoencoderModel.dispose();

    return result
  }

  const updateProfile = async () => {
    const invalidSymbolsRegex = /[-_@#$%&*+=\[\]{}|\\\/^~`,.?!:;"'<>()]/;
    if (!profilePicTemp) {
      Alert.alert('🦦', 'Wyderka zgubiła Twoje zdjęcie');
      return;
    }
    if (!name.trim()) {
      Alert.alert('🦦', 'Wyderce nie wydaje się że nie masz imienia');
      return;
    }
    if (invalidSymbolsRegex.test(name.trim())) {
      Alert.alert('🦦', 'Wyderce nie podobają się znaki specjalne w imieniu, takie jak -, _, @, #, $, etc.');
      return;
    }
    if (!isDateValid) {
      Alert.alert('🦦', 'Wyderka ma problem z odczytaniem Twojej daty urodzenia');
      return;
    }
    if (!description.trim() == true) {
      Alert.alert('🦦', 'Wyderka ma dobry wzrok ale opisu nie widzi');
      return;
    }
    if (!isInterestsValid) {
      Alert.alert('🦦', 'Wyderka musi znać 5 Twoich zainteresowań');
      return;
    }
    
    try {
      let updatedX = x;
      let updatedY = y;

      const storedProfile = await AsyncStorage.getItem('userProfile');
      const currentProfile: Profile = storedProfile ? JSON.parse(storedProfile) : {};

      const previousInterests = currentProfile.interests || new Array(interestsOptions.length).fill(0);
      const interestsChanged = !selectedInterests.every((val: number, index: number) => val === previousInterests[index]);

      if (selectedInterests !== null && isInterestsValid && interestsChanged) {
        console.log("Interests changed, generating new XY");
        const result = await generateInterestsXY(selectedInterests);
        updatedX = result[0];
        updatedY = result[1];
        setX(updatedX);
        setY(updatedY);
      } else if (!interestsChanged) {
        console.log("Interests unchanged, reusing existing XY");
        updatedX = currentProfile.x;
        updatedY = currentProfile.y;
      }

      const updatedProfile: Profile = {
        ...currentProfile,
        ...(profilePicTemp !== null && { profilePic: profilePicTemp }),
        ...(name !== null && { name: name }),
        ...(!description.trim() == false && { description: description }),
        ...(day !== null && isDateValid && { birthDay: day }),
        ...(month !== null && isDateValid && { birthMonth: month }),
        ...(year !== null && isDateValid && { birthYear: year }),
        ...(selectedSex !== null && { sex: selectedSex }),
        ...(selectedSexInterest !== null && { interestSex: selectedSexInterest }),
        ...(selectedSearching !== null && { searching: selectedSearching }),
        ...(selectedInterests !== null && isInterestsValid && { interests: selectedInterests, x: updatedX, y: updatedY }),
      };
      await AsyncStorage.setItem('userProfile', JSON.stringify(updatedProfile));

      // Reloading the app
      Alert.alert('🦦', 'Wyderka zapisała Twój profil!', [
        {
          text: 'Odśwież aplikację',
          onPress: () => {
            DevSettings.reload();
          },
        },
      ]);
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('🦦', 'Wyderka napotkała problem podczas zapisywania profilu');
    }
  };

  const handlePageChange = (e: { nativeEvent: { position: number } }) => {
    setCurrentPage(e.nativeEvent.position);
  };

  const navigateToPage = (pageIndex: number) => {
    pagerViewRef.current?.setPage(pageIndex);
    setCurrentPage(pageIndex);
  };

  const settingsPage = () => {
    router.push("../settings/settingsPage")
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', "top"]}>
      <StatusBar
        backgroundColor="transparent"
        translucent={true}
        barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
      />

      <View style={styles.logoHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <OtterIcon
            height={21}
            width={21}
            fill={Colors[colorScheme ?? "light"].accent}
          />
          <Text style={styles.logoText}>OtterPeer</Text>
        </View>
        <TouchableOpacity onPress={() => settingsPage()} activeOpacity={0.7} style={styles.settingsIcon}>
          <SettingsIcon height={21} width={21} fill={Colors[colorScheme ?? "light"].icon} />
        </TouchableOpacity>
      </View>

      <View style={[styles.progressBarsContainer, { backgroundColor: Colors[colorScheme ?? 'light'].background1 }]}>
        <View style={styles.progressBars}>
          <View
            style={[
              styles.progressBar,
              { backgroundColor: currentPage === 0 ? Colors[colorScheme ?? 'light'].accent : Colors[colorScheme ?? 'light'].background3 },
            ]}
          />
          <View
            style={[
              styles.progressBar,
              { backgroundColor: currentPage === 1 ? Colors[colorScheme ?? 'light'].accent : Colors[colorScheme ?? 'light'].background3 },
            ]}
          />
        </View>
        <View style={styles.progressLabels}>
          <View style={styles.progressLabelContainer}>
            <TouchableOpacity onPress={() => navigateToPage(0)} activeOpacity={0.7}>
              <Text
                style={[
                  styles.progressLabel,
                  currentPage === 0 && { color: Colors[colorScheme ?? 'light'].accent },
                ]}
              >
                Podgląd
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.progressLabelContainer}>
            <TouchableOpacity onPress={() => navigateToPage(1)} activeOpacity={0.7}>
              <Text
                style={[
                  styles.progressLabel,
                  currentPage === 1 && { color: Colors[colorScheme ?? 'light'].accent },
                ]}
              >
                Edytuj
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <PagerView
        style={styles.pagerView}
        initialPage={0}
        onPageSelected={handlePageChange}
        ref={pagerViewRef}
      >
        {/* Page 1: Preview */}
        <View key="1" style={styles.page}>
          <View style={styles.previewContainer} onLayout={handleContainerLayout}>
            {resolvedProfile ? (
              <Card profile={resolvedProfile} containerHeight={containerHeight} showDistance={false}/>
            ) : (
              <Text style={styles.noProfileText}>No profile data available</Text>
            )}
          </View>
        </View>

        {/* Page 2: Edit Profile */}
        <View key="2" style={styles.page}>
          <KeyboardAwareScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={true}
            enableOnAndroid={true}
            extraScrollHeight={Platform.OS === 'ios' ? 100 : 0}
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
            keyboardOpeningTime={250}
            enableResetScrollToCoords={false}
            enableAutomaticScroll={true}
          >
            {resolvedProfile ? (
              <View style={styles.selfProfileContainer}>
                <Text style={styles.avatarTitle}>Zmień zdjęcie profilowe</Text>
                <Text style={styles.avatarSubtitle}>Tak będziesz wyglądać w konwersacjach</Text>
                <Text style={styles.avatarSubtitle}>x: {resolvedProfile.x}</Text>
                <Text style={styles.avatarSubtitle}>y: {resolvedProfile.y}</Text>
                <Text style={styles.avatarSubtitle}>Lat: {resolvedProfile.latitude}</Text>
                <Text style={styles.avatarSubtitle}>Lon: {resolvedProfile.longitude}</Text>
                <ImagePickerComponent
                  profilePic={resolvedProfile.profilePic}
                  onImageChange={(base64) => {
                    setProfilePicTemp(base64);
                  }}
                />
                <View style={styles.selfProfileStats}>
                  <View style={styles.inputContainer}>
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
                        setDay(day);
                        setMonth(month);
                        setYear(year);
                        setIsDateValid(isValid);
                        if (!isValid) {
                          console.log('Invalid date selection:', { day, month, year });
                        }
                        if (!isOver18) {
                          console.log('Not over 18:', date);
                          setYear(null);
                        }
                        if (date && isValid && isOver18) {
                          console.log('Valid date selected:', date);
                        }
                      }}
                      dayValue={day ?? undefined}
                      monthValue={month ?? undefined}
                      yearValue={year ?? undefined}
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
                    />
                    <SearchingSelectorOtter
                      title="Szukam"
                      subtitle="Zamień czego szukasz!"
                      value={selectedSearching}
                      onChange={(newSearching) => setSelectedSearching(newSearching)}
                      showEmoji={true}
                      showDescription={false}
                    />
                    <InterestsOtter
                      title="Zainteresowania"
                      subtitle="Zmień swoje zainteresowania! Możesz wybrać tylko"
                      value={selectedInterests}
                      onChange={({ interests: newInterests, isInterestsValid }) => {
                        setSelectedInterests(newInterests);
                        setIsInterestsValid(isInterestsValid);
                      }}
                      showEmoji={true}
                    />
                  </View>
                </View>
              </View>
            ) : (
              <Text style={styles.noProfileText}>No profile data available</Text>
            )}

            <TouchableOpacity onPress={updateProfile} style={styles.saveButton} activeOpacity={0.7}>
              <Text style={styles.saveButtonTitle}>Zapisz</Text>
            </TouchableOpacity>

            <View style={styles.lineSpacer} />

            <TouchableOpacity onPress={deleteProfile} style={styles.deleteButton} activeOpacity={0.7}>
              <Text style={styles.deleteButtonTitle}>USUŃ PROFIL</Text>
            </TouchableOpacity>
            <View style={styles.bottomSpacer} />
          </KeyboardAwareScrollView>
        </View>
      </PagerView>
    </SafeAreaView>
  );
};

const getStyles = (colorScheme: 'light' | 'dark' | null) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: Colors[colorScheme ?? 'light'].background1,
    },
    pagerView: {
      flex: 1,
      backgroundColor: Colors[colorScheme ?? 'light'].background1,
    },
    page: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
      backgroundColor: Colors[colorScheme ?? 'light'].background1,
    },
    progressBarsContainer: {
      width: '100%',
      paddingHorizontal: 20,
      marginTop: 16,
      backgroundColor: Colors[colorScheme ?? 'light'].background1,
    },
    progressBars: {
      flexDirection: 'row',
      width: '100%',
      gap: 8,
    },
    progressBar: {
      height: 6,
      flex: 1,
      borderRadius: 3,
    },
    progressLabels: {
      flexDirection: 'row',
      marginTop: 4,
    },
    progressLabelContainer: {
      flex: 1,
      alignItems: 'center',
    },
    progressLabel: {
      fontSize: 20,
      fontFamily: Fonts.fontFamilyBold,
      color: Colors[colorScheme ?? 'light'].text2_50,
      textAlign: 'center',
      paddingBottom: 16,
    },
    contentContainer: {
      flexGrow: 1,
      paddingLeft: 20,
      paddingRight: 20,
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100%',
      backgroundColor: Colors[colorScheme ?? 'light'].background1,
      ...Platform.select({
        android: {
          elevation: 0,
        },
      }),
    },
    previewContainer: {
      flex: 1,
      alignItems: 'center',
      backgroundColor: Colors[colorScheme ?? 'light'].background1,
    },
    bottomSpacer: {
      height: Platform.OS === 'ios' ? 34 : 24,
    },
    selfProfileContainer: {
      alignItems: 'center',
      marginBottom: 16,
      width: '100%',
    },
    selfProfileStats: {
      alignItems: 'center',
      width: '100%',
    },
    inputContainer: {
      width: '100%',
      alignItems: 'flex-start',
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
      marginBottom: 0,
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
      marginBottom: 16,
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
    logoHeader: {
      flexDirection: "row",
      width: "100%",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: Platform.OS === 'ios' ? 8 : 16,
      paddingHorizontal: 20,
      backgroundColor: Colors[colorScheme ?? "light"].background1,
    },
    logoText: {
      fontSize: 24,
      color: Colors[colorScheme ?? "light"].text,
      fontFamily: Fonts.fontFamilyBold,
      lineHeight: 26,
      paddingTop: 3,
    },
    lineSpacer: {
      borderTopWidth: 1,
      borderColor: Colors[colorScheme ?? "light"].border1,
      width: "80%",
      marginTop: 16,
      marginBottom: 16,
    },
    settingsIcon: {
      paddingLeft: 30,
      paddingRight: 20,
      right: -20,
    }
  });

export default userProfile;