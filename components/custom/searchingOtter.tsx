import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { useColorScheme } from '@/hooks/useColorScheme';
import { searchingOptions, searchingOptionsEmoji, searchingOptionsDescriptions } from '@/constants/SearchingOptions';

interface SearchingSelectorOtterProps {
  title?: string;
  subtitle?: string;
  value?: number[];
  onChange?: (selected: number[]) => void;
  showEmoji?: boolean;
  showDescription?: boolean;
  multiSelect?: boolean;
}

export default function SearchingSelectorOtter({
  title,
  subtitle,
  value = new Array(searchingOptions.length).fill(0),
  onChange,
  showEmoji = false,
  showDescription = true,
  multiSelect = false, // Default to single selection
}: SearchingSelectorOtterProps): JSX.Element {
  const colorScheme = useColorScheme();
  const styles = getStyles(colorScheme ?? 'light');

  const [selectedSearching, setSelectedSearching] = useState<number[]>(value);

  useEffect(() => {
    setSelectedSearching(value);
    console.log('searching:', value);
  }, [value]);

  const handleSearchingPress = (index: number) => {
    let newSelection: number[];
    
    if (multiSelect) {
      newSelection = [...selectedSearching];
      newSelection[index] = selectedSearching[index] === 1 ? 0 : 1;
    } else {
      newSelection = new Array(searchingOptions.length).fill(0);
      newSelection[index] = 1;
    }

    setSelectedSearching(newSelection);
    onChange?.(newSelection);
  };

  return (
    <View style={styles.inputsContainer}>
      {title != null && (
        <Text style={styles.inputTitle}>{title}</Text>
      )}
      {subtitle != null && (
        <Text style={styles.inputSubtitle}>{subtitle}</Text>
      )}
      {searchingOptions.map((_, index) => (
        <View key={index} style={styles.searchingContainer}>
          <TouchableOpacity
            onPress={() => handleSearchingPress(index)}
            style={[
              styles.searchingButton,
              selectedSearching[index] === 1 && styles.selectedSearchingButton,
            ]}
            activeOpacity={0.9}
          >
            <Text style={styles.searchingButtonTitle}>
              {showEmoji ? searchingOptionsEmoji[index] : searchingOptions[index]}
            </Text>
          </TouchableOpacity>
          {showDescription && (
            <Text style={styles.searchingButtonSubtitle}>
              {searchingOptionsDescriptions[index]}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

const getStyles = (colorScheme: 'light' | 'dark') =>
  StyleSheet.create({
    inputsContainer: {
      width: '100%',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    inputTitle: {
      fontSize: 14,
      lineHeight: 14,
      fontFamily: Fonts.fontFamilyBold,
      textAlign: 'left',
      color: Colors[colorScheme ?? 'light'].text,
      marginBottom: 8,
    },
    inputSubtitle: {
      fontSize: 14,
      lineHeight: 14,
      fontFamily: Fonts.fontFamilyRegular,
      textAlign: 'left',
      color: Colors[colorScheme ?? 'light'].text2_50,
      marginBottom: 8,
    },
    searchingContainer: {
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: 8,
      width: '100%',
    },
    searchingButton: {
      alignItems: 'center',
      borderRadius: 30,
      borderWidth: 2,
      borderColor: Colors[colorScheme ?? 'light'].border1,
      marginBottom: 8,
    },
    selectedSearchingButton: {
      borderColor: Colors[colorScheme ?? 'light'].accent,
    },
    searchingButtonTitle: {
      paddingVertical: 10,
      fontFamily: Fonts.fontFamilyBold,
      fontSize: 16,
      lineHeight: 20,
      color: Colors[colorScheme ?? 'light'].text,
    },
    searchingButtonSubtitle: {
      fontFamily: Fonts.fontFamilyRegular,
      fontSize: 14,
      lineHeight: 14,
      color: Colors[colorScheme ?? 'light'].text2_50,
      marginBottom: 16,
      marginTop: -8,
      textAlign: 'center',
    },
  });