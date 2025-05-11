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
import { UserFilter } from "@/types/types";
import { useWebRTC } from "@/contexts/WebRTCContext";

export default function FiltrationPage(): React.JSX.Element {
  const { userFilter, setUserFilter } = useWebRTC();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const styles = getStyles(colorScheme ?? 'light');
  const navigation = useNavigation();
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const saveFiltration = async () => {
    try {
      await AsyncStorage.setItem('userFiltration', JSON.stringify(userFilter));
    } catch (error) {
      console.error('Error saving filtration to AsyncStorage:', error);
    }
  };

  useEffect(() => {
    return () => {
      saveFiltration();
    };
  }, [userFilter]);

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
            value={userFilter.selectedSex}
            onChange={(newSex) => setUserFilter({ ...userFilter, selectedSex: newSex })}
            multiSelect={true}
          />
          <SliderOtter
            title="Maksymalny Dystans"
            subtitle="Do jakiej odległości wydra może odpłynąć?"
            value={userFilter.distanceRange}
            onChange={(newDistance) => setUserFilter({ ...userFilter, distanceRange: newDistance as number })}
            minValue={5}
            maxValue={100}
            step={1}
            rangeBetween={false}
            onSlidingStart={() => setScrollEnabled(false)}
            onSlidingComplete={() => setScrollEnabled(true)}
          />
          <SliderOtter
            title="Wiek"
            subtitle="Wybierz zakres wieku"
            value={userFilter.ageRange}
            onChange={(newRange) => setUserFilter({ ...userFilter, ageRange: newRange as [number, number] })}
            minValue={18}
            maxValue={100}
            step={1}
            rangeBetween={true}
            onSlidingStart={() => setScrollEnabled(false)}
            onSlidingComplete={() => setScrollEnabled(true)}
          />
          <SearchingSelectorOtter
            title="Poszukiwania drugiej wyderki"
            subtitle="Filtruj czego szuka druga wyderka"
            value={userFilter.selectedSearching}
            onChange={(newSearching) => setUserFilter({ ...userFilter, selectedSearching: newSearching })}
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