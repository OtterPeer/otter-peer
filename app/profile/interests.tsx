import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  StatusBar,
  ScrollView,
} from "react-native";
import { useRouter, useNavigation } from "expo-router";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { TemporaryProfile } from "@/types/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ButtonOtter from "@/components/custom/buttonOtter";
import InterestsOtter from "@/components/custom/interestsOtter";
import { useTheme } from "@/contexts/themeContext";
import { useTranslation } from "react-i18next";

export default function InterestsPage(): React.JSX.Element {
  const { t } = useTranslation();
  const router = useRouter();
  const { theme, colorScheme } = useTheme();
  const styles = getStyles(theme);
  const navigation = useNavigation();

  const [selectedInterests, setSelectedInterests] = useState<number[]>(new Array(46).fill(0));
  const [isInterestsValid, setIsInterestsValid] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
      gestureEnabled: false,
    });
  }, [navigation]);

  const nextPage = async () => {
    try {
      const storedProfile = await AsyncStorage.getItem('userTemporaryProfile');
      const currentProfile: TemporaryProfile = storedProfile ? JSON.parse(storedProfile) : {};
      const updatedProfile: TemporaryProfile = {
        ...currentProfile,
        interests:selectedInterests,
      };
      await AsyncStorage.setItem('userTemporaryProfile', JSON.stringify(updatedProfile));
      router.push('/profile/final');
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
          <View style={[styles.progressBar, { backgroundColor: theme.accent}]} />
          <View style={[styles.progressBar, { backgroundColor: theme.accent}]} />
          <View style={[styles.progressBar, { backgroundColor: theme.accent}]} />
          <View style={[styles.progressBar, { backgroundColor: theme.background3}]} />
        </View>

        <Text style={styles.pageTitle}>{t("interests_page.page_title")}</Text>
        <InterestsOtter
          subtitle={t("interests_page.page_subtitle")}
          value={selectedInterests}
          onChange={({ interests: newInterests, isInterestsValid }) => {
            setSelectedInterests(newInterests);
            setIsInterestsValid(isInterestsValid);
          }}
          showEmoji={true}
        />
        <ButtonOtter
          text={t("general.next")}
          onPress={nextPage}
          disabled={!isInterestsValid}
        />
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
    pageTitle: {
      fontSize: 32,
      color: theme.text,
      fontFamily: Fonts.fontFamilyBold,
      lineHeight: 32,
      marginBottom: 8,
    }
  });
