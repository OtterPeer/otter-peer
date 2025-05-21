import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { useTheme } from '@/contexts/themeContext';
import { useTranslation } from 'react-i18next';

interface ThemeSelectorOtterProps {
  title?: string;
  subtitle?: string;
  value?: string;
  onChange?: (selected: string) => void;
}

const themeOptions = ['Light', 'Dark', 'System'];

export default function ThemeSelectorOtter({ 
  title, 
  subtitle, 
  value = 'system', 
  onChange 
}: ThemeSelectorOtterProps): JSX.Element {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const { t } = useTranslation();

  const [selectedTheme, setSelectedTheme] = useState<string>(value);

  useEffect(() => {
    setSelectedTheme(value);
  }, [value]);

  const handleThemePress = (theme: string) => {
    setSelectedTheme(theme.toLowerCase());
    onChange?.(theme.toLowerCase());
  };

  return (
    <View style={styles.inputContainer}>
      <Text style={styles.inputTitle}>{title}</Text>
      <Text style={styles.inputSubtitle}>{subtitle}</Text>
      <View style={styles.themeButtons}>
        {themeOptions.map((themeOption) => (
          <TouchableOpacity
            key={themeOption}
            onPress={() => handleThemePress(themeOption)}
            style={[
              styles.themeButton,
              selectedTheme.toLowerCase() === themeOption.toLowerCase() && styles.selectedThemeButton,
            ]}
            activeOpacity={0.9}
          >
            <Text style={styles.themeButtonTitle}>{t("themeSelectorOtter."+themeOption)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const getStyles = (theme: typeof Colors.light) =>
  StyleSheet.create({
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
    themeButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 10,
    },
    themeButton: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 20,
      borderWidth: 2,
      borderColor: theme.border1,
    },
    selectedThemeButton: {
      borderColor: theme.accent,
    },
    themeButtonTitle: {
      fontFamily: Fonts.fontFamilyBold,
      fontSize: 16,
      lineHeight: 16,
      color: theme.text,
    },
  });