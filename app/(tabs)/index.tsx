import { SafeAreaView, Text, FlatList, View, StyleSheet, Image, Pressable, Button } from 'react-native';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useWebRTC } from '../../contexts/WebRTCContext';
import { router, Link } from 'expo-router';
import { Profile } from '../../types/types';
import { setupUserDatabase } from '../../contexts/db/userdb';

const MainScreen: React.FC = () => {
  const { profile, peers, disconnectFromWebSocket, peerIdRef, closePeerConnection, dhtRef } = useWebRTC();

  const [resolvedProfile, setResolvedProfile] = useState<Profile | null>(null);
    const [showPopup, setShowPopup] = useState(false);
  
    useEffect(() => {
      const handleForward = () => {
        setShowPopup(true);
        console.log("Showing pop up")
        const timer = setTimeout(() => {
          setShowPopup(false);
        }, 3000);
        return () => clearTimeout(timer);
      };
  
      dhtRef.current?.on("forward", handleForward);
  
      return () => {
        dhtRef.current?.off("forward", handleForward);
      };
    }, [dhtRef]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profileData = await profile;
        setResolvedProfile(profileData);
      } catch (error) {
        console.error('Error resolving profile:', error);
        setResolvedProfile(null);
      }
    };
    loadProfile();
    setupUserDatabase()
  }, [profile]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      {resolvedProfile ? (
        <View style={styles.selfProfileContainer}>
          <Image source={{ uri: resolvedProfile.profilePic }} style={styles.profileImage} />
          <Text style={styles.profileName}>{resolvedProfile.name}</Text>
          <Text style={styles.profileName}>{resolvedProfile.peerId}</Text>
        </View>
      ) : (
        <Text style={styles.noProfileText}>No profile data available</Text>
      )}
      {showPopup && (
              <View>
                <Text style={styles.peerText}>New forward event received!</Text>
              </View>
      )}
      <Button
        title="Disconnect from WebSocket"
        onPress={disconnectFromWebSocket}
        color="#FF6347"
      />
      <Text style={styles.title}>Connected Peers</Text>
      <FlatList
        data={peers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.peerItem}>
            <Pressable
              onPress={() => {
                router.push({
                  pathname: './chat/[peerId]',
                  params: {
                    peerId: item.id,
                    username: item.profile?.name || 'Unknown',
                    peerPublicKey: item.profile?.publicKey || '',
                  },
                });
              }}
            >
              <Text style={styles.peerText}>
                {item.id}: {item.status}
              </Text>
              {item.profile && (
                <View style={styles.profileContainer}>
                  <Text style={styles.peerText}>Name: {item.profile.name}</Text>
                  {item.profile.profilePic && (
                    <Image
                      source={{ uri: item.profile.profilePic }}
                      style={styles.profilePic}
                    />
                  )}
                </View>
              )}
            </Pressable>
            <Button
              title="Close PeerConnection"
              onPress={() => closePeerConnection(item.profile!.peerId)}
              color="#FF6347"
            />
          </View>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#28292b',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: 'white',
  },
  peerItem: {
    marginBottom: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
  },
  peerText: {
    fontSize: 16,
    color: 'white',
  },
  selfProfileContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
  },
  profileName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  noProfileText: {
    fontSize: 16,
    color: 'white',
  },
  profileContainer: {
    marginTop: 10,
  },
  profilePic: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
});

export default MainScreen;