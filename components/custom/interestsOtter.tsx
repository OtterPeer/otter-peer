import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { useColorScheme } from '@/hooks/useColorScheme';
import { interestsOptions, interestsOptionsEmoji } from '@/constants/InterestsOptions';

interface InterestsOtterProps {
  title?: string;
  subtitle?: string;
  value?: number[];
  onChange?: (selected: { interests: number[]; isInterestsValid: boolean }) => void;
  showEmoji?: boolean;
}

export default function InterestsOtter({
  title,
  subtitle,
  value = new Array(interestsOptions.length).fill(0),
  onChange,
  showEmoji = false,
}: InterestsOtterProps): JSX.Element {
  const colorScheme = useColorScheme();
  const styles = getStyles(colorScheme ?? 'light');

  const [selectedInterests, setSelectedInterests] = useState<number[]>(value);

  const selectedCount = selectedInterests.reduce((sum, val) => sum + val, 0);
  const isInterestsValid = selectedCount === 5;

  useEffect(() => {
    setSelectedInterests(value);
    console.log('interests:', value);
  }, [value]);

  const handleInterestsPress = (index: number) => {
    setSelectedInterests((prev) => {
      const newSelection = [...prev];
      if (newSelection[index] === 1) {
        newSelection[index] = 0;
      } else if (selectedCount < 5) {
        newSelection[index] = 1;
      }
      const newCount = newSelection.reduce((sum, val) => sum + val, 0);
      onChange?.({ interests: newSelection, isInterestsValid: newCount === 5 });
      return newSelection;
    });
  };

  return (
    <View style={styles.inputsContainer}>
      {title != null && <Text style={styles.inputTitle}>{title}</Text>}
      {subtitle != null && (
        <Text style={styles.inputSubtitle}>
          {subtitle}{' '}
          <Text style={[styles.selectedCount, { color: Colors[colorScheme ?? 'light'].accent }]}>
            {selectedCount}/5
          </Text>
        </Text>
      )}
      <View style={styles.interestsContainer}>
        {interestsOptions.map((_, index) => (
          <View key={index} style={styles.interestItem}>
            <TouchableOpacity
              onPress={() => handleInterestsPress(index)}
              style={[
                styles.interestsButton,
                selectedInterests[index] === 1 && styles.selectedInterestsButton,
                selectedCount === 5 && selectedInterests[index] === 0 && styles.disabledButton,
              ]}
              activeOpacity={0.7}
            >
              <Text style={styles.interestsButtonTitle}>
                {showEmoji ? interestsOptionsEmoji[index] : interestsOptions[index]}
              </Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
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
    selectedCount: {
      fontFamily: Fonts.fontFamilyBold,
    },
    interestsContainer: {
      width: '100%',
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
    },
    interestItem: {
      flexDirection: 'column',
      alignItems: 'center',
    },
    interestsButton: {
      borderRadius: 20,
      borderWidth: 2,
      borderColor: Colors[colorScheme ?? 'light'].border1,
      paddingVertical: 8,
      paddingHorizontal: 8,
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
    },
    selectedInterestsButton: {
      borderColor: Colors[colorScheme ?? 'light'].accent,
      backgroundColor: Colors[colorScheme ?? 'light'].accent + '20',
    },
    disabledButton: {
      opacity: 0.2,
    },
    interestsButtonTitle: {
      fontFamily: Fonts.fontFamilyBold,
      fontSize: 14,
      lineHeight: 18,
      color: Colors[colorScheme ?? 'light'].text,
      textAlign: 'center',
    },
  });