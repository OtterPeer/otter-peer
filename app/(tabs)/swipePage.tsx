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

import OtterIcon from "@/assets/icons/uicons/otter.svg";
import HeartIcon from "@/assets/icons/uicons/heart.svg";
import XIcon from "@/assets/icons/uicons/cross-small.svg";
import FilterIcon from "@/assets/icons/uicons/settings-sliders.svg";
import Card from "@/components/custom/cardProfileOtter";
import { Profile } from "@/types/types";
import { useWebRTC } from "@/contexts/WebRTCContext";

export default function SwipePage(): React.JSX.Element {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const styles = getStyles(colorScheme ?? "light", insets);
  const navigation = useNavigation();
  const swiperRef = useRef<Swiper<Profile>>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [swiperKey, setSwiperKey] = useState(0);

  const { profile, profilesToDisplay, sendLikeMessage, addToDisplayedPeers } = useWebRTC();
  const [resolvedProfile, setResolvedProfile] = useState<Profile | null>(null);

  // Resolve user profile
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profileData = await profile;
        setResolvedProfile(profileData);
      } catch (error) {
        console.error("Error resolving profile:", error);
        setResolvedProfile(null);
      }
    };
    loadProfile();
  }, [profile]);

  // Set navigation options
  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
      gestureEnabled: false,
    });
    console.log(profilesToDisplay.length)
    setupUserDatabase();
  }, [navigation, profilesToDisplay.length]);

  // Reset currentIndex and swiperKey when new profiles are added after stack is empty
  useEffect(() => {
    if (currentIndex === profilesToDisplay.length - 1 && profilesToDisplay.length > 0 && hasMoreProfiles) {
      setSwiperKey((prev) => prev + 1); // Force Swiper re-mount
    }
  }, [profilesToDisplay.length, currentIndex]);

  const hasMoreProfiles = currentIndex < profilesToDisplay.length;

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

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "top"]}>
      <StatusBar
        backgroundColor="transparent"
        translucent={true}
        barStyle={colorScheme === "dark" ? "light-content" : "dark-content"}
      />
      <View style={styles.container}>
        <View style={styles.logoHeader}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <OtterIcon
              height={21}
              width={21}
              fill={Colors[colorScheme ?? "light"].accent}
            />
            <Text style={styles.logoText}>OtterPeer</Text>
          </View>
          <TouchableOpacity onPress={filtrationPage} activeOpacity={0.7} style={styles.filterIcon}>
            <FilterIcon height={21} width={21} fill={Colors[colorScheme ?? "light"].icon} />
          </TouchableOpacity>
        </View>

        <View style={styles.cardContainer} onLayout={handleContainerLayout}>
          {containerHeight > 0 && profilesToDisplay.length > 0 ? (
            <Swiper
              key={`${containerHeight}-${swiperKey}`}
              ref={swiperRef}
              cards={profilesToDisplay}
              renderCard={renderCard}
              stackSize={3}
              stackSeparation={0}
              cardIndex={currentIndex}
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
                setCurrentIndex(cardIndex + 1);
                setIsSwiping(false);
              }}
              onSwipedLeft={(cardIndex: number) => {
                const swipedProfile = profilesToDisplay[cardIndex];
                console.log("Swiped left on:", swipedProfile.name, swipedProfile.peerId);
                addToDisplayedPeers(swipedProfile.peerId);
              }}
              onSwipedRight={(cardIndex: number) => {
                const swipedProfile = profilesToDisplay[cardIndex];
                console.log("Swiped right on:", swipedProfile.name, swipedProfile.peerId);
                sendLikeMessage(swipedProfile.peerId);
                addToDisplayedPeers(swipedProfile.peerId);
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
                        backgroundColor: Colors[colorScheme ?? "light"].background1_50,
                        borderWidth: 2,
                        borderColor: Colors[colorScheme ?? "light"].accent,
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <HeartIcon height={30} width={30} fill={Colors[colorScheme ?? "light"].icon} />
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
              <Text style={styles.emptyStateText}>🦦 Wyderka szuka osób dla Ciebie! 🦦</Text>
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
            <XIcon height={42} width={42} fill={Colors[colorScheme ?? "light"].text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={likeButton}
            style={[styles.button, !hasMoreProfiles && styles.buttonDisabled]}
            activeOpacity={0.7}
            disabled={!hasMoreProfiles}
          >
            <HeartIcon height={30} width={30} fill={Colors[colorScheme ?? "light"].text} />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const getStyles = (colorScheme: "light" | "dark" | null, insets: { top: number; bottom: number }) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: Colors[colorScheme ?? "light"].background1,
    },
    container: {
      flex: 1,
      backgroundColor: Colors[colorScheme ?? "light"].background1,
      flexDirection: "column",
    },
    logoHeader: {
      flexDirection: "row",
      width: "100%",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: Platform.OS === "ios" ? 8 : 16,
      paddingHorizontal: 20,
      backgroundColor: Colors[colorScheme ?? "light"].background1,
    },
    logoText: {
      fontSize: 24,
      color: Colors[colorScheme ?? "light"].text,
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
      backgroundColor: Colors[colorScheme ?? "light"].background1,
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
      backgroundColor: Colors[colorScheme ?? "light"].accent,
      borderRadius: 30,
      borderWidth: 2,
      borderColor: Colors[colorScheme ?? "light"].border2,
    },
    buttonDisabled: {
      opacity: 0.5,
      backgroundColor: Colors[colorScheme ?? "light"].background2,
      borderColor: Colors[colorScheme ?? "light"].border1,
    },
    emptyState: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    emptyStateText: {
      textAlign: "center",
      fontSize: 18,
      color: Colors[colorScheme ?? "light"].text,
      fontFamily: Fonts.fontFamilyRegular,
    },
    filterIcon: {
      paddingLeft: 30,
      paddingRight: 20,
      right: -20,
    }
  });