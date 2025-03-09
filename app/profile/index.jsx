import React, { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet, Image } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import crypto from "react-native-quick-crypto";

export default function ProfileScreen() {
  const [name, setName] = useState("");
  const [profilePic, setProfilePic] = useState(null);
  const router = useRouter();

  const generateRSAKeyPair = () => {
    return crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "pkcs1", format: "pem" },
      privateKeyEncoding: { type: "pkcs1", format: "pem" },
    });
  };

  const saveProfile = async () => {
    if (name && profilePic) {
      console.log("🔑 Generowanie kluczy RSA...");
      const { publicKey, privateKey } = generateRSAKeyPair();

      // Zapis klucza prywatnego tylko lokalnie
      await AsyncStorage.setItem("privateKey", privateKey);
      console.log("✅ Klucz prywatny zapisany lokalnie");

      // Zapis profilu z kluczem publicznym
      const profile = { name, profilePic, publicKey };
      await AsyncStorage.setItem("userProfile", JSON.stringify(profile));
      console.log("✅ Profil zapisany:", profile);

      router.push("/");
    } else {
      alert("Please complete your profile.");
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      base64: true, // Base64 ensures you can store the image in AsyncStorage
      quality: 1,
    });
  
    if (!result.canceled && result.assets?.[0]?.base64) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      console.log("Selected image:", base64Image);
      setProfilePic(base64Image); // Ensure Base64 image is prefixed correctly
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
  container: { flex: 1, padding: 16, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 24, marginBottom: 20 },
  input: { width: "100%", padding: 10, borderWidth: 1, borderColor: "#ccc", marginBottom: 20 },
  image: { width: 100, height: 100, borderRadius: 50, marginBottom: 20 },
});
