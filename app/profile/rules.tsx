import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Platform, ScrollView, StatusBar } from "react-native";
import { useRouter, useNavigation } from "expo-router";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { useColorScheme } from '@/hooks/useColorScheme';
import OtterHeartIcon from "@/assets/icons/logo/OtterPeerHeart.svg";
import RuleBadgeIcon from '@/assets/icons/uicons/badge-check.svg';
import ButtonOtter from "@/components/custom/buttonOtter";
import { useTheme } from "@/contexts/themeContext";
import LanguageSelectorOtter from "@/components/custom/languageSelectorOtter";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";

export default function ProfileScreen(): React.JSX.Element {
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, colorScheme } = useTheme();
  const styles = getStyles(theme);
  const navigation = useNavigation();
  const [selectedLanguage, setSelectedLanguage] = useState<string>();

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
      gestureEnabled: false,
    });
  }, [navigation]);

  useEffect(() =>{
    const loadLanguage = async () => {
      const savedLanguage = await AsyncStorage.getItem('language');
      setSelectedLanguage(savedLanguage || "en"); // Default language
    };
    loadLanguage();
  }, [selectedLanguage])

  const nextPage = () => {
    router.push("/profile/create")
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
        <View style={styles.topSpacer} />
        <View style={styles.logoContainer}>
          <OtterHeartIcon
            style={styles.logo}
            height={95}
            width={100}
          />
          <Text style={styles.logoTitle}>OtterPeer</Text>
        </View>

        <View style={styles.rulesContainer}>
          <View style={styles.ruleContainer}>
            <LanguageSelectorOtter
              value={selectedLanguage}
            />
            <Text style={styles.ruleSubtitle}>{t("rule_page.choose_language_subtitle")}</Text>
          </View>
          <View style={styles.ruleContainer}>
            <RuleBadgeIcon style={styles.ruleCheckmark} width={30} height={30} fill={theme.accent} />
            <Text style={styles.ruleTitle}>{t("rule_page.rule_1_title")}</Text>
            <Text style={styles.ruleSubtitle}>{t("rule_page.rule_1_subtitle")}</Text>
          </View>
          <View style={styles.ruleContainer}>
            <RuleBadgeIcon style={styles.ruleCheckmark} width={30} height={30} fill={theme.accent} />
            <Text style={styles.ruleTitle}>{t("rule_page.rule_2_title")}</Text>
            <Text style={styles.ruleSubtitle}>{t("rule_page.rule_2_subtitle")}</Text>
          </View>
          <View style={styles.ruleContainer}>
            <RuleBadgeIcon style={styles.ruleCheckmark} width={30} height={30} fill={theme.accent} />
            <Text style={styles.ruleTitle}>{t("rule_page.rule_3_title")}</Text>
            <Text style={styles.ruleSubtitle}>{t("rule_page.rule_3_subtitle")}</Text>
          </View>
          <View style={styles.ruleContainer}>
            <RuleBadgeIcon style={styles.ruleCheckmark} width={30} height={30} fill={theme.accent} />
            <Text style={styles.ruleTitle}>{t("rule_page.rule_4_title")}</Text>
            <Text style={styles.ruleSubtitle}>{t("rule_page.rule_4_subtitle")}</Text>
          </View>
        </View>

        <ButtonOtter
          text={t("general.agree")}
          onPress={nextPage}
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
      justifyContent: 'center',
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
    logoContainer: {
      alignItems: 'center',
      borderRadius: 10,
    },
    logo: {
      marginBottom: 0,
    },
    logoTitle: {
      fontSize: 48,
      color: theme.text,
      fontFamily: Fonts.fontFamilyBold,
      lineHeight: 48,
    },
    rulesContainer: {
      borderRadius: 10,
      padding: 10,
    },
    ruleContainer: {
      alignItems: 'center',
      marginBottom: 8,
    },
    ruleCheckmark: {
      marginBottom: 4,
    },
    ruleTitle: {
      fontSize: 24,
      lineHeight: 24,
      textAlign: 'center',
      color: theme.text,
      fontFamily: Fonts.fontFamilyBold,
      marginBottom: 4,
    },
    ruleSubtitle: {
      fontSize: 14,
      lineHeight: 14,
      color: theme.text2_50,
      fontFamily: Fonts.fontFamilyRegular,
      textAlign: 'center',
      marginBottom: 8,
    }
  });