import { SafeAreaView, Text, FlatList, View, StyleSheet, Image, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useWebRTC } from '../../contexts/WebRTCContext';

// const signalingServerURL = 'http://10.0.2.2:3030';


const MainScreen = () => {
  const { profile, peers } = useWebRTC();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle='dark-content' />
      {profile ? (
        <View style={styles.selfProfileContainer}>
          <Image source={{ uri: profile.profilePic }} style={styles.profileImage} />
          <Text style={styles.profileName}>{profile.name}</Text>
        </View>
      ) : (
        <Text style={styles.noProfileText}>No profile data available</Text>
      )}
      <Text style={styles.title}>Connected Peers</Text>
      <FlatList
        data={peers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.peerItem}>


            <Pressable
              onPress={() => {
                router.push({
                  pathname: "./chat/[peerId]",
                  params: { peerId: item.id },
                });
              }}
            >
              <Text style={styles.peerText}>
                {item.id}: {item.status}
              </Text>
            </Pressable>



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
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    color: 'white',
  },
  peerText: {
    fontSize: 16,
    color: 'white',
  },
  selfProfileContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
  },
  profileName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
  },
  noProfileText: {
    fontSize: 16,
    color: "white",
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
    marginBottom: 5,
    color: "white",
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