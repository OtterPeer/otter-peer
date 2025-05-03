import React, { useEffect } from "react";
import { View, Text, StyleSheet, Platform, ScrollView, StatusBar, TouchableOpacity } from "react-native";
import { useRouter, useNavigation } from "expo-router";
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { useColorScheme } from '@/hooks/useColorScheme';

import BackIcon from '@/assets/icons/uicons/angle-small-left.svg';

export default function SettingsPage(): React.JSX.Element {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const styles = getStyles(colorScheme ?? 'light');
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      gestureEnabled: true,
    });
  }, [navigation]);

  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      gestureEnabled: true,
      headerTitle: () => (
        <Text style={styles.headerName}>Ustawienia</Text>
      ),
      headerTitleAlign: 'center',
      headerShadowVisible: true,
      headerStyle: {
        backgroundColor: Colors[colorScheme ?? 'light'].background1,
      },
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingRight: 8,
          }}
        >
          <BackIcon
            width={24}
            height={24}
            fill={Colors[colorScheme ?? 'light'].accent}
          />
          <Text
            style={{
              color: Colors[colorScheme ?? 'light'].accent,
              fontSize: 18,
              fontFamily: Fonts.fontFamilyRegular,
            }}
          >
            Back
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, colorScheme]);

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

        <View style={styles.settingsContainter}>
          <View style={styles.settingContainter}>
            <Text style={styles.settingTitle}>ToDo</Text>
            <Text style={styles.settingSubtitle}>ToDo</Text>
          </View>
        </View>

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
      // paddingTop: 30,
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
    settingsContainter: {
      marginBottom: 36,
      borderRadius: 10,
      padding: 10,
    },
    settingContainter: {
      alignItems: 'center',
      marginBottom: 16,
    },
    settingTitle: {
      fontSize: 24,
      lineHeight: 24,
      color: Colors[colorScheme ?? 'light'].text,
      fontFamily: Fonts.fontFamilyBold,
      marginBottom: 4,
    },
    settingSubtitle: {
      fontSize: 14,
      lineHeight: 14,
      color: Colors[colorScheme ?? 'light'].text2_50,
      fontFamily: Fonts.fontFamilyRegular,
      textAlign: 'center',
    },
    headerName: {
      fontFamily: Fonts.fontFamilyBold,
      color: Colors[colorScheme ?? 'light'].text,
      marginBottom: 0,
      fontSize: 20,
      lineHeight: 22,
      textAlign: 'center',
      flexShrink: 1,
      paddingHorizontal: 10,
    },
  });