// profile/index.tsx
import React, { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet, Image, StyleProp, ViewStyle, TextStyle, ImageStyle } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import crypto from "react-native-quick-crypto";
import { Profile } from "../../types/profile";

export default function ProfileScreen(): React.JSX.Element {
  const [name, setName] = useState<string>("");
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const router = useRouter();

  const generateRSAKeyPair = (): { publicKey: string; privateKey: string } => {
    const keyPair = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "pkcs1", format: "pem" },
      privateKeyEncoding: { type: "pkcs1", format: "pem" },
    });
  
    if (typeof keyPair.publicKey !== 'string' || typeof keyPair.privateKey !== 'string') {
      throw new Error('Generated keys are not strings');
    }
  
    return { publicKey: keyPair.publicKey, privateKey: keyPair.privateKey };
  };

  const saveProfile = async (): Promise<void> => {
    if (name && profilePic) {
      console.log("🔑 Generowanie kluczy RSA...");
      const { publicKey, privateKey } = generateRSAKeyPair();

      // Save private key locally
      await AsyncStorage.setItem("privateKey", privateKey);
      console.log("✅ Klucz prywatny zapisany lokalnie");

      // Save profile with public key
      const profile: Profile = { name, profilePic, publicKey };
      await AsyncStorage.setItem("userProfile", JSON.stringify(profile));
      console.log("✅ Profil zapisany:", profile);

      router.push("../");
    } else {
      alert("Please complete your profile.");
    }
  };

  const pickImage = async (): Promise<void> => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      base64: true,
      quality: 1,
    });

    if (!result.canceled && result.assets?.[0]?.base64) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      console.log("Selected image:", base64Image);
      setProfilePic(base64Image);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Your Profile</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your name"
        value={name}
        onChangeText={setName}
      />
      {profilePic && <Image source={{ uri: profilePic }} style={styles.image} />}
      <Button title="Pick Profile Picture" onPress={pickImage} />
      <Button title="Save Profile" onPress={saveProfile} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
  },
  input: {
    width: "100%",
    padding: 10,
    borderWidth: 1,
    borderColor: "#ccc",
    marginBottom: 20,
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 20,
  },
});