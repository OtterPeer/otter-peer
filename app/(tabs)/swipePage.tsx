import React, { useEffect, useRef, useMemo, useState } from "react";
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
import { Profile, TemporaryProfile } from "@/types/types";
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

  const { profile, peers } = useWebRTC();
  const [resolvedProfile, setResolvedProfile] = useState<Profile | null>(null);

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

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
      gestureEnabled: false,
    });
    setupUserDatabase();
  }, [navigation]);

  const generateInterests = () => {
    const interests = Array(46).fill(0);
    const selectedIndices = new Set<number>();
    while (selectedIndices.size < 5) {
      const randomIndex = Math.floor(Math.random() * 46);
      selectedIndices.add(randomIndex);
    }
    selectedIndices.forEach((index) => {
      interests[index] = 1;
    });
    return interests;
  };

  const generatePeerId = (): string => {
    const chars = "0123456789abcdef";
    let result = "";
    for (let i = 0; i < 32; i++) {
      result += chars[Math.floor(Math.random() * 16)];
    }
    return result;
  };

  const exampleProfiles: Profile[] = useMemo(
    () => [
      {
        peerId: generatePeerId(),
        publicKey: "TemporaryPublicKey",
        name: "Alice Smith",
        birthDay: 15,
        birthMonth: 6,
        birthYear: 1997,
        x: 1,
        y: 1,
        description: `Loves hiking and photography. 
Always up for an adventure!
Always up for an adventure!
Always up for an adventure!
Always up for an adventure!
Always up for an adventure!
Always up for an adventure!
Always up for an adventure!
Always up for an adventure!
Always up for an adventure!
Always up for an adventure!
Always up for an adventure!
Always up for an adventure!
Always up for an adventure!
Always up for an adventure!
Always up for an adventure!
Always up for an adventure!
Always up for an adventure!
Always up for an adventure!
Always up for an adventure!
Always up for an adventure!
Always up for an adventure!
Always up for an adventure!
Always up for an adventure!
Always up for an adventure!
Always up for an adventure!
Always up for an adventure!
Always up for an adventure!
Always up for an adventure!
Always up for an adventure!
Always up for an adventure!
Always up for an adventure!
Always up for an adventure!
asdasd`,
        profilePic: resolvedProfile?.profilePic || "https://via.placeholder.com/900x1600/FF6F61/FFFFFF?text=Alice",
        sex: [0, 1, 0],
        interestSex: [1, 0, 0],
        interests: generateInterests(),
        searching: [0, 0, 0, 1, 0, 0],
      },
      {
        peerId: generatePeerId(),
        publicKey: "TemporaryPublicKey",
        name: "Bob Johnson",
        birthDay: 22,
        birthMonth: 3,
        birthYear: 1991,
        x: 1,
        y: 1,
        description: "Tech enthusiast and coffee lover. Enjoys coding late into the night.",
        profilePic: resolvedProfile?.profilePic || "https://via.placeholder.com/900x1600/6B7280/FFFFFF?text=Bob",
        sex: [1, 0, 0],
        interestSex: [0, 1, 0],
        interests: generateInterests(),
        searching: [0, 0, 0, 0, 1, 0],
      },
      {
        peerId: generatePeerId(),
        publicKey: "TemporaryPublicKey",
        name: "Clara Lee",
        birthDay: 10,
        birthMonth: 9,
        birthYear: 2000,
        x: 1,
        y: 1,
        description: "Avid reader and aspiring writer. Dreams of publishing a novel.",
        profilePic: resolvedProfile?.profilePic || "https://via.placeholder.com/900x1600/FFD166/FFFFFF?text=Clara",
        sex: [0, 1, 0],
        interestSex: [1, 0, 0],
        interests: generateInterests(),
        searching: [1, 0, 0, 0, 0, 0],
      },
      {
        peerId: generatePeerId(),
        publicKey: "TemporaryPublicKey",
        name: "David Kim",
        birthDay: 5,
        birthMonth: 12,
        birthYear: 1995,
        x: 1,
        y: 1,
        description: "Fitness buff and foodie. Always trying new recipes and workouts.",
        profilePic: resolvedProfile?.profilePic || "https://via.placeholder.com/900x1600/06D6A0/FFFFFF?text=David",
        sex: [1, 0, 0],
        interestSex: [0, 1, 0],
        interests: generateInterests(),
        searching: [0, 0, 0, 0, 0, 1],
      },
      {
        peerId: generatePeerId(),
        publicKey: "TemporaryPublicKey",
        name: "Emma Brown",
        birthDay: 18,
        birthMonth: 2,
        birthYear: 1998,
        x: 1,
        y: 1,
        description: "Dog mom and nature lover. Enjoys long walks and sunsets.",
        profilePic: resolvedProfile?.profilePic || "https://via.placeholder.com/900x1600/EF476F/FFFFFF?text=Emma",
        sex: [0, 1, 0],
        interestSex: [1, 0, 0],
        interests: generateInterests(),
        searching: [0, 0, 1, 0, 0, 0],
      },
      {
        peerId: generatePeerId(),
        publicKey: "TemporaryPublicKey",
        name: "Frank Wilson",
        birthDay: 30,
        birthMonth: 7,
        birthYear: 1985,
        x: 1,
        y: 1,
        description: "Musician and history buff. Plays guitar in a local band.",
        profilePic: resolvedProfile?.profilePic || "https://via.placeholder.com/900x1600/118AB2/FFFFFF?text=Frank",
        sex: [1, 0, 0],
        interestSex: [0, 1, 0],
        interests: generateInterests(),
        searching: [0, 1, 0, 0, 0, 0],
      },
      {
        peerId: generatePeerId(),
        publicKey: "TemporaryPublicKey",
        name: "Grace Chen",
        birthDay: 8,
        birthMonth: 11,
        birthYear: 2003,
        x: 1,
        y: 1,
        description: "Art student with a passion for painting and anime.",
        profilePic: resolvedProfile?.profilePic || "https://via.placeholder.com/900x1600/073B4C/FFFFFF?text=Grace",
        sex: [0, 1, 0],
        interestSex: [0, 0, 1],
        interests: generateInterests(),
        searching: [0, 0, 0, 1, 0, 0],
      },
      {
        peerId: generatePeerId(),
        publicKey: "TemporaryPublicKey",
        name: "Henry Patel",
        birthDay: 25,
        birthMonth: 4,
        birthYear: 1996,
        x: 1,
        y: 1,
        description: "Travel junkie and photographer. Always planning the next trip.",
        profilePic: resolvedProfile?.profilePic || "https://via.placeholder.com/900x1600/F4A261/FFFFFF?text=Henry",
        sex: [1, 0, 0],
        interestSex: [0, 1, 0],
        interests: generateInterests(),
        searching: [0, 0, 0, 0, 0, 1],
      },
      {
        peerId: generatePeerId(),
        publicKey: "TemporaryPublicKey",
        name: "Isabel Garcia",
        birthDay: 12,
        birthMonth: 1,
        birthYear: 1994,
        x: 1,
        y: 1,
        description: "Yoga instructor and wellness coach. Promotes mindfulness.",
        profilePic: resolvedProfile?.profilePic || "https://via.placeholder.com/900x1600/2A9D8F/FFFFFF?text=Isabel",
        sex: [0, 1, 0],
        interestSex: [1, 0, 0],
        interests: generateInterests(),
        searching: [0, 0, 0, 0, 1, 0],
      },
      {
        peerId: generatePeerId(),
        publicKey: "TemporaryPublicKey",
        name: "James Nguyen",
        birthDay: 3,
        birthMonth: 8,
        birthYear: 1999,
        x: 1,
        y: 1,
        description: "Gamer and tech enthusiast. Loves building custom PCs.",
        profilePic: resolvedProfile?.profilePic || "https://via.placeholder.com/900x1600/E76F51/FFFFFF?text=James",
        sex: [1, 0, 0],
        interestSex: [0, 0, 1],
        interests: generateInterests(),
        searching: [0, 0, 1, 0, 0, 0],
      },
    ],
    [resolvedProfile]
  );

  const hasMoreProfiles = currentIndex < exampleProfiles.length;

  const likeButton = () => {
    if (!isDetailsOpen && hasMoreProfiles && !isSwiping) {
      setIsSwiping(true);
      // const currentProfile = exampleProfiles[currentIndex];
      // console.log("Liked profile:", currentProfile.name);
      swiperRef.current?.swipeRight();
    }
  };

  const dislikeButton = () => {
    if (!isDetailsOpen && hasMoreProfiles && !isSwiping) {
      setIsSwiping(true);
      // const currentProfile = exampleProfiles[currentIndex];
      // console.log("Disliked profile:", currentProfile.name);
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
    router.push("../filtration/filtrationPage")
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
          <TouchableOpacity onPress={() => filtrationPage()} activeOpacity={0.7}>
            <FilterIcon height={21} width={21} fill={Colors[colorScheme ?? "light"].icon} />
          </TouchableOpacity>
        </View>

        <View style={styles.cardContainer} onLayout={handleContainerLayout}>
          {containerHeight > 0 && (
            <Swiper
              key={containerHeight}
              ref={swiperRef}
              cards={exampleProfiles}
              renderCard={renderCard}
              stackSize={3}
              stackSeparation={0}
              cardIndex={0}
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
                const swipedProfile = exampleProfiles[cardIndex];
                console.log("Swiped left on:",swipedProfile.name ,swipedProfile.peerId);
              }}
              onSwipedRight={(cardIndex: number) => {
                const swipedProfile = exampleProfiles[cardIndex];
                console.log("Swiped right on:",swipedProfile.name , swipedProfile.peerId);
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
      marginTop: Platform.OS === 'ios' ? 8 : 16,
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
  });