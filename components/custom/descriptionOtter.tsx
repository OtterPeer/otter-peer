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
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useTheme } from '@/contexts/themeContext';
import { useTranslation } from 'react-i18next';

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
  title = 'Description',
  subtitle = 'Describe yourself as best you can!',
  containerStyle,
  titleStyle,
  subtitleStyle,
  inputStyle,
  disabled = false,
  placeholder = 'Write something about yourself',
  placeholderTextColor,
  value = '',
  onChangeText,
  maxLength = 1000,
  scrollViewRef,
  accessibilityLabel = 'Description space',
  accessibilityHint = 'Write something about yourself',
  ...textInputProps
}: DescriptionOtterProps): JSX.Element {
  const { theme, colorScheme } = useTheme();
  const styles = getStyles(theme);
  const descriptionInputRef = useRef<TextInput>(null);
  const { t } = useTranslation();

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
        {t("components.description_otter.you_have")}{' '}
        <Text style={[styles.charCountColor, value.length > maxLength * 0.9 && styles.charCountWarning]}>
          {value.length}/{maxLength}
        </Text>{' '}
        {t("components.description_otter.used_characters")}
      </Text>
      <TouchableOpacity
        onPress={handleContainerPress}
        style={[styles.inputWrapper]}
        activeOpacity={0.8}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Edit description"
      >
        <TextInput
          ref={descriptionInputRef}
          style={[styles.inputDescription, inputStyle, disabled && styles.disabledInput]}
          placeholder={placeholder}
          placeholderTextColor={placeholderTextColor ?? theme.inputPlaceholder}
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

const getStyles = (theme: typeof Colors.light) =>
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
      color: theme.text,
    },
    inputSubtitle: {
      fontSize: 14,
      lineHeight: 14,
      marginBottom: 8,
      fontFamily: Fonts.fontFamilyRegular,
      color: theme.text2_50,
    },
    inputWrapper: {
      width: '100%',
      borderRadius: 15,
      borderWidth: 2,
      borderColor: theme.border1,
      backgroundColor: theme.background2,
    },
    inputDescription: {
      width: '100%',
      minHeight: 300,
      maxHeight: 300,
      backgroundColor: 'transparent',
      fontSize: 24,
      fontFamily: Fonts.fontFamilyBold,
      color: theme.text,
      padding: 12,
      textAlign: 'left',
      textAlignVertical: 'top',
      lineHeight: 32,
    },
    charCount: {
      fontSize: 14,
      lineHeight: 14,
      fontFamily: Fonts.fontFamilyRegular,
      color: theme.text2_50,
      marginBottom: 8,
      alignSelf: 'flex-start',
    },
    charCountColor: {
      color: theme.accent,
    },
    charCountWarning: {
      color: theme.error || '#FF0000',
    },
    disabledInput: {
      opacity: 0.5,
    },
  });