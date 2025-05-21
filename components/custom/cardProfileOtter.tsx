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
  Alert,
} from "react-native";
import Modal from "react-native-modal";
import { Colors } from "@/constants/Colors";
import { Fonts } from "@/constants/Fonts";
import { Profile } from "@/types/types";
import CloseIcon from "@/assets/icons/uicons/cross-small.svg";
import LocationIcon from "@/assets/icons/uicons/location marker.svg";
import ArrowIcon from "@/assets/icons/uicons/angle-small-left.svg";
import { searchingOptions } from "@/constants/SearchingOptions";
import { interestsOptions } from "@/constants/InterestsOptions";
import { sexOptions } from "@/constants/SexOptions";
import { calculateGeoDistance, getExactLocation } from "@/contexts/geolocation/geolocation";
import { useWebRTC } from "@/contexts/WebRTCContext";
import { useTheme } from "@/contexts/themeContext";
import { useTranslation } from "react-i18next";

interface CardSwipeProps {
  profile: Profile;
  containerHeight?: number;
  onDetailsToggle?: (isDetailsOpen: boolean) => void;
  showDistance?: boolean;
}

export default function CardSwipe({ profile, containerHeight, onDetailsToggle, showDistance=true }: CardSwipeProps): React.JSX.Element {
  const {peersReceivedLikeFromRef} = useWebRTC();
  const { t } = useTranslation();
  const [showDetails, setShowDetails] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const { theme } = useTheme();
  const styles = getStyles(theme, containerHeight || 0);

  useEffect(() => {
    onDetailsToggle?.(showDetails);
    const loadDistance = async () => {
      try {
        if (showDistance) {
          const loc = await getExactLocation();
          console.log(profile?.latitude)
          if(loc != null && profile.latitude != null && profile.longitude != null){
            const distance = calculateGeoDistance(loc.latitude, loc.longitude, profile.latitude, profile.longitude);
            setDistance(Math.floor(distance));
            console.log("Distance",distance)
          }
        }
      } catch (error) {
        console.error('Error loading profile:', error);
        Alert.alert('🦦', t("errors.problem_catching_distance"));
      }
    };
    loadDistance();
  }, [showDetails, onDetailsToggle]);

  const calculateAge = (birthYear: number, birthMonth: number, birthDay: number) => {
    if (!birthYear || !birthMonth || !birthDay) {
      return null;
    }
    const today = new Date();
    const birthDate = new Date(birthYear, birthMonth - 1, birthDay);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const age = profile && profile.birthYear && profile.birthMonth && profile.birthDay
    ? calculateAge(profile.birthYear, profile.birthMonth, profile.birthDay)
    : "🦦";

  const selectedInterests = (() => {
    if (!profile || !profile.interests) return [];
    console.log("profile.interests type:", typeof profile.interests, "value:", profile.interests);

    let interestsArray: number[] = [];

    if (Array.isArray(profile.interests)) {
      interestsArray = profile.interests;
    } else if (typeof profile.interests === "string") {
      try {
        interestsArray = JSON.parse(profile.interests);
        if (!Array.isArray(interestsArray) || !interestsArray.every((val) => typeof val === "number")) {
          throw new Error("Parsed interests is not an array of numbers");
        }
        console.log("Parsed interestsArray:", interestsArray);
      } catch (e) {
        console.error("Failed to parse interests:", profile.interests, e);
        return [];
      }
    } else {
      console.error("Unexpected type for interests:", profile.interests);
      return [];
    }
    return interestsArray
      .map((value, index) => (value === 1 && index < interestsOptions.length ? t("interests_options.no_emoji."+index) : null))
      .filter((interest): interest is string => interest !== null);
  })();

  const selectedSearching = (() => {
  if (!profile || !profile.searching) return "🦦";
  console.log("profile.searching type:", typeof profile.searching, "value:", profile.searching);

  let searchIndex: number | null = null;

  if (Array.isArray(profile.searching)) {
    searchIndex = profile.searching.findIndex((value) => value === 1);
  } else if (typeof profile.searching === "string") {
    try {
      const parsed = JSON.parse(profile.searching);
      if (!Array.isArray(parsed) || !parsed.every((val) => typeof val === "number")) {
        throw new Error("Parsed searching is not an array of numbers");
      }
      searchIndex = parsed.findIndex((value) => value === 1);
      console.log("Parsed searching array:", parsed);
    } catch (e) {
      console.error("Failed to parse searching:", profile.searching, e);
      return "🦦";
    }
  } else {
    console.error("Unexpected type for searching:", profile.searching);
    return "🦦";
  }

  return searchIndex !== null && searchIndex >= 0 && searchIndex < searchingOptions.length
    ? t("searching_options.no_emoji."+searchIndex)
    : "🦦";
})();

  const selectedSex = (() => {
    if (!profile || !profile.sex) return "🦦";

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
      ? t("sex_options."+sexIndex)
      : "🦦";
  })();

  const descriptionText = profile?.description || t("errors.otter_lost_description");

  return (
    <View style={styles.card}>
      {profile?.profilePic ? (
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
            {/* Profile Liked Info (Popup) */}
            {peersReceivedLikeFromRef.current.lookup.has(profile?.peerId) && (
              <View style={styles.profileLikedInfo}>
                <Text style={styles.profileLikedText}>{t("components.card_profile_otter.otter_likes_you_popup")}</Text>
              </View>
            )}
            <Text style={styles.profileName}>
              {profile?.name || t("errors.otter_lost_name")}
              <Text style={styles.profileAge}> {age}</Text>
            </Text>
            <ArrowIcon style={styles.moreInfoButton} height={32} width={32} fill={theme.text} />
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
            {profile?.profilePic ? (
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
              {/* Profile Liked Info (Popup) */}
              {peersReceivedLikeFromRef.current.lookup.has(profile?.peerId) && (
                <View style={[styles.profileLikedInfo, styles.profileLikedInfoDetailed]}>
                  <Text style={styles.profileLikedText}>{t("components.card_profile_otter.otter_likes_you_popup")}</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowDetails(false)}
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              >
                <CloseIcon height={32} width={32} fill={theme.text} />
              </TouchableOpacity>
              
              <Text style={styles.profileName}>
                {profile?.name || t("errors.otter_lost_name")}
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

              {distance && showDistance
              ? 
              <View style={styles.profileLocationRow}>
                <LocationIcon height={24} width={24} fill={theme.accent} />
                <Text style={styles.profileLocation}>{t("general.in_distance")} {distance} km</Text>
              </View> 
              : 
              ""}

              <Text style={styles.titleSection}>{t("components.card_profile_otter.description_title")}</Text>
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
const getStyles = (theme: typeof Colors.light, containerHeight: number) =>
  StyleSheet.create({
    card: {
      width: SCREEN_WIDTH - 40,
      height: containerHeight > 0 ? containerHeight : (SCREEN_WIDTH - 40) * 1.8,
      backgroundColor: theme.background2,
      borderRadius: 22,
      overflow: "hidden",
      borderWidth: 2,
      borderColor: theme.border1,
    },
    image: {
      width: "100%",
      height: "100%",
      backgroundColor: theme.border1_50,
      alignItems: "center",
      justifyContent: "center",
    },
    modalImage: {
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT * 0.8,
      backgroundColor: theme.border1_50,
      alignItems: "center",
      justifyContent: "center",
    },
    imagePlaceholderText: {
      fontSize: 24,
      color: theme.text,
      fontFamily: Fonts.fontFamilyBold,
      lineHeight: 24,
    },
    profileInfo: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.background4_50,
      padding: 16,
    },
    profileLikedInfo: {
      position: "absolute",
      bottom: 60,
      left: 0,
      right: 0,
      backgroundColor: theme.background4_50,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.accent,
      zIndex: 10,
    },
    profileLikedInfoDetailed: {
      top: -60,
      left: 20,
      right: 20,
    },
    profileLikedText: {
      fontSize: 16,
      lineHeight: Platform.OS === "ios" ? 22 : 18,
      color: theme.text,
      fontFamily: Fonts.fontFamilyBold,
      textAlign: "center",
    },
    nameRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    profileName: {
      maxWidth: "90%",
      fontSize: 28,
      color: theme.text,
      fontFamily: Fonts.fontFamilyBold,
      lineHeight: 28,
    },
    titleSection: {
      fontSize: 28,
      color: theme.text,
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
      color: theme.text,
      fontFamily: Fonts.fontFamilyRegular,
      marginLeft: 8,
    },
    profileAge: {
      fontSize: 28,
      color: theme.text,
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
      color: theme.text2,
      fontFamily: Fonts.fontFamilyRegular,
      lineHeight: Platform.OS === "ios" ? 20 : 27,
      paddingRight: 4,
      paddingLeft: Platform.OS === "ios" ? 4 : 8,
      borderWidth: 2,
      borderColor: theme.accent,
      borderRadius: 13,
    },
    fullScreenModal: {
      margin: 0,
      justifyContent: "flex-end",
    },
    modalContainer: {
      flex: 1,
      backgroundColor: theme.background2,
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
      backgroundColor: theme.background2,
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
      color: theme.text,
      fontFamily: Fonts.fontFamilyRegular,
      lineHeight: 16,
    },
    moreInfoButton: {
      transform: [{ rotate: "90deg" }],
    },
  });