import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList, Alert } from 'react-native';
import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';

interface DatePickerProps {
  onDateChange: (result: {
    day: number | null;
    month: number | null;
    year: number | null;
    date: Date | null;
    isValid: boolean;
    isOver18: boolean;
  }) => void;
  dayValue?: number;
  monthValue?: number;
  yearValue?: number;
  showDay?: boolean;
  showMonth?: boolean;
  showYear?: boolean;
  requireFullDate?: boolean;
}

const DatePicker: React.FC<DatePickerProps> = ({
  onDateChange,
  dayValue,
  monthValue,
  yearValue,
  showDay = true,
  showMonth = true,
  showYear = true,
  requireFullDate = false,
}) => {
  const colorScheme = useColorScheme();
  const styles = getStyles(colorScheme ?? 'light');
  const [day, setDay] = useState<number | null>(dayValue !== undefined && !isNaN(dayValue) ? dayValue : null);
  const [month, setMonth] = useState<number | null>(monthValue !== undefined && !isNaN(monthValue) ? monthValue : null);
  const [year, setYear] = useState<number | null>(yearValue !== undefined && !isNaN(yearValue) ? yearValue : null);
  const [error, setError] = useState<string>('');
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [modalType, setModalType] = useState<'day' | 'month' | 'year' | null>(null);
  const [modalOptions, setModalOptions] = useState<string[]>([]);

  const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  const months = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  const years = Array.from({ length: 100 }, (_, i) => (new Date().getFullYear() - i).toString());

  useEffect(() => {
    const newDay = dayValue !== undefined && !isNaN(dayValue) ? dayValue : null;
    const newMonth = monthValue !== undefined && !isNaN(monthValue) ? monthValue : null;
    const newYear = yearValue !== undefined && !isNaN(yearValue) ? yearValue : null;

    if (newDay !== day) setDay(newDay);
    if (newMonth !== month) setMonth(newMonth);
    if (newYear !== year) setYear(newYear);
  }, [dayValue, monthValue, yearValue]);

  const openModal = (type: 'day' | 'month' | 'year') => {
    setModalType(type);
    setModalOptions(type === 'day' ? days : type === 'month' ? months : years);
    setModalVisible(true);
  };

  const selectOption = (value: string) => {
    const numValue = parseInt(value, 10);
    if (modalType === 'day') setDay(numValue);
    else if (modalType === 'month') setMonth(numValue);
    else if (modalType === 'year') setYear(numValue);
    setModalVisible(false);
  };

  const validateInputs = (d: number | null, m: number | null, y: number | null) => {
    let isValid = true;
    let date: Date | null = null;
    let isOver18 = false;
    let errorMsg = '';

    if (d !== null) {
      if (d < 1 || d > 31) {
        errorMsg = 'Nieprawidłowy dzień';
        isValid = false;
      }
    }

    if (m !== null) {
      if (m < 1 || m > 12) {
        errorMsg = 'Nieprawidłowy miesiąc';
        isValid = false;
      }
    }

    if (y !== null) {
      if (y < 1900 || y > new Date().getFullYear()) {
        errorMsg = 'Nieprawidłowy rok';
        isValid = false;
      }
    }

    if ((d !== null && m !== null && y !== null) || requireFullDate) {
      if (d === null || m === null || y === null) {
        isValid = false;
      } else {
        const daysInMonth = new Date(y, m, 0).getDate();
        if (d > daysInMonth) {
          errorMsg = `Ten miesiąc ma tylko ${daysInMonth} dni`;
          isValid = false;
        } else {
          date = new Date(y, m - 1, d);

          if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
            errorMsg = 'Nieprawidłowa data';
            isValid = false;
          } else {
            const today = new Date();
            const age = today.getFullYear() - y;
            isOver18 =
              age > 18 ||
              (age === 18 && today.getMonth() > m - 1) ||
              (age === 18 && today.getMonth() === m - 1 && today.getDate() >= d);

            if (!isOver18) {
              Alert.alert('Ograniczenie wiekowe', 'Musisz mieć co najmniej 18 lat.');
              setYear(null);
              errorMsg = 'Wybierz pełną datę';
              isValid = false;
              date = null;
            }
          }
        }
      }
    }

    setError(errorMsg);
    onDateChange({
      day: d,
      month: m,
      year: y,
      date,
      isValid,
      isOver18,
    });
  };

  useEffect(() => {
    validateInputs(day, month, year);
  }, [day, month, year]);

  const renderOption = ({ item }: { item: string }) => (
    <TouchableOpacity style={styles.optionItem} onPress={() => selectOption(item)}>
      <Text style={styles.optionText}>{item}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.inputContainer}>
      <Text style={styles.inputTitle}>Data urodzenia</Text>
      <Text style={styles.inputSubtitle}>Kiedy się urodziłeś/aś?</Text>
      <View style={styles.inputRow}>
        {showDay && (
          <TouchableOpacity style={styles.inputBox} onPress={() => openModal('day')}>
            <Text style={styles.inputText}>{day !== null ? day.toString().padStart(2, '0') : 'DD'}</Text>
          </TouchableOpacity>
        )}
        {showMonth && (
          <TouchableOpacity style={styles.inputBox} onPress={() => openModal('month')}>
            <Text style={styles.inputText}>{month !== null ? month.toString().padStart(2, '0') : 'MM'}</Text>
          </TouchableOpacity>
        )}
        {showYear && (
          <TouchableOpacity style={[styles.inputBox, styles.yearInput]} onPress={() => openModal('year')}>
            <Text style={styles.inputText}>{year !== null ? year.toString() : 'YYYY'}</Text>
          </TouchableOpacity>
        )}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <FlatList
              data={modalOptions}
              renderItem={renderOption}
              keyExtractor={(item) => item}
              style={styles.optionList}
              showsVerticalScrollIndicator={true}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const getStyles = (colorScheme: 'light' | 'dark' | null) =>
  StyleSheet.create({
    inputContainer: {
      width: '100%',
      marginBottom: 16,
    },
    inputTitle: {
      fontSize: 14,
      lineHeight: 14,
      fontFamily: Fonts.fontFamilyBold,
      color: Colors[colorScheme ?? 'light'].text,
      marginBottom: 8,
    },
    inputSubtitle: {
      fontSize: 14,
      lineHeight: 14,
      fontFamily: Fonts.fontFamilyRegular,
      color: Colors[colorScheme ?? 'light'].text2_50,
      marginBottom: 8,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      justifyContent: 'space-between',
    },
    inputBox: {
      flex: 2,
      height: 60,
      backgroundColor: Colors[colorScheme ?? 'light'].background2,
      borderWidth: 2,
      borderColor: Colors[colorScheme ?? 'light'].border1,
      borderRadius: 15,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 8,
    },
    yearInput: {
      flex: 3,
      marginRight: 0,
    },
    inputText: {
      fontSize: 24,
      color: Colors[colorScheme ?? 'light'].text,
      fontFamily: Fonts.fontFamilyBold,
    },
    errorText: {
      color: Colors[colorScheme ?? 'light'].error,
      fontSize: 12,
      marginTop: 4,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: Colors[colorScheme ?? 'light'].background1,
      width: '90%',
      maxHeight: 200,
      borderRadius: 15,
    },
    optionList: {
      paddingVertical: 0,
      borderWidth: 2,
      borderColor: Colors[colorScheme ?? 'light'].border1,
      borderRadius: 15,
    },
    optionItem: {
      padding: 10,
      borderBottomWidth: 2,
      borderBottomColor: Colors[colorScheme ?? 'light'].border1,
    },
    optionText: {
      fontSize: 16,
      color: Colors[colorScheme ?? 'light'].text,
      textAlign: 'center',
    },
  });

export default DatePicker;