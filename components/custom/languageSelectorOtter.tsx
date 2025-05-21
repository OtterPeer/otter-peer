import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions, Platform } from 'react-native';
import Modal from 'react-native-modal';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { useTheme } from '@/contexts/themeContext';
import { getAvailableLanguages, getLanguageName, saveLanguage } from '@/contexts/languages/i18next';

interface LanguageSelectorOtterProps {
  title?: string;
  subtitle?: string;
  value?: string;
  onChange?: (selected: string) => void;
}

export default function LanguageSelectorOtter({
  title,
  subtitle,
  value = 'pl',
  onChange,
}: LanguageSelectorOtterProps): JSX.Element {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = getStyles(theme);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(value);
  const [isModalVisible, setModalVisible] = useState(false);
  const availableLanguages = getAvailableLanguages();

  useEffect(() => {
    setSelectedLanguage(value);
  }, [value]);

  const handleLanguageSelect = (language: string) => {
    setSelectedLanguage(language);
    saveLanguage(language);
    onChange?.(language);
    setModalVisible(false);
  };

  return (
    <View style={styles.inputContainer}>
      {title && title.trim() !== '' && (
        <Text style={styles.inputTitle}>{title}</Text>
      )}
      {subtitle && subtitle.trim() !== '' && (
        <Text style={styles.inputSubtitle}>{subtitle}</Text>
      )}
      <TouchableOpacity
        style={styles.selectorButton}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.9}
      >
        <Text style={styles.selectorButtonText}>
          {getLanguageName(selectedLanguage) || selectedLanguage}
        </Text>
      </TouchableOpacity>

      <Modal
        isVisible={isModalVisible}
        onBackdropPress={() => setModalVisible(false)}
        style={styles.modal}
        deviceHeight={Dimensions.get('screen').height}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{t('settings_page.language_chooser_title')}</Text>
          <ScrollView
            style={styles.languageList}
            contentContainerStyle={styles.languageListContent}
            showsVerticalScrollIndicator={true}
          >
            {availableLanguages.map((lang: string) => (
              <TouchableOpacity
                key={lang}
                style={[
                  styles.languageButton,
                  selectedLanguage === lang && styles.selectedLanguageButton,
                ]}
                onPress={() => handleLanguageSelect(lang)}
                activeOpacity={0.9}
              >
                <Text style={styles.languageButtonText}>
                  {getLanguageName(lang) || lang}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setModalVisible(false)}
            activeOpacity={0.9}
          >
            <Text style={styles.closeButtonText}>{t('general.close')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const { width, height } = Dimensions.get('window');
const getStyles = (theme: typeof Colors.light) =>
  StyleSheet.create({
    inputContainer: {
      width: '100%',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    inputTitle: {
      fontSize: 14,
      lineHeight: 14,
      fontFamily: Fonts.fontFamilyBold,
      textAlign: 'left',
      color: theme.text,
      marginBottom: 8,
    },
    inputSubtitle: {
      fontSize: 14,
      lineHeight: 14,
      fontFamily: Fonts.fontFamilyRegular,
      textAlign: 'left',
      color: theme.text2_50,
      marginBottom: 8,
    },
    selectorButton: {
      width: '100%',
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 20,
      borderWidth: 2,
      borderColor: theme.border1,
      backgroundColor: theme.background1,
    },
    selectorButtonText: {
      fontFamily: Fonts.fontFamilyBold,
      fontSize: 16,
      lineHeight: 16,
      color: theme.text,
    },
    modal: {
      justifyContent: 'center',
      alignItems: 'center',
      margin: 0,
    },
    modalContent: {
      width: width * 0.8,
      maxHeight: height * 0.7,
      backgroundColor: theme.background1,
      borderRadius: 20,
      padding: 20,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: theme.border1,
      ...Platform.select({
        android: {
          marginTop: -height * 0.05,
        },
      }),
    },
    modalTitle: {
      fontFamily: Fonts.fontFamilyBold,
      fontSize: 18,
      color: theme.text,
      marginBottom: 16,
      textAlign: 'center',
    },
    languageList: {
      width: '100%',
      maxHeight: height * 0.5,
    },
    languageListContent: {
      paddingBottom: 10,
    },
    languageButton: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 30,
      marginVertical: 4,
      borderWidth: 1,
      borderColor: theme.border1,
      alignItems: 'center',
    },
    selectedLanguageButton: {
      borderColor: theme.accent,
      backgroundColor: theme.accent + '20',
    },
    languageButtonText: {
      fontFamily: Fonts.fontFamilyBold,
      fontSize: 16,
      color: theme.text,
    },
    closeButton: {
      marginTop: 16,
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 30,
      borderWidth: 1,
      borderColor: theme.border1,
    },
    closeButtonText: {
      fontFamily: Fonts.fontFamilyBold,
      fontSize: 14,
      color: theme.text,
    },
  });