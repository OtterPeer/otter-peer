import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Platform, ScrollView, StatusBar, TouchableOpacity } from "react-native";
import { useRouter, useNavigation } from "expo-router";
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { useColorScheme } from '@/hooks/useColorScheme';
import BackIcon from '@/assets/icons/uicons/angle-small-left.svg';
import SexSelectorOtter from "@/components/custom/sexSelectorOtter";
import { searchingOptions } from "@/constants/SearchingOptions";
import SearchingSelectorOtter from "@/components/custom/searchingOtter";
import SliderOtter from "@/components/custom/sliderOtter";
import { userFiltration } from "@/types/types";

export default function FiltrationPage(): React.JSX.Element {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const styles = getStyles(colorScheme ?? 'light');
  const navigation = useNavigation();
  const [selectedSex, setSelectedSex] = useState<number[]>(new Array(3).fill(0));
  const [selectedSearching, setSelectedSearching] = useState<number[]>(new Array(searchingOptions.length).fill(0));
  const [distanceRange, setDistanceRange] = useState<number>(50);
  const [ageRange, setAgeRange] = useState<[number, number]>([18, 80]);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const saveFiltration = async () => {
    try {
      const filtration: userFiltration = {
        sex: selectedSex,
        distance: distanceRange,
        age: ageRange,
        searching: selectedSearching,
      };
      await AsyncStorage.setItem('userFiltration', JSON.stringify(filtration));
    } catch (error) {
      console.error('Error saving filtration to AsyncStorage:', error);
    }
  };

  const loadFiltration = async () => {
    try {
      const storedFiltration = await AsyncStorage.getItem('userFiltration');
      if (storedFiltration) {
        const filtration: userFiltration = JSON.parse(storedFiltration);
        if (filtration.sex) setSelectedSex(filtration.sex);
        if (filtration.distance !== undefined) setDistanceRange(filtration.distance);
        if (filtration.age) setAgeRange([filtration.age[0], filtration.age[1]]);
        if (filtration.searching) setSelectedSearching(filtration.searching);
      }
    } catch (error) {
      console.error('Error loading filtration from AsyncStorage:', error);
    }
  };

  useEffect(() => {
    loadFiltration();
  }, []);

  useEffect(() => {
    return () => {
      saveFiltration();
    };
  }, [selectedSex, selectedSearching, distanceRange, ageRange]);

  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      gestureEnabled: true,
    });
  }, [navigation]);

  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      gestureEnabled: true,
      headerTitle: () => (
        <Text style={styles.headerName}>Filtrowanie</Text>
      ),
      headerTitleAlign: 'center',
      headerShadowVisible: true,
      headerStyle: {
        backgroundColor: Colors[colorScheme ?? 'light'].background1,
      },
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingRight: 8,
          }}
        >
          <BackIcon
            width={24}
            height={24}
            fill={Colors[colorScheme ?? 'light'].accent}
          />
          <Text
            style={{
              color: Colors[colorScheme ?? 'light'].accent,
              fontSize: 18,
              fontFamily: Fonts.fontFamilyRegular,
            }}
          >
            Back
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, colorScheme]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <StatusBar
        backgroundColor="transparent"
        translucent={true}
        barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}/>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
        scrollEnabled={scrollEnabled}>
        <View style={styles.topSpacer} />

        <View style={styles.filtrationsContainer}>
          <SexSelectorOtter
            title="Płeć"
            subtitle="Jakiej płci szukasz?"
            value={selectedSex}
            onChange={(newSex) => setSelectedSex(newSex)}
            multiSelect={true}
          />
          <SliderOtter
            title="Maksymalny Dystans"
            subtitle="Do jakiej odległości wydra może odpłynąć?"
            value={distanceRange}
            onChange={(newDistance) => setDistanceRange(newDistance as number)}
            minValue={1}
            maxValue={100}
            step={1}
            rangeBetween={false}
            onSlidingStart={() => setScrollEnabled(false)}
            onSlidingComplete={() => setScrollEnabled(true)}
          />
          <SliderOtter
            title="Wiek"
            subtitle="Wybierz zakres wieku"
            value={ageRange}
            onChange={(newRange) => setAgeRange(newRange as [number, number])}
            minValue={18}
            maxValue={100}
            step={1}
            rangeBetween={true}
            onSlidingStart={() => setScrollEnabled(false)}
            onSlidingComplete={() => setScrollEnabled(true)}
          />
          <SearchingSelectorOtter
            title="Szukam"
            subtitle="Czego szukasz?"
            value={selectedSearching}
            onChange={(newSearching) => setSelectedSearching(newSearching)}
            showEmoji={true}
            showDescription={false}
            multiSelect={true}
          />
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
      height: 20,
    },
    bottomSpacer: {
      height: Platform.OS === 'ios' ? 34 : 24,
    },
    filtrationsContainer: {
      marginBottom: 36,
      borderRadius: 10,
      padding: 10,
      width: "100%",
    },
    filtrationTitle: {
      fontSize: 24,
      lineHeight: 24,
      color: Colors[colorScheme ?? 'light'].text,
      fontFamily: Fonts.fontFamilyBold,
      marginBottom: 4,
    },
    filtrationSubtitle: {
      fontSize: 14,
      lineHeight: 14,
      color: Colors[colorScheme ?? 'light'].text2_50,
      fontFamily: Fonts.fontFamilyRegular,
      textAlign: 'center',
    },
    headerName: {
      fontFamily: Fonts.fontFamilyBold,
      color: Colors[colorScheme ?? 'light'].text,
      marginBottom: 0,
      fontSize: 20,
      lineHeight: 22,
      textAlign: 'center',
      flexShrink: 1,
      paddingHorizontal: 10,
    },
  });