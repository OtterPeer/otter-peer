import React, { useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TextInputProps,
  TouchableOpacity,
  findNodeHandle,
  AccessibilityProps,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { useColorScheme } from '@/hooks/useColorScheme';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

interface DescriptionOtterProps extends TextInputProps, AccessibilityProps {
  title?: string;
  subtitle?: string;
  containerStyle?: ViewStyle;
  titleStyle?: TextStyle;
  subtitleStyle?: TextStyle;
  inputStyle?: TextStyle;
  disabled?: boolean;
  maxLength?: number;
  scrollViewRef?: React.RefObject<KeyboardAwareScrollView>;
}

export default function DescriptionOtter({
  title = 'Opis',
  subtitle = 'Opisz siebie jak tylko się da!',
  containerStyle,
  titleStyle,
  subtitleStyle,
  inputStyle,
  disabled = false,
  placeholder = 'Napisz coś o sobie',
  placeholderTextColor,
  value = '',
  onChangeText,
  maxLength = 1000,
  scrollViewRef,
  accessibilityLabel = 'Pole opisu',
  accessibilityHint = 'Napisz coś o sobie',
  ...textInputProps
}: DescriptionOtterProps): JSX.Element {
  const colorScheme = useColorScheme();
  const styles = getStyles(colorScheme ?? 'light');
  const descriptionInputRef = useRef<TextInput>(null);

  const handleFocus = () => {
    if (disabled) return;
    if (descriptionInputRef.current && scrollViewRef?.current) {
      const nodeHandle = findNodeHandle(descriptionInputRef.current);
      if (nodeHandle) {
        scrollViewRef.current.scrollToFocusedInput(nodeHandle, 150, 100);
        descriptionInputRef.current.measure((x, y, width, height, pageX, pageY) => {
          if (pageY < 150) {
            scrollViewRef.current?.scrollToPosition(0, pageY - 100, true);
          }
        });
      }
    }
  };

  const handleContainerPress = () => {
    if (!disabled && descriptionInputRef.current) {
      descriptionInputRef.current.focus();
    }
  };

  return (
    <View style={[styles.inputContainer, containerStyle]}>
      {title && <Text style={[styles.inputTitle, titleStyle]}>{title}</Text>}
      {subtitle && <Text style={[styles.inputSubtitle, subtitleStyle]}>{subtitle}</Text>}
      <Text style={styles.charCount}>
        Masz{' '}
        <Text style={[styles.charCountColor, value.length > maxLength * 0.9 && styles.charCountWarning]}>
          {value.length}/{maxLength}
        </Text>{' '}
        znaków wykorzystane
      </Text>
      <TouchableOpacity
        onPress={handleContainerPress}
        style={[styles.inputWrapper]}
        activeOpacity={0.8}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Edytuj opis"
      >
        <TextInput
          ref={descriptionInputRef}
          style={[styles.inputDescription, inputStyle, disabled && styles.disabledInput]}
          placeholder={placeholder}
          placeholderTextColor={placeholderTextColor ?? Colors[colorScheme ?? 'light'].inputPlaceholder}
          value={value}
          onChangeText={onChangeText}
          multiline
          textAlignVertical="top"
          maxLength={maxLength}
          editable={!disabled}
          onFocus={handleFocus}
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
          {...textInputProps}
        />
      </TouchableOpacity>
    </View>
  );
}

const getStyles = (colorScheme: 'light' | 'dark') =>
  StyleSheet.create({
    inputContainer: {
      width: '100%',
      alignItems: 'flex-start',
      marginBottom: 20,
    },
    inputTitle: {
      fontSize: 14,
      lineHeight: 14,
      marginBottom: 8,
      fontFamily: Fonts.fontFamilyBold,
      color: Colors[colorScheme].text,
    },
    inputSubtitle: {
      fontSize: 14,
      lineHeight: 14,
      marginBottom: 8,
      fontFamily: Fonts.fontFamilyRegular,
      color: Colors[colorScheme].text2_50,
    },
    inputWrapper: {
      width: '100%',
      borderRadius: 15,
      borderWidth: 2,
      borderColor: Colors[colorScheme].border1,
      backgroundColor: Colors[colorScheme].background2,
    },
    inputDescription: {
      width: '100%',
      minHeight: 300,
      maxHeight: 300,
      backgroundColor: 'transparent',
      fontSize: 24,
      fontFamily: Fonts.fontFamilyBold,
      color: Colors[colorScheme].text,
      padding: 12,
      textAlign: 'left',
      textAlignVertical: 'top',
      lineHeight: 32,
    },
    charCount: {
      fontSize: 14,
      lineHeight: 14,
      fontFamily: Fonts.fontFamilyRegular,
      color: Colors[colorScheme].text2_50,
      marginBottom: 8,
      alignSelf: 'flex-start',
    },
    charCountColor: {
      color: Colors[colorScheme].accent,
    },
    charCountWarning: {
      color: Colors[colorScheme].error || '#FF0000',
    },
    disabledInput: {
      opacity: 0.5,
    },
  });