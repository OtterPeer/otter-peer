import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTheme } from '@/contexts/themeContext';

interface ButtonOtterProps {
  onPress: () => void;
  text: any;
  activeOpacity?: number;
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
}

export default function ButtonOtter({ onPress, text, activeOpacity = 0.7, style, textStyle, disabled = false }: ButtonOtterProps): JSX.Element {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.button, style, disabled && styles.disabled]}
      activeOpacity={activeOpacity}
      disabled={disabled}
    >
      <Text style={[styles.buttonTitle, textStyle]}>{text}</Text>
    </TouchableOpacity>
  );
}

const getStyles = (theme: typeof Colors.light) =>
  StyleSheet.create({
    button: {
      width: '100%',
      height: 60,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.accent,
      borderRadius: 30,
      borderWidth: 2,
      borderColor: theme.border2,
    },
    buttonTitle: {
      fontSize: 24,
      fontFamily: Fonts.fontFamilyBold,
      lineHeight: 30,
      textAlign: 'center',
      color: theme.textButton,
    },
    disabled: {
      opacity: 0.2,
    },
  });