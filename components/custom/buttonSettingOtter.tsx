import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, View } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { useColorScheme } from '@/hooks/useColorScheme';
import TrashIcon from '@/assets/icons/uicons/trash-xmark.svg';
import CrossIcon from '@/assets/icons/uicons/cross-small.svg';
import TriangleIcon from '@/assets/icons/uicons/triangle-warning.svg';

interface ButtonSettingOtterProps {
  onPress: () => void;
  text: any;
  activeOpacity?: number;
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
  icon?: string;
}

export default function ButtonSettingOtter({
  onPress,
  text,
  activeOpacity = 0.7,
  style,
  textStyle,
  disabled = false,
  icon,
}: ButtonSettingOtterProps): JSX.Element {
  const colorScheme = useColorScheme();
  const styles = getStyles(colorScheme ?? 'light');

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.button, style, disabled && styles.disabled]}
      activeOpacity={activeOpacity}
      disabled={disabled}
    >
      <View style={styles.buttonContent}>
        {icon === 'trash' && (
          <TrashIcon
            height={23}
            width={23}
            fill={Colors[colorScheme ?? 'light'].deleteIcon}
            style={styles.icon}
          />
        )}
        {icon === 'cross' && (
          <CrossIcon
            height={23}
            width={23}
            fill={Colors[colorScheme ?? 'light'].deleteIcon}
            style={styles.icon}
          />
        )}
        <Text style={[styles.buttonTitle, styles.trash, textStyle]}>
          {text}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const getStyles = (colorScheme: 'light' | 'dark') =>
  StyleSheet.create({
    button: {
      width: '100%',
      height: 50,
      justifyContent: 'center',
      backgroundColor: Colors[colorScheme].background2,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: Colors[colorScheme].border1,
      marginBottom: 10,
    },
    buttonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    buttonTitle: {
      fontSize: 20,
      fontFamily: Fonts.fontFamilyRegular,
      color: Colors[colorScheme].text,
    },
    icon: {
      marginLeft: 16,
      marginRight: 16,
    },
    trash: {
      color: Colors[colorScheme].deleteText,
      fontFamily: Fonts.fontFamilyBold,
    },
    cross: {
      color: Colors[colorScheme].deleteText,
      fontFamily: Fonts.fontFamilyBold,
    },
    disabled: {
      opacity: 0.2,
    },
  });