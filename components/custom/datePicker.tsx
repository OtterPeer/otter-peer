import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList, Alert } from 'react-native';
import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';

interface DatePickerProps {
  onDateChange: (date: Date | null, isValid: boolean, isOver18: boolean) => void;
}

const DatePicker: React.FC<DatePickerProps> = ({ onDateChange }) => {
    const colorScheme = useColorScheme();
    const styles = getStyles(colorScheme ?? 'light');
    const [day, setDay] = useState<string>('');
    const [month, setMonth] = useState<string>('');
    const [year, setYear] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [modalVisible, setModalVisible] = useState<boolean>(false);
    const [modalType, setModalType] = useState<'day' | 'month' | 'year' | null>(null);
    const [modalOptions, setModalOptions] = useState<string[]>([]);

    // Generate options
    const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, '0'));
    const months = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
    const years = Array.from({ length: 100 }, (_, i) => (new Date().getFullYear() - i).toString());

    // Open modal with appropriate options
    const openModal = (type: 'day' | 'month' | 'year') => {
        setModalType(type);
        setModalOptions(type === 'day' ? days : type === 'month' ? months : years);
        setModalVisible(true);
    };

    // Handle option selection
    const selectOption = (value: string) => {
        if (modalType === 'day') setDay(value);
        else if (modalType === 'month') setMonth(value);
        else if (modalType === 'year') setYear(value);
        setModalVisible(false);
    };

    // Validate date and age
    const validateDate = (d: string, m: string, y: string) => {
        if (!d || !m || !y) {
            setError('Wybierz pełną datę');
            onDateChange(null, false, false);
            return;
        }

        const dayNum = parseInt(d, 10);
        const monthNum = parseInt(m, 10);
        const yearNum = parseInt(y, 10);

        // Basic range checks
        if (monthNum < 1 || monthNum > 12 || dayNum < 1 || yearNum < 1900 || yearNum > new Date().getFullYear()) {
            setError('Nieprawidłowa data');
            onDateChange(null, false, false);
            return;
        }

        // Check valid days in month
        const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
        if (dayNum > daysInMonth) {
            setError(`Ten miesiąc ma tylko ${daysInMonth} dni`);
            onDateChange(null, false, false);
            return;
        }

        // Create date object
        const selectedDate = new Date(yearNum, monthNum - 1, dayNum);

        // Verify date validity
        if (
            selectedDate.getFullYear() !== yearNum ||
            selectedDate.getMonth() !== monthNum - 1 ||
            selectedDate.getDate() !== dayNum
        ) {
            setError('Nieprawidłowa data');
            onDateChange(null, false, false);
            return;
        }

        // Check if over 18
        const today = new Date();
        const age = today.getFullYear() - yearNum;
        const isOver18 =
        age > 18 ||
        (age === 18 && today.getMonth() > monthNum - 1) ||
        (age === 18 && today.getMonth() === monthNum - 1 && today.getDate() >= dayNum);

        if (!isOver18) {
            Alert.alert('Ograniczenie wiekowe', 'Musisz mieć co najmniej 18 lat.');
            // Reset inputs
            setDay('');
            setMonth('');
            setYear('');
            setError('Wybierz pełną datę');
            onDateChange(null, false, false);
            return;
        }

        setError('');
        onDateChange(selectedDate, true, isOver18);
    };

    // Validate whenever day, month, or year changes
    useEffect(() => {
        if (day && month && year) {
            validateDate(day, month, year);
        }
    }, [day, month, year]);

    // Render modal list item
    const renderOption = ({ item }: { item: string }) => (
        <TouchableOpacity style={styles.optionItem} onPress={() => selectOption(item)}>
            <Text style={styles.optionText}>{item}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.inputContainer}>
            <Text style={styles.inputTitle}>Data urodzenia</Text>
            <Text style={styles.inputSubtitle}>Kiedy się urodziłeś?</Text>
        <View style={styles.inputRow}>
            <TouchableOpacity
                style={styles.inputBox}
                onPress={() => openModal('day')}
                >
                <Text style={styles.inputText}>{day || 'DD'}</Text>
            </TouchableOpacity>
                <TouchableOpacity
                style={styles.inputBox}
                onPress={() => openModal('month')}
                >
                <Text style={styles.inputText}>{month || 'MM'}</Text>
            </TouchableOpacity>
                <TouchableOpacity
                style={[styles.inputBox, styles.yearInput]}
                onPress={() => openModal('year')}
                >
                <Text style={styles.inputText}>{year || 'YYYY'}</Text>
            </TouchableOpacity>
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Modal
            visible={modalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setModalVisible(false)}>
            <TouchableOpacity
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={() => setModalVisible(false)}>
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