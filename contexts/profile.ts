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

export const fetchProfile = async (
  setProfile: (profile: Profile | null) => void,
  router: Router
): Promise<void> => {
  //   AsyncStorage.removeItem("userProfile");
  try {
    const storedProfile = await AsyncStorage.getItem("userProfile");
    if (storedProfile) {
      const parsedProfile: Profile = JSON.parse(storedProfile);
      setProfile(parsedProfile);
    } else {
      setProfile(null);
      router.replace("/profile"); // Absolute path to avoid relative routing issues
    }
  } catch (error) {
    console.error("Error fetching profile:", error);
    setProfile(null);
    router.replace("/profile"); // Navigate on error as a fallback
  }
};
