import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter, useNavigation } from "expo-router";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { useColorScheme } from '@/hooks/useColorScheme';
import { TemporaryProfile } from "@/types/types";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function InterestsPage(): React.JSX.Element {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const styles = getStyles(colorScheme ?? 'light');
  const navigation = useNavigation();

  const [selectedInterests, setSelectedInterests] = useState<number[]>(new Array(46).fill(0));
  const interestsOptions: string[] = [
    '🎥 Anime 🎥',
    '🌟 Astrologia 🌟',
    '📸 Fotografia 📸',
    '📜 Historia 📜',
    '🎬 Kino / Filmy 🎬',
    '🎤 Koncerty 🎤',
    '🏛️ Muzea 🏛️',
    '✍️ Pisanie ✍️',
    '🎨 Sztuka 🎨',
    '💉 Tatuaże 💉',
    '🎭 Teatr 🎭',
    '🎧 Hip-hop 🎧',
    '🎷 Jazz 🎷',
    '🎻 Muzyka klasyczna 🎻',
    '🎵 Pop 🎵',
    '🎸 Rock 🎸',
    '📚 Czytanie 📚',
    '🥗 Dietetyka 🥗',
    '💭 Głębokie rozmowy 💭',
    '🔬 Nauka 🔬',
    '🧠 Psychologia 🧠',
    '💻 Technologia 💻',
    '🍳 Gotowanie 🍳',
    '☕ Kawa ☕',
    '👗 Moda 👗',
    '🌱 Ogrodnictwo 🌱',
    '✈️ Podróże ✈️',
    '🚶 Spacery 🚶',
    '🍣 Sushi 🍣',
    '🏃 Bieganie 🏃',
    '🧘 Joga 🧘',
    '🏀 Koszykówka 🏀',
    '⚽ Piłka nożna ⚽',
    '🏊 Pływanie 🏊',
    '🚴 Rower 🚴',
    '🏐 Siatkówka 🏐',
    '💪 Siłownia 💪',
    '🎾 Tenis 🎾',
    '💃 Taniec 💃',
    '🎲 Gry planszowe 🎲',
    '🎮 Gry wideo 🎮',
    '🌃 Nocne życie 🌃',
    '🦖 Dinozaury 🦖',
    '😺 Koty 😺',
    '🐶 Psy 🐶',
    '🦦 Wydry 🦦'
  ];

  const selectedCount = selectedInterests.reduce((sum, val) => sum + val, 0);

  const handleInterestsPress = (index: number) => {
    setSelectedInterests((prev) => {
      if (prev[index] === 1) {
        return prev.map((selected, i) => (i === index ? 0 : selected));
      }
      if (selectedCount >= 5) {
        return prev;
      }
      return prev.map((selected, i) => (i === index ? 1 : selected));
    });
  };

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
      gestureEnabled: false,
    });
  }, [navigation]);

  const nextPage = async () => {
    try {
      const storedProfile = await AsyncStorage.getItem('userTemporaryProfile');
      const currentProfile: TemporaryProfile = storedProfile ? JSON.parse(storedProfile) : {};
      const updatedProfile: TemporaryProfile = {
        ...currentProfile,
        interests:selectedInterests,
      };
      await AsyncStorage.setItem('userTemporaryProfile', JSON.stringify(updatedProfile));
      router.push('/profile/final');
    } catch (error) {
      console.error('Error updating temporary profile:', error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <StatusBar
        backgroundColor="transparent"
        translucent={true}
        barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.topSpacer} />

        <View style={styles.progressBars}>
          <View style={[styles.progressBar, { backgroundColor: Colors[colorScheme ?? 'light'].accent}]} />
          <View style={[styles.progressBar, { backgroundColor: Colors[colorScheme ?? 'light'].accent}]} />
          <View style={[styles.progressBar, { backgroundColor: Colors[colorScheme ?? 'light'].accent}]} />
          <View style={[styles.progressBar, { backgroundColor: Colors[colorScheme ?? 'light'].background3}]} />
        </View>

        <Text style={styles.pageTitle}>Zainteresowania</Text>
        <Text style={styles.pageSubtitle}>
          Wybierz{' '}
          <Text style={[styles.selectedCount, { color: Colors[colorScheme ?? 'light'].accent }]}>
            {selectedCount}/5
          </Text>{' '}
          pasji, które Cię określają, i znajdź kogoś, kto popłynie z Tobą w tym samym rytmie.
        </Text>
        <View style={styles.interestsContainer}>
          {interestsOptions.map((option, index) => (
            <View key={option}>
              <TouchableOpacity
                onPress={() => handleInterestsPress(index)}
                style={[
                  styles.interestsButton,
                  selectedInterests[index] === 1 && styles.selectedInterestsButton,
                  selectedCount === 5 && selectedInterests[index] === 0 && styles.disabledButton,
                ]}
                activeOpacity={0.9}
              >
                <Text style={styles.interestsButtonTitle}>{option}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <TouchableOpacity
          onPress={nextPage}
          style={[styles.button, selectedCount !== 5 && styles.disabledButton]}
          activeOpacity={0.7}
          disabled={selectedCount !== 5}
        >
          <Text style={[styles.buttonTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
            Dalej {selectedCount}/5
          </Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colorScheme: 'light' | 'dark' | null) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    scrollView: {
      flex: 1,
      backgroundColor: Colors[colorScheme ?? 'light'].background1,
    },
    contentContainer: {
      flexGrow: 1,
      paddingLeft: 20,
      paddingRight: 20,
      paddingTop: 30,
      paddingBottom: 30,
      justifyContent: 'flex-start',
      alignItems: 'center',
      minHeight: '100%',
      backgroundColor: Colors[colorScheme ?? 'light'].background1,
      ...Platform.select({
        android: {
          elevation: 0,
        },
      }),
    },
    topSpacer: {
      height: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 24,
    },
    bottomSpacer: {
      height: Platform.OS === 'ios' ? 34 : 24,
    },
    progressBars: {
      flexDirection: 'row',
      width: '100%',
      gap: 8,
      marginTop: 8,
      marginBottom: 32,
    },
    progressBar: {
      height: 6,
      flex: 1,
      borderRadius: 3,
    },
    pageTitle: {
      fontSize: 32,
      color: Colors[colorScheme ?? 'light'].text,
      fontFamily: Fonts.fontFamilyBold,
      lineHeight: 32,
      marginBottom: 8,
    },
    pageSubtitle: {
      fontSize: 14,
      lineHeight: 14,
      fontFamily: Fonts.fontFamilyRegular,
      textAlign: 'center',
      color: Colors[colorScheme ?? 'light'].text2_50,
      marginBottom: 32,
    },
    selectedCount: {
      fontFamily: Fonts.fontFamilyBold,
    },
    interestsContainer: {
      width: '100%',
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      marginBottom: 32,
      alignItems: 'center',
      gap: 8,
    },
    interestsButton: {
      borderRadius: 20,
      borderWidth: 2,
      borderColor: Colors[colorScheme ?? 'light'].border1,
      paddingVertical: 8,
      paddingHorizontal: 8,
      alignItems: 'center',
      justifyContent: 'center',
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
    button: {
      width: '100%',
      height: 60,
      justifyContent: 'center',
      paddingVertical: 0,
      backgroundColor: Colors[colorScheme ?? 'light'].accent,
      borderRadius: 30,
      borderWidth: 2,
      borderColor: Colors[colorScheme ?? 'light'].border2,
      margin: 0,
      padding: 0,
    },
    buttonTitle: {
      fontSize: 24,
      fontFamily: Fonts.fontFamilyBold,
      lineHeight: 30,
      textAlign: 'center',
      color: Colors[colorScheme ?? 'light'].text,
    },
  });
