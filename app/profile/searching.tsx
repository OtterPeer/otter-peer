import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  StatusBar,
  TouchableOpacity,
  Alert,
  ScrollView,
} from "react-native";
import { useRouter, useNavigation } from "expo-router";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { useColorScheme } from '@/hooks/useColorScheme';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TemporaryProfile } from "@/types/types";

export default function SearchingPage(): React.JSX.Element {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const styles = getStyles(colorScheme ?? 'light');
  const navigation = useNavigation();

  const [selectedSearching, setSelectedSearching] = useState<number[]>([0, 0, 0, 0, 0, 0]);
  const searchingOptions: string[] = ['💬 Tylko porozmawiać 💬', '🤝 Przyjaźń 🤝', '🔥 Coś na chwilę 🔥', '💞 Stały związek 💞', '🤔 Jeszcze nie wiem 🤔', '✨🦦 Przygoda z wydrą 🦦✨'];

  const handleSearchingPress = (index: number) => {
    const newSelection = [0, 0, 0, 0, 0, 0];
    newSelection[index] = 1;
    setSelectedSearching(newSelection);
  };

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
      gestureEnabled: false,
    });
  }, [navigation]);

  const nextPage = async () => {
    if(!selectedSearching.some(value => value === 1)){
      Alert.alert('🦦', 'Wyderka nie wie czego szukasz');
      return;
    }
    try {
      const storedProfile = await AsyncStorage.getItem('userTemporaryProfile');
      const currentProfile: TemporaryProfile = storedProfile ? JSON.parse(storedProfile) : {};
      const updatedProfile: TemporaryProfile = {
        ...currentProfile,
        interests:selectedSearching,
      };
      await AsyncStorage.setItem('userTemporaryProfile', JSON.stringify(updatedProfile));
      router.push('/profile/interests')
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
          <View style={[styles.progressBar, { backgroundColor: Colors[colorScheme ?? 'light'].accent}]}/>
          <View style={[styles.progressBar, { backgroundColor: Colors[colorScheme ?? 'light'].accent}]}/>
          <View style={[styles.progressBar, { backgroundColor: Colors[colorScheme ?? 'light'].background3}]}/>
          <View style={[styles.progressBar, { backgroundColor: Colors[colorScheme ?? 'light'].background3}]}/>
        </View>

        <Text style={styles.pageTitle}>Szukam</Text>
        <Text style={styles.pageSubtitle}>Wybierz, czego szukasz, i daj znać, jak chcesz popłynąć przez świat znajomości z nutką wydrzego uroku!</Text>
        <View style={styles.inputsContainer}>
          {searchingOptions.map((option, index) => (
            <View key={option} style={styles.searchingContainer}>
              <TouchableOpacity
                onPress={() => handleSearchingPress(index)}
                style={[
                  styles.searchingButton,
                  selectedSearching[index] === 1 && styles.selectedSearchingButton,
                ]}
                activeOpacity={0.9}
              >
                <Text style={styles.searchingButtonTitle}>{option}</Text>
              </TouchableOpacity>
              <Text style={styles.searchingButtonSubtitle}>
                {index === 0 && "Chcesz wymienić myśli, żarty albo historie? Nasza wydra już szykuje tematy!"}
                {index === 1 && "Szukasz towarzysza do śmiania się z memów albo spacerów z wydrą? Tu znajdziesz kumpla na każdą okazję!"}
                {index === 2 && "Trochę flirtu, szczypta emocji i zero presji – przeżyj krótką, ale intensywną przygodę z nutką wydrzego szaleństwa!"}
                {index === 3 && "Gotowy na kogoś, kto będzie z Tobą pływał przez życie? Nasza wydra kibicuje miłości na dłużej!"}
                {index === 4 && "Nie masz planu? Spoko, wydra też czasem dryfuje bez celu. Otwórz się na możliwości i zobacz, co się wydarzy!"}
                {index === 5 && "Spontaniczna randka, wspólny wypad czy taniec w deszczu? Z naszą wydrą każda chwila to nowa, ekscytująca historia!"}
              </Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          onPress={nextPage}
          style={styles.button}
          activeOpacity={0.7}>
          <Text style={styles.buttonTitle}>Dalej</Text>
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
    progressBars:{
      flexDirection: 'row',
      width: '100%',
      gap: 8,
      marginTop: 8,
      marginBottom: 32,
    },
    progressBar:{
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
    inputsContainer: {
      width: '100%',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    inputContainer: {
      width: '100%',
      alignItems: 'flex-start',
      marginBottom: 16,
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
    searchingContainer: {
      flex: 1,
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
    },
    selectedSearchingButton: {
      borderColor: Colors[colorScheme ?? 'light'].accent,
    },
    searchingButtonTitle: {
      paddingVertical: 10,
      fontFamily: Fonts.fontFamilyBold,
      fontSize: 16,
      lineHeight: 22,
      color: Colors[colorScheme ?? 'light'].text,
    },
    searchingButtonSubtitle: {
      fontFamily: Fonts.fontFamilyRegular,
      fontSize: 14,
      lineHeight: 14,
      color: Colors[colorScheme ?? 'light'].text2_50,
      marginBottom: 16,
      textAlign: 'center',
    }
  });