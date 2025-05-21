import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform, ScrollView, TouchableOpacity, Button, StatusBar } from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import BackIcon from '@/assets/icons/uicons/angle-small-left.svg';
import { useTheme } from '@/contexts/themeContext';
import ThemeSelectorOtter from '@/components/custom/themeSelectorOtter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LanguageSelectorOtter from '@/components/custom/languageSelectorOtter';
import { useTranslation } from 'react-i18next';

export default function SettingsPage(): React.JSX.Element {
  const { theme, setColorScheme } = useTheme();
  const styles = getStyles(theme);
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [selectedTheme, setSelectedTheme] = useState<string>('system');
  const [selectedLanguage, setSelectedLanguage] = useState<string>();

   useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('appTheme');
        setSelectedTheme(savedTheme || 'system');
      } catch (error) {
        console.error('Failed to load theme from AsyncStorage:', error);
      }
    };
    loadTheme();
  }, []);

  useEffect(() =>{
    const loadLanguage = async () => {
      const savedLanguage = await AsyncStorage.getItem('language');
      setSelectedLanguage(savedLanguage || "en"); // Default language
    };
    loadLanguage();
  }, [selectedLanguage])

  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      gestureEnabled: true,
      headerTitle: () => (
        <Text style={styles.headerName}>{t('settings_page.settings_page_title')}</Text>
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
          <BackIcon width={24} height={24} fill={theme.accent} />
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
  }, [navigation, theme, t]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background1 }]} edges={['left', 'right']}>
      <ScrollView
        style={[styles.scrollView, { backgroundColor: theme.background1 }]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.topSpacer} />

        <ThemeSelectorOtter
          title={t("settings_page.theme_selector_title")}
          subtitle={t("settings_page.theme_selector_subtitle")}
          value={selectedTheme}
          onChange={(selected) => {
            setSelectedTheme(selected);
            setColorScheme(selected as 'light' | 'dark' | 'system');
          }}
        />

        <LanguageSelectorOtter
          title={t('settings_page.language_chooser_title')}
          subtitle={t('settings_page.language_chooser_subtitle')}
          value={selectedLanguage}
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
    },
    scrollView: {
      flex: 1,
    },
    contentContainer: {
      flexGrow: 1,
      paddingLeft: 20,
      paddingRight: 20,
      paddingBottom: 30,
      justifyContent: 'flex-start',
      alignItems: 'center',
      minHeight: '100%',
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
    settingsContainter: {
      marginBottom: 36,
      borderRadius: 10,
      padding: 10,
    },
    settingContainter: {
      alignItems: 'center',
      marginBottom: 16,
    },
    settingTitle: {
      fontSize: 24,
      lineHeight: 24,
      color: theme.text,
      fontFamily: Fonts.fontFamilyBold,
      marginBottom: 4,
    },
    settingSubtitle: {
      fontSize: 14,
      lineHeight: 14,
      color: theme.text2_50,
      fontFamily: Fonts.fontFamilyRegular,
      textAlign: 'center',
      marginBottom: 12,
    },
    buttonContainer: {
      gap: 8,
      width: '100%',
      alignItems: 'center',
    },
    headerName: {
      fontFamily: Fonts.fontFamilyBold,
      color: theme.text,
      fontSize: 20,
      lineHeight: 22,
      textAlign: 'center',
      flexShrink: 1,
      paddingHorizontal: 10,
    },
  });