import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  StatusBar,
  TouchableOpacity,
  Dimensions,
  LayoutChangeEvent,
} from "react-native";
import { useRouter, useNavigation } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Swiper from "react-native-deck-swiper";
import { Colors } from "@/constants/Colors";
import { Fonts } from "@/constants/Fonts";
import { useColorScheme } from "@/hooks/useColorScheme";
import { setupUserDatabase } from "@/contexts/db/userdb";

import OtterHeartIcon from "@/assets/icons/logo/OtterPeerHeart.svg";
import HeartIcon from "@/assets/icons/uicons/heart.svg";
import XIcon from "@/assets/icons/uicons/cross-small.svg";
import FilterIcon from "@/assets/icons/uicons/settings-sliders.svg";
import Card from "@/components/custom/cardProfileOtter";
import { Profile } from "@/types/types";
import { useWebRTC } from "@/contexts/WebRTCContext";
import { useTheme } from "@/contexts/themeContext";
import { useTranslation } from "react-i18next";

export default function SwipePage(): React.JSX.Element {
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, colorScheme } = useTheme();
  const styles = getStyles(theme);
  const navigation = useNavigation();
  const swiperRef = useRef<Swiper<Profile>>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isSwiping, setIsSwiping] = useState(false);
  const [swiperKey, setSwiperKey] = useState(0);

  const { profilesToDisplayRef, handleSwipe, currentSwiperIndex, setCurrentSwiperIndex, profilesToDisplayChangeCount } = useWebRTC();

  // Set navigation options
  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
      gestureEnabled: false,
    });
    console.log(profilesToDisplayRef.current.length)
    setupUserDatabase();
  }, [navigation, profilesToDisplayRef.current.length]);

  useEffect(() => {
    setSwiperKey((prev) => prev + 1); // Force Swiper re-mount
  }, [profilesToDisplayChangeCount]);

  // Reset currentIndex and swiperKey when new profiles are added after stack is empty
  useEffect(() => {
    if (currentSwiperIndex === profilesToDisplayRef.current.length - 1 && profilesToDisplayRef.current.length > 0 && hasMoreProfiles) {
      setSwiperKey((prev) => prev + 1); // Force Swiper re-mount
    }
  }, [profilesToDisplayRef.current.length, currentSwiperIndex]);

  const hasMoreProfiles = currentSwiperIndex < profilesToDisplayRef.current.length;

  const likeButton = () => {
    if (!isDetailsOpen && hasMoreProfiles && !isSwiping) {
      setIsSwiping(true);
      swiperRef.current?.swipeRight();
    }
  };

  const dislikeButton = () => {
    if (!isDetailsOpen && hasMoreProfiles && !isSwiping) {
      setIsSwiping(true);
      swiperRef.current?.swipeLeft();
    }
  };

  const renderCard = (profile: Profile) => {
    console.log(`Rendering card ${profile.peerId}`)
    return (
      <Card
        profile={profile}
        containerHeight={containerHeight}
        onDetailsToggle={setIsDetailsOpen}
      />
    );
  };

  const handleContainerLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setContainerHeight(height);
  };

  const filtrationPage = () => {
    router.push("../filtration/filtrationPage");
  };

  const goToWebRTCConnection = () => {
    router.push('../debug/webrtcConnections');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "top"]}>
      <StatusBar
        backgroundColor="transparent"
        translucent={true}
        barStyle={colorScheme === "dark" ? "light-content" : "dark-content"}
      />
      <View style={styles.container}>
        <View style={styles.logoHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {/* todo: use it when actually preparing the realse version */}
           {/* {__DEV__ ? (
             <TouchableOpacity onPress={goToWebRTCConnection} activeOpacity={0.7}>
               <OtterHeartIcon height={25} width={30} />
             </TouchableOpacity>
           ) : (
             <OtterHeartIcon height={25} width={30} />
           )} */}
           <TouchableOpacity onPress={goToWebRTCConnection} activeOpacity={0.7}>
             <OtterHeartIcon height={25} width={30} />
            </TouchableOpacity>
           <Text style={styles.logoText}>OtterPeer</Text>
          </View>
          <TouchableOpacity onPress={filtrationPage} activeOpacity={0.7} style={styles.filterIcon}>
            <FilterIcon height={21} width={21} fill={theme.icon} />
          </TouchableOpacity>
        </View>
        <View style={styles.cardContainer} onLayout={handleContainerLayout}>
          {containerHeight > 0 && profilesToDisplayRef.current.length - currentSwiperIndex > 0 ? (
            <Swiper
              key={`${containerHeight}-${swiperKey}`}
              ref={swiperRef}
              cards={profilesToDisplayRef.current}
              renderCard={renderCard}
              stackSize={3}
              stackSeparation={0}
              cardIndex={currentSwiperIndex}
              animateCardOpacity
              animateOverlayLabelsOpacity
              backgroundColor="transparent"
              cardVerticalMargin={0}
              cardHorizontalMargin={20}
              disableBottomSwipe
              disableTopSwipe
              disableLeftSwipe={isDetailsOpen || !hasMoreProfiles}
              disableRightSwipe={isDetailsOpen || !hasMoreProfiles}
              onSwiped={(cardIndex: number) => {
                setCurrentSwiperIndex(cardIndex + 1);
                setIsSwiping(false);
              }}
              onSwipedLeft={(cardIndex: number) => {
                const swipedProfile = profilesToDisplayRef.current[cardIndex];
                handleSwipe(swipedProfile.peerId, swipedProfile.x, swipedProfile.y, 'left');
              }}
              onSwipedRight={(cardIndex: number) => {
                const swipedProfile = profilesToDisplayRef.current[cardIndex];
                handleSwipe(swipedProfile.peerId, swipedProfile.x, swipedProfile.y, 'right');
              }}
              overlayLabels={{
                left: {
                  title: (
                    <View
                      style={{
                        position: "absolute",
                        width: 60,
                        height: 60,
                        borderRadius: 30,
                        backgroundColor: Colors[colorScheme ?? "light"].background1_50,
                        borderWidth: 2,
                        borderColor: Colors[colorScheme ?? "light"].accent,
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <XIcon height={42} width={42} fill={Colors[colorScheme ?? "light"].icon} />
                    </View>
                  ),
                  style: {
                    label: {
                      width: 100,
                      height: 100,
                    },
                    wrapper: {
                      flexDirection: "column",
                      alignItems: "flex-end",
                      justifyContent: "flex-start",
                      marginTop: 10,
                      marginLeft: Platform.OS === "ios" ? 20 : 10,
                    },
                  },
                },
                right: {
                  title: (
                    <View
                      style={{
                        position: "absolute",
                        width: 60,
                        height: 60,
                        borderRadius: 30,
                        backgroundColor: theme.background1_50,
                        borderWidth: 2,
                        borderColor: theme.accent,
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <HeartIcon height={30} width={30} fill={theme.swipeIcon} />
                    </View>
                  ),
                  style: {
                    label: {
                      width: 100,
                      height: 100,
                    },
                    wrapper: {
                      flexDirection: "column",
                      alignItems: "flex-start",
                      justifyContent: "flex-start",
                      marginTop: 10,
                      marginLeft: Platform.OS === "ios" ? 20 : 10,
                    },
                  },
                },
              }}
            />
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>{t("components.swipe_page.searching_otters")}</Text>
            </View>
          )}
        </View>
        <View style={styles.decisionButtons}>
          <TouchableOpacity
            onPress={dislikeButton}
            style={[styles.button, !hasMoreProfiles && styles.buttonDisabled]}
            activeOpacity={0.7}
            disabled={!hasMoreProfiles}
          >
            <XIcon height={42} width={42} fill={theme.swipeIcon} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={likeButton}
            style={[styles.button, !hasMoreProfiles && styles.buttonDisabled]}
            activeOpacity={0.7}
            disabled={!hasMoreProfiles}
          >
            <HeartIcon height={30} width={30} fill={theme.swipeIcon} />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const getStyles = (theme: typeof Colors.light) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background1,
    },
    container: {
      flex: 1,
      backgroundColor: theme.background1,
      flexDirection: "column",
    },
    logoHeader: {
      flexDirection: "row",
      width: "100%",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: Platform.OS === "ios" ? 8 : 16,
      paddingHorizontal: 20,
      backgroundColor: theme.background1,
    },
    logoText: {
      fontSize: 24,
      color: theme.text,
      fontFamily: Fonts.fontFamilyBold,
      lineHeight: 26,
      paddingTop: 3,
    },
    cardContainer: {
      flex: 1,
      marginTop: 8,
      width: SCREEN_WIDTH,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.background1,
    },
    decisionButtons: {
      flexDirection: "row",
      gap: 32,
      paddingTop: 8,
      paddingBottom: 8,
      width: "100%",
      justifyContent: "center",
      backgroundColor: "transparent",
    },
    button: {
      width: 60,
      height: 60,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.accent,
      borderRadius: 30,
      borderWidth: 2,
      borderColor: theme.border1,
    },
    buttonDisabled: {
      opacity: 0.5,
      backgroundColor: theme.background2,
      borderColor: theme.border1,
    },
    emptyState: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    emptyStateText: {
      textAlign: "center",
      fontSize: 18,
      color: theme.text,
      fontFamily: Fonts.fontFamilyRegular,
    },
    filterIcon: {
      paddingLeft: 30,
      paddingRight: 20,
      right: -20,
    }
  });