import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  StatusBar,
  Alert,
  ScrollView,
} from "react-native";
import { useRouter, useNavigation } from "expo-router";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { useColorScheme } from '@/hooks/useColorScheme';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TemporaryProfile } from "@/types/types";
import ButtonOtter from "@/components/custom/buttonOtter";
import SearchingSelectorOtter from "@/components/custom/searchingOtter";
import { searchingOptions } from '@/constants/SearchingOptions';

export default function SearchingPage(): React.JSX.Element {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const styles = getStyles(colorScheme ?? 'light');
  const navigation = useNavigation();

  const [selectedSearching, setSelectedSearching] = useState<number[]>(new Array(searchingOptions.length).fill(0));

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
      gestureEnabled: false,
    });
  }, [navigation]);

  const nextPage = async () => {
    if(!selectedSearching.some(value => value === 1)){
      Alert.alert('🦦', 'Wyderka nie wie czego szukasz');
      return;
    }
    try {
      const storedProfile = await AsyncStorage.getItem('userTemporaryProfile');
      const currentProfile: TemporaryProfile = storedProfile ? JSON.parse(storedProfile) : {};
      const updatedProfile: TemporaryProfile = {
        ...currentProfile,
        searching:selectedSearching,
      };
      await AsyncStorage.setItem('userTemporaryProfile', JSON.stringify(updatedProfile));
      router.push('/profile/interests')
    } catch (error) {
      console.error('Error updating temporary profile:', error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <StatusBar
        backgroundColor="transparent"
        translucent={true}
        barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.topSpacer} />

        <View style={styles.progressBars}>
          <View style={[styles.progressBar, { backgroundColor: Colors[colorScheme ?? 'light'].accent}]}/>
          <View style={[styles.progressBar, { backgroundColor: Colors[colorScheme ?? 'light'].accent}]}/>
          <View style={[styles.progressBar, { backgroundColor: Colors[colorScheme ?? 'light'].background3}]}/>
          <View style={[styles.progressBar, { backgroundColor: Colors[colorScheme ?? 'light'].background3}]}/>
        </View>

        <Text style={styles.pageTitle}>Szukam</Text>
        <Text style={styles.pageSubtitle}>Wybierz, czego szukasz, i daj znać, jak chcesz popłynąć przez świat znajomości z nutką wydrzego uroku!</Text>
        <SearchingSelectorOtter
          value={selectedSearching}
          onChange={(newSearching) => setSelectedSearching(newSearching)}
          showEmoji={true}
          showDescription={true}
        />
        <ButtonOtter
          text="Dalej"
          onPress={nextPage}
        />
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
      marginBottom: 8,
    },
    pageSubtitle: {
      fontSize: 14,
      lineHeight: 14,
      fontFamily: Fonts.fontFamilyRegular,
      textAlign: 'center',
      color: Colors[colorScheme ?? 'light'].text2_50,
      marginBottom: 32,
    },
  });