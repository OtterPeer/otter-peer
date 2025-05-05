import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  TouchableOpacity,
  Platform,
  ScrollView,
} from "react-native";
import Modal from "react-native-modal";
import { Colors } from "@/constants/Colors";
import { Fonts } from "@/constants/Fonts";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Profile } from "@/types/types";
import CloseIcon from "@/assets/icons/uicons/cross-small.svg";
import LocationIcon from "@/assets/icons/uicons/location marker.svg";
import ArrowIcon from "@/assets/icons/uicons/angle-small-left.svg";
import { searchingOptions } from "@/constants/SearchingOptions";
import { interestsOptions } from "@/constants/InterestsOptions";
import { sexOptions } from "@/constants/SexOptions";

interface CardSwipeProps {
  profile: Profile;
  containerHeight?: number;
  onDetailsToggle?: (isDetailsOpen: boolean) => void;
}

export default function CardSwipe({ profile, containerHeight, onDetailsToggle }: CardSwipeProps): React.JSX.Element {
  const colorScheme = useColorScheme();
  const styles = getStyles(colorScheme ?? "light", containerHeight || 0);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    onDetailsToggle?.(showDetails);
  }, [showDetails, onDetailsToggle]);

  const calculateAge = (birthYear: number, birthMonth: number, birthDay: number) => {
    const today = new Date();
    const birthDate = new Date(birthYear, birthMonth - 1, birthDay);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const age = profile.birthYear && profile.birthMonth && profile.birthDay
    ? calculateAge(profile.birthYear, profile.birthMonth, profile.birthDay)
    : "🦦";

  const selectedInterests = (() => {
    console.log("profile.interests type:", typeof profile.interests, "value:", profile.interests);
    if (!profile.interests) return [];

    let interestsArray: number[] = [];

    if (Array.isArray(profile.interests)) {
      interestsArray = profile.interests;
    } else if (typeof profile.interests === "string") {
      try {
        interestsArray = (profile.interests as string)
          .split(",")
          .map((val) => parseInt(val.trim(), 10))
          .filter((val) => !isNaN(val));
      } catch (e) {
        console.error("Failed to parse interests:", profile.interests);
        return [];
      }
    } else {
      console.error("Unexpected type for interests:", profile.interests);
      return [];
    }

    return interestsArray
      .map((value, index) => (value === 1 && index < interestsOptions.length ? interestsOptions[index] : null))
      .filter((interest): interest is string => interest !== null);
  })();

  const selectedSearching = (() => {
    console.log("profile.searching type:", typeof profile.searching, "value:", profile.searching);
    if (!profile.searching) return "🦦";

    let searchIndex: number | null = null;

    if (Array.isArray(profile.searching)) {
      searchIndex = profile.searching.findIndex((value) => value === 1);
    } else if (typeof profile.searching === "string") {
      try {
        const parsed = (profile.searching as string).includes(",")
          ? (profile.searching as string)
              .split(",")
              .map((val) => parseInt(val.trim(), 10))
              .findIndex((value) => value === 1)
          : parseInt(profile.searching, 10);
        if (typeof parsed === "number" && !isNaN(parsed) && parsed >= 0 && parsed < searchingOptions.length) {
          searchIndex = parsed;
        } else if (parsed === -1) {
          return "🦦";
        }
      } catch (e) {
        console.error("Failed to parse searching:", profile.searching);
        return "🦦";
      }
    } else {
      console.error("Unexpected type for searching:", profile.searching);
      return "🦦";
    }

    return searchIndex !== null && searchIndex >= 0 && searchIndex < searchingOptions.length
      ? searchingOptions[searchIndex]
      : "🦦";
  })();

  const selectedSex = (() => {
    if (!profile.sex) return "🦦";

    let sexIndex: number | null = null;

    if (Array.isArray(profile.sex)) {
      sexIndex = profile.sex.findIndex((value) => value === 1);
    } else if (typeof profile.sex === "string") {
      const parsedArray = JSON.parse(profile.sex);

      if (Array.isArray(parsedArray)) {
        const indexOfOne = parsedArray.indexOf(1);
        console.log("Index of 1:", indexOfOne);
        return sexOptions[indexOfOne]
      }

    } else {
      console.error("Unexpected type for sex:", profile.sex);
      return "🦦";
    }
    
    return sexIndex !== null && sexIndex >= 0 && sexIndex < sexOptions.length
      ? sexOptions[sexIndex]
      : "🦦";
  })();

  const descriptionText = profile.description || "🦦 Wyderka zgubiła opis";

  return (
    <View style={styles.card}>
      {profile.profilePic ? (
        <Image
          source={{ uri: profile.profilePic }}
          style={styles.image}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.image}>
          <Text style={styles.imagePlaceholderText}>...</Text>
        </View>
      )}

      {/* Short Information View */}
      <TouchableOpacity onPress={() => setShowDetails(true)}>
        <View style={styles.profileInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.profileName}>
              {profile.name || "🦦 Wyderka zgubiła imię"}
              <Text style={styles.profileAge}> {age}</Text>
            </Text>
            <ArrowIcon style={styles.moreInfoButton} height={32} width={32} fill={Colors[colorScheme ?? "light"].text} />
          </View>
          <View style={styles.interestsRow}>
            {selectedInterests.map((interest, index) => (
              <Text key={`interest-${index}`} style={styles.interestText}>
                {interest}
              </Text>
            ))}
            <Text style={styles.interestText}>{selectedSex}</Text>
            <Text style={styles.interestText}>{selectedSearching}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Detailed Information Modal */}
      <Modal
        isVisible={showDetails}
        onBackdropPress={() => setShowDetails(false)}
        onBackButtonPress={() => setShowDetails(false)}
        style={styles.fullScreenModal}
        useNativeDriver={true}
        useNativeDriverForBackdrop={true}
        propagateSwipe={true}
      >
        <View style={styles.modalContainer}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            scrollEnabled={true}
            nestedScrollEnabled={true}
            scrollEventThrottle={16}
          >
            {/* Profile Image */}
            {profile.profilePic ? (
              <Image
                source={{ uri: profile.profilePic }}
                style={styles.modalImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.modalImage}>
                <Text style={styles.imagePlaceholderText}>...</Text>
              </View>
            )}

            {/* Profile Details */}
            <View style={styles.modalContent}>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowDetails(false)}
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              >
                <CloseIcon height={32} width={32} fill={Colors[colorScheme ?? "light"].text} />
              </TouchableOpacity>
              <Text style={styles.profileName}>
                {profile.name || "🦦 Wyderka zgubiła imię"}
                <Text style={styles.profileAge}> {age}</Text>
              </Text>

              <View style={styles.interestsRow}>
                {selectedInterests.map((interest, index) => (
                  <Text key={`interest-${index}`} style={styles.interestText}>
                    {interest}
                  </Text>
                ))}
                <Text style={styles.interestText}>{selectedSex}</Text>
                <Text style={styles.interestText}>{selectedSearching}</Text>
              </View>

              <View style={styles.profileLocationRow}>
                <LocationIcon height={24} width={24} fill={Colors[colorScheme ?? "light"].accent} />
                <Text style={styles.profileLocation}>W odległości 10 km</Text>
              </View>

              <Text style={styles.titleSection}>Opis</Text>
              <View style={styles.descriptionContainer}>
                <Text style={styles.detailedDescription}>
                  {descriptionText}
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const getStyles = (colorScheme: "light" | "dark" | null, containerHeight: number) =>
  StyleSheet.create({
    card: {
      width: SCREEN_WIDTH - 40,
      height: containerHeight > 0 ? containerHeight : (SCREEN_WIDTH - 40) * 1.8,
      backgroundColor: Colors[colorScheme ?? "light"].background2,
      borderRadius: 22,
      overflow: "hidden",
      borderWidth: 2,
      borderColor: Colors[colorScheme ?? "light"].border1,
    },
    image: {
      width: "100%",
      height: "100%",
      backgroundColor: Colors[colorScheme ?? "light"].border1_50,
      alignItems: "center",
      justifyContent: "center",
    },
    modalImage: {
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT * 0.8,
      backgroundColor: Colors[colorScheme ?? "light"].border1_50,
      alignItems: "center",
      justifyContent: "center",
    },
    imagePlaceholderText: {
      fontSize: 24,
      color: Colors[colorScheme ?? "light"].text,
      fontFamily: Fonts.fontFamilyBold,
      lineHeight: 24,
    },
    profileInfo: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: Colors[colorScheme ?? "light"].background4_50,
      padding: 16,
    },
    nameRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    profileName: {
      fontSize: 28,
      color: Colors[colorScheme ?? "light"].text,
      fontFamily: Fonts.fontFamilyBold,
      lineHeight: 28,
    },
    titleSection: {
      fontSize: 28,
      color: Colors[colorScheme ?? "light"].text,
      fontFamily: Fonts.fontFamilyBold,
      lineHeight: 28,
      marginTop: 16,
    },
    profileLocationRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-start",
      marginTop: 8,
    },
    profileLocation: {
      fontSize: 14,
      lineHeight: 24,
      color: Colors[colorScheme ?? "light"].text,
      fontFamily: Fonts.fontFamilyRegular,
      marginLeft: 8,
    },
    profileAge: {
      fontSize: 28,
      color: Colors[colorScheme ?? "light"].text,
      fontFamily: Fonts.fontFamilyRegular,
      lineHeight: 28,
    },
    interestsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginTop: 4,
      gap: 4,
    },
    interestText: {
      height: 26,
      fontSize: 12,
      color: Colors[colorScheme ?? "light"].text2,
      fontFamily: Fonts.fontFamilyRegular,
      lineHeight: Platform.OS === "ios" ? 20 : 27,
      paddingRight: 4,
      paddingLeft: Platform.OS === "ios" ? 4 : 8,
      borderWidth: 2,
      borderColor: Colors[colorScheme ?? "light"].accent,
      borderRadius: 13,
    },
    fullScreenModal: {
      margin: 0,
      justifyContent: "flex-end",
    },
    modalContainer: {
      flex: 1,
      backgroundColor: Colors[colorScheme ?? "light"].background2,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: SCREEN_HEIGHT,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      minHeight: SCREEN_HEIGHT,
      paddingBottom: 32,
    },
    modalContent: {
      paddingHorizontal: 20,
      paddingVertical: 20,
      backgroundColor: Colors[colorScheme ?? "light"].background2,
      borderTopRightRadius: 25,
      borderTopLeftRadius: 25,
      marginTop: -25,
    },
    modalCloseButton: {
      position: "absolute",
      top: 8,
      right: 8,
      zIndex: 10,
      padding: 8,
    },
    descriptionContainer: {
      marginTop: 8,
      paddingBottom: 200,
    },
    detailedDescription: {
      fontSize: 14,
      color: Colors[colorScheme ?? "light"].text,
      fontFamily: Fonts.fontFamilyRegular,
      lineHeight: 16,
    },
    moreInfoButton: {
      transform: [{ rotate: "90deg" }],
    },
  });