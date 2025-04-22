import React, { useEffect } from "react";
import { View, Text, StyleSheet, Platform, ScrollView, StatusBar, TouchableOpacity } from "react-native";
import { useRouter, useNavigation } from "expo-router";
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { useColorScheme } from '@/hooks/useColorScheme';

import OtterIcon from '@/assets/icons/uicons/otter.svg';
import RuleBadgeIcon from '@/assets/icons/uicons/badge-check.svg';

export default function ProfileScreen(): React.JSX.Element {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const styles = getStyles(colorScheme ?? 'light');
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
      gestureEnabled: false,
    });
  }, [navigation]);

  const nextPage = () => {
    router.push("/profile/create")
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <StatusBar
        backgroundColor="transparent"
        translucent={true}
        barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}/>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}>
        <View style={styles.topSpacer} />
        <View style={styles.logoContainer}>
          <OtterIcon style={styles.logo} width={90} height={90} fill={Colors[colorScheme ?? 'light'].accent} />
          <Text style={styles.logoTitle}>OtterPeer</Text>
        </View>

        <View style={styles.rulesContainer}>
          <View style={styles.ruleContainer}>
            <RuleBadgeIcon style={styles.ruleCheckmark} width={30} height={30} fill={Colors[colorScheme ?? 'light'].accent} />
            <Text style={styles.ruleTitle}>Szanuj innych</Text>
            <Text style={styles.ruleSubtitle}>Zachowuj szacunek i uprzejmość wobec wszystkich osób w aplikacji.</Text>
          </View>
          <View style={styles.ruleContainer}>
            <RuleBadgeIcon style={styles.ruleCheckmark} width={30} height={30} fill={Colors[colorScheme ?? 'light'].accent} />
            <Text style={styles.ruleTitle}>Uważaj co udostępniasz</Text>
            <Text style={styles.ruleSubtitle}>Chroniąc swoją prywatność, nie ujawniaj danych osobowych, takich jak adres itp.</Text>
          </View>
          <View style={styles.ruleContainer}>
            <RuleBadgeIcon style={styles.ruleCheckmark} width={30} height={30} fill={Colors[colorScheme ?? 'light'].accent} />
            <Text style={styles.ruleTitle}>Zachowuj się</Text>
            <Text style={styles.ruleSubtitle}>Przestrzegaj zasad społeczności - unikaj obraźliwych zachowań i spamu.</Text>
          </View>
          <View style={styles.ruleContainer}>
            <RuleBadgeIcon style={styles.ruleCheckmark} width={30} height={30} fill={Colors[colorScheme ?? 'light'].accent} />
            <Text style={styles.ruleTitle}>Bądź sobą</Text>
            <Text style={styles.ruleSubtitle}>Prezentuj autentyczny wizerunek, korzystając z prawdziwych zdjęć i opisów.</Text>
          </View>
        </View>

        {/* Todo: Implement small settings to set language (after implementing language support) or change dark mode to light mode */}
        <TouchableOpacity
          onPress={nextPage}
          style={styles.button}
          activeOpacity={0.7}>
          <Text style={styles.buttonTitle}>Zgadzam się</Text>
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
      justifyContent: 'center',
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
    logoContainer: {
      alignItems: 'center',
      marginBottom: 36,
      borderRadius: 10,
    },
    logo: {
      marginBottom: 8,
    },
    logoTitle: {
      fontSize: 48,
      color: Colors[colorScheme ?? 'light'].text,
      fontFamily: Fonts.fontFamilyBold,
      lineHeight: 48,
    },
    rulesContainer: {
      marginBottom: 36,
      borderRadius: 10,
      padding: 10,
    },
    ruleContainer: {
      alignItems: 'center',
      marginBottom: 16,
    },
    ruleCheckmark: {
      marginBottom: 4,
    },
    ruleTitle: {
      fontSize: 24,
      lineHeight: 24,
      color: Colors[colorScheme ?? 'light'].text,
      fontFamily: Fonts.fontFamilyBold,
      marginBottom: 4,
    },
    ruleSubtitle: {
      fontSize: 14,
      lineHeight: 14,
      color: Colors[colorScheme ?? 'light'].text2_50,
      fontFamily: Fonts.fontFamilyRegular,
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