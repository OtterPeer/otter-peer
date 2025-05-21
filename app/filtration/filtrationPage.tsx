import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Platform, ScrollView, StatusBar, TouchableOpacity } from "react-native";
import { useRouter, useNavigation } from "expo-router";
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import BackIcon from '@/assets/icons/uicons/angle-small-left.svg';
import SexSelectorOtter from "@/components/custom/sexSelectorOtter";
import SearchingSelectorOtter from "@/components/custom/searchingOtter";
import SliderOtter from "@/components/custom/sliderOtter";
import { useWebRTC } from "@/contexts/WebRTCContext";
import { useTheme } from "@/contexts/themeContext";
import { useTranslation } from "react-i18next";

export default function FiltrationPage(): React.JSX.Element {
  const { userFilterRef, updateUserFilter } = useWebRTC();
  const { t } = useTranslation();
  const router = useRouter();
  const { theme, colorScheme } = useTheme();
  const styles = getStyles(theme);
  const navigation = useNavigation();
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const saveFiltration = async () => {
    try {
      await AsyncStorage.setItem('userFiltration', JSON.stringify(userFilterRef.current));
    } catch (error) {
      console.error('Error saving filtration to AsyncStorage:', error);
    }
  };

  useEffect(() => {
    return () => {
      saveFiltration();
    };
  }, []);

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
        <Text style={styles.headerName}>{t("filtration_page.header_title")}</Text>
      ),
      headerTitleAlign: 'center',
      headerShadowVisible: true,
      headerStyle: {
        backgroundColor: theme.background1,
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
            fill={theme.accent}
          />
          <Text
            style={{
              color: theme.accent,
              fontSize: 18,
              fontFamily: Fonts.fontFamilyRegular,
            }}
          >
            {t("general.back")}
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
            title={t("filtration_page.sex_title")}
            subtitle={t("filtration_page.sex_subtitle")}
            value={userFilterRef.current.selectedSex}
            onChange={(newSex) => updateUserFilter({ ...userFilterRef.current, selectedSex: newSex })}
            multiSelect={true}
          />
          <SliderOtter
            title={t("filtration_page.max_distance_title")}
            subtitle={t("filtration_page.max_distance_subtitle")}
            value={userFilterRef.current.distanceRange}
            onChange={(newDistance) => updateUserFilter({ ...userFilterRef.current, distanceRange: newDistance as number })}
            minValue={5}
            maxValue={100}
            step={1}
            rangeBetween={false}
            onSlidingStart={() => setScrollEnabled(false)}
            onSlidingComplete={() => setScrollEnabled(true)}
          />
          <SliderOtter
            title={t("filtration_page.age_title")}
            subtitle={t("filtration_page.age_subtitle")}
            value={userFilterRef.current.ageRange}
            onChange={(newRange) => updateUserFilter({ ...userFilterRef.current, ageRange: newRange as [number, number] })}
            minValue={18}
            maxValue={100}
            step={1}
            rangeBetween={true}
            onSlidingStart={() => setScrollEnabled(false)}
            onSlidingComplete={() => setScrollEnabled(true)}
          />
          <SearchingSelectorOtter
            title={t("filtration_page.searching_title")}
            subtitle={t("filtration_page.searching_subtitle")}
            value={userFilterRef.current.selectedSearching}
            onChange={(newSearching) => updateUserFilter({ ...userFilterRef.current, selectedSearching: newSearching })}
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
      color: theme.text,
      fontFamily: Fonts.fontFamilyBold,
      marginBottom: 4,
    },
    filtrationSubtitle: {
      fontSize: 14,
      lineHeight: 14,
      color: theme.text2_50,
      fontFamily: Fonts.fontFamilyRegular,
      textAlign: 'center',
    },
    headerName: {
      fontFamily: Fonts.fontFamilyBold,
      color: theme.text,
      marginBottom: 0,
      fontSize: 20,
      lineHeight: 22,
      textAlign: 'center',
      flexShrink: 1,
      paddingHorizontal: 10,
    },
  });