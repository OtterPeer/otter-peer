import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { useColorScheme } from '@/hooks/useColorScheme';
import { sexOptions } from '@/constants/SexOptions';

interface SexSelectorOtterProps {
  title?: string;
  subtitle?: string;
  value?: number[];
  onChange?: (selected: number[]) => void;
  multiSelect?: boolean;
}

export default function SexSelectorOtter({ 
  title, 
  subtitle, 
  value = [0, 0, 0], 
  onChange, 
  multiSelect = false 
}: SexSelectorOtterProps): JSX.Element {
  const colorScheme = useColorScheme();
  const styles = getStyles(colorScheme ?? 'light');

  const [selectedSex, setSelectedSex] = useState<number[]>(value);

  useEffect(() => {
    setSelectedSex(value);
    console.log("selectedSex:", value);
  }, [value]);

  const handleSexPress = (index: number) => {
    let newSelectedSex: number[];
    
    if (multiSelect) {
      // For multi-select: toggle the selection at the index
      newSelectedSex = [...selectedSex];
      newSelectedSex[index] = selectedSex[index] === 1 ? 0 : 1;
    } else {
      // For single select: only select the clicked option
      newSelectedSex = new Array(3).fill(0);
      newSelectedSex[index] = 1;
    }
    
    setSelectedSex(newSelectedSex);
    onChange?.(newSelectedSex);
  };

  return (
    <View style={styles.inputContainer}>
      <Text style={styles.inputTitle}>{title}</Text>
      <Text style={styles.inputSubtitle}>{subtitle}</Text>
      <View style={styles.sexButtons}>
        {sexOptions.map((sexOption, index) => (
          <TouchableOpacity
            key={sexOption}
            onPress={() => handleSexPress(index)}
            style={[
              styles.sexButton,
              selectedSex[index] === 1 && styles.selectedSexButton,
            ]}
            activeOpacity={0.9}
          >
            <Text style={styles.sexButtonTitle}>{sexOption}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const getStyles = (colorScheme: 'light' | 'dark') =>
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
    sexButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 10,
    },
    sexButton: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 20,
      borderWidth: 2,
      borderColor: Colors[colorScheme ?? 'light'].border1,
    },
    selectedSexButton: {
      borderColor: Colors[colorScheme ?? 'light'].accent,
    },
    sexButtonTitle: {
      fontFamily: Fonts.fontFamilyBold,
      fontSize: 16,
      lineHeight: 16,
      color: Colors[colorScheme ?? 'light'].text,
    },
  });