import AsyncStorage from "@react-native-async-storage/async-storage";
import { Router } from "expo-router";
import { Profile } from "../types/types";
import { RTCDataChannel } from "react-native-webrtc";
import { sendData } from "./webrtcService";

export async function shareProfile(
  profile: Profile | null,
  sendFile: typeof sendData,
  dataChannel: RTCDataChannel
): Promise<void> {
  try {
    if (profile !== null) {
      console.log("Sending profile from offer side...");
      sendFile(dataChannel, JSON.stringify({ type: "profile", profile }));
    }
  } catch (error) {
    console.error("Error while sending profile:", error);
  }
}

export const fetchProfile = async (router: Router): Promise<Profile | null> => {
  try {
    const storedProfile = await AsyncStorage.getItem("userProfile");
    if (storedProfile) {
      return JSON.parse(storedProfile) as Profile;
    } else {
      router.replace("/profile/rules");
      return null;
    }
  } catch (error) {
    console.error("Error fetching profile:", error);
    router.replace("/profile/rules");
    return null;
  }
};