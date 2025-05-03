import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { useColorScheme } from '@/hooks/useColorScheme';

interface ButtonOtterProps {
  onPress: () => void;
  text: any;
  activeOpacity?: number;
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
}

export default function ButtonOtter({ onPress, text, activeOpacity = 0.7, style, textStyle, disabled = false }: ButtonOtterProps): JSX.Element {
  const colorScheme = useColorScheme();
  const styles = getStyles(colorScheme ?? 'light');

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

const getStyles = (colorScheme: 'light' | 'dark') =>
  StyleSheet.create({
    button: {
      width: '100%',
      height: 60,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: Colors[colorScheme].accent,
      borderRadius: 30,
      borderWidth: 2,
      borderColor: Colors[colorScheme].border2,
    },
    buttonTitle: {
      fontSize: 24,
      fontFamily: Fonts.fontFamilyBold,
      lineHeight: 30,
      textAlign: 'center',
      color: Colors[colorScheme].text,
    },
    disabled: {
      opacity: 0.2,
    },
  });