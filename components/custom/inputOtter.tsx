import React from 'react';
import { View, Text, TextInput, StyleSheet, ViewStyle, TextStyle, TextInputProps } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { useTheme } from '@/contexts/themeContext';
import { useTranslation } from 'react-i18next';

interface InputOtterProps extends TextInputProps {
  title?: string;
  subtitle?: string;
  containerStyle?: ViewStyle;
  titleStyle?: TextStyle;
  subtitleStyle?: TextStyle;
  inputStyle?: TextStyle;
  disabled?: boolean;
  maxChar?: number;
}

export default function InputOtter({
  title,
  subtitle,
  containerStyle,
  titleStyle,
  subtitleStyle,
  inputStyle,
  disabled = false,
  placeholder = 'Aaa',
  placeholderTextColor,
  value,
  maxChar,
  onChangeText,
  ...textInputProps
}: InputOtterProps): JSX.Element {
  const { theme, colorScheme } = useTheme();
  const styles = getStyles(theme);
  const { t } = useTranslation();

  return (
    <View style={[styles.inputContainer, containerStyle]}>
      {title && <Text style={[styles.inputTitle, titleStyle]}>{title}</Text>}
      {subtitle && <Text style={[styles.inputSubtitle, subtitleStyle]}>{subtitle}</Text>}
      {maxChar && 
        <Text style={styles.inputSubtitle}>
          {t("components.input_otter.max_char")}<Text style={styles.charCount}>{(value?.length || 0)}/{maxChar}</Text>
        </Text>
      }
      <TextInput
        style={[styles.inputName, inputStyle, disabled && styles.disabledInput]}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor ?? theme.inputPlaceholder}
        value={value}
        onChangeText={onChangeText}
        editable={!disabled}
        maxLength={maxChar}
        {...textInputProps}
      />
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
    inputName: {
      width: '100%',
      height: 60,
      backgroundColor: theme.background2,
      borderRadius: 15,
      borderWidth: 2,
      borderColor: theme.border1,
      fontSize: 24,
      fontFamily: Fonts.fontFamilyBold,
      color: theme.text,
      paddingHorizontal: 10,
    },
    disabledInput: {
      opacity: 0.5,
    },
    charCount: {
      fontSize: 14,
      fontFamily: Fonts.fontFamilyRegular,
      color: theme.accent,
      alignSelf: 'flex-start',
    },
  });