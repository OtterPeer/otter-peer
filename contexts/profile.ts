import { RTCDataChannel } from "react-native-webrtc";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { sendData } from "./webrtcService";
import { Router } from "expo-router";
import { Profile } from "../types/types";

export async function shareProfile(
  sendFile: typeof sendData,
  dataChannel: RTCDataChannel
): Promise<void> {
  const storedProfile = await AsyncStorage.getItem("userProfile");
  const profile = storedProfile ? JSON.parse(storedProfile) : null;
  try {
    if (profile !== null) {
      console.log("Sending profile from offer side...");
      sendFile(dataChannel, JSON.stringify({ type: "profile", profile }));
    }
  } catch (error) {
    console.error("Error while sending profile:", error);
  }
}

export const fetchProfile = async (router: Router): Promise<Profile> => {
  // AsyncStorage.removeItem("userProfile");
  let parsedProfile: Profile;
  try {
    const storedProfile = await AsyncStorage.getItem("userProfile");
    if (storedProfile) {
      parsedProfile = JSON.parse(storedProfile);
    } else {
      // router.push("/profile"); // Absolute path to avoid relative routing issues
      router.push("/profile/rules");
    }
  } catch (error) {
    console.error("Error fetching profile:", error);
    // router.push("/profile"); // Navigate on error as a fallback
    router.push("/profile/rules");
  } finally {
    const storedProfile = await AsyncStorage.getItem("userProfile");
    parsedProfile = JSON.parse(storedProfile!);
  }
  return parsedProfile;
};
