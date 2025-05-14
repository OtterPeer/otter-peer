import { SafeAreaView, Text, FlatList, View, StyleSheet, Image, Pressable, Button } from 'react-native';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useWebRTC } from '../../contexts/WebRTCContext';
import { router } from 'expo-router';
import { Profile } from '../../types/types';

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { updateGeolocationProfile } from '@/contexts/geolocation/geolocation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserFiltration } from '../filtration/filtrationUtils';

const MainScreen: React.FC = () => {
  const { profile, peers, disconnectFromWebSocket, peerIdRef, closePeerConnection, dhtRef, setMatchesTimestamps, peersReceivedLikeFromRef, likedPeersRef, displayedPeersRef } = useWebRTC();

  const [resolvedProfile, setResolvedProfile] = useState<Profile | null>(null);
    const [showPopup, setShowPopup] = useState(false);

  const colorScheme = useColorScheme();
  const styles = getStyles(colorScheme ?? 'light');
  
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
        await updateGeolocationProfile()
      } catch (error) {
        console.error('Error resolving profile:', error);
        setResolvedProfile(null);
      }
    };
    loadProfile();
  }, [profile]);

  const clearDHTState = async () => {
    try {
      await AsyncStorage.removeItem(`@DHT:${peerIdRef.current}:kBucket`);
      await AsyncStorage.removeItem(`@DHT:${peerIdRef.current}:cachedMessages`);
      console.log('DHT state cleared successfully');
    } catch (error) {
      console.error('Error clearing DHT state:', error);
    }
  };

  const clearLikesAndMatchesState = async () => {
    try {
      setMatchesTimestamps((prev) => new Map());
      peersReceivedLikeFromRef.current.queue = [];
      peersReceivedLikeFromRef.current.lookup.clear();
      likedPeersRef.current.clear();
      displayedPeersRef.current.clear();
      await AsyncStorage.removeItem('@WebRTC:matchesTimestamps');
      await AsyncStorage.removeItem('@WebRTC:diplayedPeers');
      await AsyncStorage.removeItem('@WebRTC:likedPeers');
      await AsyncStorage.removeItem('@WebRTC:peersReceivedLikeFrom');
      console.log('Likes and matches state cleared successfully');
    } catch (error) {
      console.error('Error clearing likes and matches state:', error);
    }
  };

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
      <Button
        title="Clear DHT state"
        onPress={clearDHTState}
        color="#FF6347"
      />
      <Button
        title="Clear swipes/matches state"
        onPress={clearLikesAndMatchesState}
        color="#FF6347"
      />
      <Button
        title="Get userFiltration"
        onPress={getUserFiltration}
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

const getStyles = (colorScheme: 'light' | 'dark' | null) =>
  StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: Colors[colorScheme ?? 'light'].background1,
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