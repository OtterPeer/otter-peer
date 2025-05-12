import { RTCDataChannel, RTCPeerConnection } from "react-native-webrtc";
import { sendPEXRequest } from "./pex";
import DHT from "./dht/dht";
import { Peer, PeerDTO, Profile, ProfileMessage, UserFilter } from "../types/types";
import { Node } from "./dht/webrtc-rpc";
import { fetchUserFromDB, updateUser, User } from "./db/userdb";
import { calculateGeoDistance } from "./geolocation/geolocation";
import { calculateAge } from "./utils/user-utils";
import { sendData } from "./webrtcService";
import { MessageEvent } from "react-native-webrtc";

export class ConnectionManager {
  private minConnections: number = 20;
  private checkInterval: number = 20 * 1000; // 20s
  private connectionsRef: Map<string, RTCPeerConnection>;
  private pexDataChannelsRef: Map<string, RTCDataChannel>;
  private dhtRef: DHT;
  private initiateConnection: (targetPeer: PeerDTO, dataChannelUsedForSignaling: RTCDataChannel | null, useDHTForSignaling: boolean) => Promise<void>;
  private intervalId: NodeJS.Timeout | null = null;
  private hasTriggeredInitialConnections: boolean = false;
  private userFilter: UserFilter;
  private profileRef: Profile;
  private profilesToDisplay: Profile[];
  private displayedPeersRef: Set<string>;
  private setProfilesToDisplay: React.Dispatch<React.SetStateAction<Profile[]>>;
  private setPeers: React.Dispatch<React.SetStateAction<Peer[]>>;
  private requestedProfiles: Set<string> = new Set();
  private currentSwiperIndex: number;

  constructor(
    connectionsRef: Map<string, RTCPeerConnection>,
    pexDataChannelsRef: Map<string, RTCDataChannel>,
    dhtRef: DHT,
    userFilter: UserFilter,
    profile: Profile,
    profilesToDisplay: Profile[],
    displayedPeersRef: Set<string>,
    currentSwiperIndex: number,
    setPeers: React.Dispatch<React.SetStateAction<Peer[]>>,
    setProfilesToDisplay: React.Dispatch<React.SetStateAction<Profile[]>>,
    initiateConnection: (targetPeer: PeerDTO, dataChannelUsedForSignaling?: RTCDataChannel | null) => Promise<void>
  ) {
    this.profileRef = profile;
    this.connectionsRef = connectionsRef;
    this.pexDataChannelsRef = pexDataChannelsRef;
    this.dhtRef = dhtRef;
    this.userFilter = userFilter;
    this.displayedPeersRef = displayedPeersRef;
    this.currentSwiperIndex = currentSwiperIndex;
    this.profilesToDisplay = profilesToDisplay;
    this.initiateConnection = initiateConnection;
    this.setProfilesToDisplay = setProfilesToDisplay;
    this.setPeers = setPeers;
  }

  public start(): void {
    if (this.intervalId) {
      console.warn("ConnectionManager is already running");
      return;
    }

    this.performInitialConnections();
    // this.intervalId = setInterval(() => {
    //   this.checkPeerConnections();
    // }, this.checkInterval);
    // console.log("ConnectionManager started");
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("ConnectionManager stopped");
    }
  }

  private async performInitialConnections(): Promise<void> {
    if (this.hasTriggeredInitialConnections) {
      console.log("Initial PEX/DHT connections already triggered");
      return;
    }

    // Perform PEX request to closest peer
    await delay(2000);
    // this.filterPeersToDisplayFromConnections();
    console.log("Performing initial PEX request to closests peer known.")
    this.performPEXRequestToClosestPeer(this.minConnections);

    // Attempt DHT connections
    await delay(3000);
    console.log("Trying to restore DHT connections.")
    await this.tryToRestoreDHTConnections(this.dhtRef['k'] as number);

    this.hasTriggeredInitialConnections = true;
  }

  private performPEXRequestToClosestPeer(peersNeeded: number): void {
    const dataChannel = this.getClosestOpenPEXDataChannel();
    if (dataChannel) {
      console.log(`Requesting ${peersNeeded} additional peers via PEX`);
      try {
        sendPEXRequest(dataChannel, peersNeeded);
      } catch (error) {
        console.error("Failed to send PEX request:", error);
      }
    } else {
      console.warn("No open PEX data channels available to send request");
    }

  }

  public triggerConnectionsStateChange(): void {
    // this.checkPeerConnections(); // todo: Check number of connection, perform pex if too small
  }

  public handlePEXAdvertisement(receivedPeers: PeerDTO[], signalingDataChannel: RTCDataChannel | null) {
    const tableOfPeers: PeerDTO[] = [];

    if (Array.isArray(receivedPeers)) {
      receivedPeers.forEach((peerDto) => {
        const alreadyConnected = this.connectionsRef.has(peerDto.peerId);
        if (
          !tableOfPeers.includes(peerDto) &&
          !alreadyConnected &&
          peerDto.peerId !== this.dhtRef.getNodeId()
        ) {
          tableOfPeers.push(peerDto);
        }
      });
    }

    console.log(tableOfPeers);
    const filteredPeer = tableOfPeers.filter((peer) => this.filterPeer(peer));

    // todo: Apply priroty. Add peers to different lists depending on connections needed, e.g. peersToDisplay, connections
    filteredPeer.forEach(async (peerDto) => {
      this.initiateConnection(peerDto, signalingDataChannel, false);
      console.log("Requesting profile from peer: " + peerDto.peerId)
      let profile: Profile | null;
      try {
        profile = await this.requestProfileFromPeer(peerDto.peerId);
      } catch(err) {
        console.error(err);
        throw new Error("Error when requesting profile");
      }
      if (profile && !this.displayedPeersRef.has(peerDto.peerId)) {
        console.log("Peers to display")
        console.log(peerDto.peerId)
        this.setProfilesToDisplay((prev) => {
          if (!prev.some((p) => p.peerId === peerDto.peerId)) {
            return [...prev, profile];
          }
          return prev;
        });
      }
    });

    // connect to other peers if number of current connections < minConnections
    if ([...this.connectionsRef.keys()].length < this.minConnections) {
      const peersNeeded = this.minConnections - [...this.connectionsRef.keys()].length
      const unconnectedPeers = tableOfPeers.filter((peer) => {
        !filteredPeer.some((filteredPeer) => filteredPeer.peerId === peer.peerId) &&
        !this.connectionsRef.keys().some((connectedPeerId) => connectedPeerId === peer.peerId)
      })

      for (let i = 0; i < peersNeeded; i++) {
        if (i >= unconnectedPeers.length) {
          break;
        }
        this.initiateConnection(unconnectedPeers[i], signalingDataChannel, false);
      }
    }
  }

  private async filterPeersToDisplayFromConnections(): Promise<void> {
    let peerDTOs: PeerDTO[] = [];
    console.log("Filtering people1");
    console.log([...this.connectionsRef.keys()]);
    console.log(this.connectionsRef);
    for (const peerId of [...this.connectionsRef.keys()]) {
      console.log("here125");
      console.log(peerId);
      const user = await fetchUserFromDB(peerId);
      const publicKey = user?.publicKey!;
      const age = calculateAge(user?.birthDay!, user?.birthMonth!, user?.birthYear!);
      const sex = user?.sex as number[];
      const searching = user?.searching;
      const x = user?.x;
      const y = user?.y;
      const latitude = user?.latitude;
      const longitude = user?.longitude;
      const peerDto = { peerId, publicKey, age, sex, searching, x, y, latitude, longitude } as PeerDTO
      peerDTOs.push(peerDto);
    }

    console.log("Filtering people");
    const filteredPeers = this.filterPeersToDisplay(peerDTOs);
    console.log(filteredPeers);
    console.log("All peers");
    console.log(peerDTOs);
  }

  private filterPeersToDisplay(peers: PeerDTO[]): PeerDTO[] {
    // chceck displayed peers
    return peers.filter((peer) => {
      this.filterPeer(peer);
    });
  };

  private filterPeer(peer: PeerDTO) {
    console.log(peer);
    console.log(this.userFilter)
    if (!peer.age || peer.age < this.userFilter.ageRange[0] || peer.age > this.userFilter.ageRange[1]) {
      console.log("Age filtration failed");
      return false;
    }

    if (peer.sex !== undefined) {
      const minLength = Math.min(peer.sex.length, this.userFilter.selectedSex.length);
      let sexMatch = false;
      for (let i = 0; i < minLength; i++) {
        if (peer.sex[i] === 1 && this.userFilter.selectedSex[i] === 1) {
          sexMatch = true;
          break;
        }
      }
      if (!sexMatch) {
        console.log("Sex filtration failed");
        return false;
      }
    } else if (this.userFilter.selectedSex.some((val) => val === 1)) {
      return false;
    }

    if (peer.searching !== undefined) {
      const minLength = Math.min(peer.searching.length, this.userFilter.selectedSearching.length);
      let searchingMatch = false;
      for (let i = 0; i < minLength; i++) {
        if (peer.searching[i] === 1 && this.userFilter.selectedSearching[i] === 1) {
          searchingMatch = true;
          break;
        }
      }
      if (!searchingMatch) {
        console.log("Searching type filtration failed");
        return false;
      }
    }

    // if (
    //   peer.latitude !== undefined &&
    //   peer.longitude !== undefined &&
    //   this.profileRef.latitude !== undefined &&
    //   this.profileRef.longitude !== undefined
    // ) {
    //   const distance = calculateGeoDistance(
    //     this.profileRef.latitude,
    //     this.profileRef.longitude,
    //     peer.latitude,
    //     peer.longitude
    //   );
    //   if (distance > this.userFilter.distanceRange) {
    //     return false;
    //   }
    // } else {
    //   return false;
    // }

    return true;
  }

  private requestProfileFromPeer = async (peerId: string): Promise<Profile | null> => {
    if (this.requestedProfiles.has(peerId)) {
      console.log(`Profile request for peer ${peerId} already in progress`);
      return null;
    }

    this.requestedProfiles.add(peerId);

    try {
      let profileDataChannel = this.connectionsRef.get(peerId)?.createDataChannel('profile');
      if (!profileDataChannel) {
        console.warn(`No peer connection for peer ${peerId}, falling back to chat channel`);
        throw new Error(`No peer connection for peer ${peerId} to open profile datachannel`);
      }

      // Wait for the data channel to open
      const waitForOpen = (dataChannel: RTCDataChannel, timeoutMs: number): Promise<void> => {
        return new Promise((resolve, reject) => {
          if (dataChannel.readyState === 'open') {
            resolve();
            return;
          }

          const timeout = setTimeout(() => {
            reject(new Error(`Data channel for peer ${peerId} failed to open within ${timeoutMs}ms`));
          }, timeoutMs);

          dataChannel.onopen = () => {
            clearTimeout(timeout);
            resolve();
          };

          dataChannel.onerror = (error) => {
            clearTimeout(timeout);
            reject(new Error(`Data channel error for peer ${peerId}: ${error}`));
          };
        });
      };

      await waitForOpen(profileDataChannel, 5000);

      // Set up profile reception logic
      let receivedChunks: string[] = [];
      const profilePromise = new Promise<Profile>((resolve, reject) => {
        const responseTimeout = setTimeout(() => {
          reject(new Error(`Profile response timeout for peer ${peerId}`));
        }, 10000); // 10s for profile response

        profileDataChannel.onmessage = (event: MessageEvent) => {
          const data = event.data;
          console.log("receiving message...")
          if (data === 'EOF') {
            console.log("Message received")
            try {
              const message = JSON.parse(receivedChunks.join('')) as ProfileMessage;
              clearTimeout(responseTimeout);
              this.updatePeerProfile(peerId, message.profile); // debug page
              resolve(message.profile);
              receivedChunks = [];
            } catch (error) {
              clearTimeout(responseTimeout);
              reject(new Error(`Failed to parse profile for peer ${peerId}: ${error}`));
            }
          } else {
            receivedChunks.push(data);
          }
        };

        profileDataChannel.onerror = (error) => {
          clearTimeout(responseTimeout);
          reject(new Error(`Data channel error during profile reception for peer ${peerId}: ${error}`));
        };

        profileDataChannel.onclose = () => {
          clearTimeout(responseTimeout);
          reject(new Error(`Data channel closed for peer ${peerId}`));
        };
      });

      // Send the profile request
      profileDataChannel.send('request_profile');
      console.log(`Sent profile request to peer ${peerId}`);

      // Await the profile
      const profile = await profilePromise;

      // Update peer profile in the database
      await updateUser(peerId, profile);

      return profile;

    } catch (error) {
      console.error(`Failed to request profile from peer ${peerId}:`, error);
      this.removePeerFromProfilesToDisplay(peerId);
      this.requestedProfiles.delete(peerId);
      return null;
    } finally {
      this.requestedProfiles.delete(peerId); // Ensure cleanup
    }
  };

  private removePeerFromProfilesToDisplay(peerId: string) {
    this.setProfilesToDisplay((prev) => {
      const index = prev.findIndex((p) => p.peerId === peerId);
      if (index >= this.currentSwiperIndex) {
        return prev.filter((p) => p.peerId !== peerId);
      }
      return prev;
    });
  }

  private getClosestOpenPEXDataChannel(): RTCDataChannel | null {
    const openChannels = Array.from(this.pexDataChannelsRef).filter(
      ([_, channel]) => channel.readyState === "open"
    );

    const peerIds = openChannels.map(([peerId]) => peerId);

    this.dhtRef.getBuckets().sortClosestToSelf(peerIds);

    if (openChannels.length === 0) {
      return null;
    }

    return openChannels[0]?.[1] || null;
  }

  private getRandomOpenDataChannel(): RTCDataChannel | null {
    const openChannels = Array.from(this.pexDataChannelsRef.values()).filter(
      (channel) => channel.readyState === "open"
    );
    if (openChannels.length === 0) {
      return null;
    }
    const randomIndex = Math.floor(Math.random() * openChannels.length);
    return openChannels[randomIndex];
  }

  private async tryToRestoreDHTConnections(peersToConnect: number): Promise<void> {
    try {
      const nodesInBuckets = this.dhtRef.getBuckets().all() as Node[];
      const nodeId = this.dhtRef.getNodeId();

      let peersAttempted = 0;
      for (const peer of nodesInBuckets) {
        if (peersAttempted > peersToConnect) {
          break;
        }
        if (peer.id !== nodeId && !this.connectionsRef.has(peer.id)) {
          const peerDTO: PeerDTO = {
            peerId: peer.id,
            publicKey: (await fetchUserFromDB(peer.id))?.publicKey!
          };

          console.log(`Attempting connection to peer ${peer.id}`);
          await this.initiateConnection(peerDTO, null, true); // Use DHT for signaling
          peersAttempted++;

        }
      }
    } catch (err) {
      console.log(err)
    }
  }

  private requestPeersViaPEX(peersNeeded: number): void {
    const dataChannel = this.getRandomOpenDataChannel();
    if (dataChannel) {
      console.log(`Requesting ${peersNeeded} additional peers via PEX`);
      try {
        sendPEXRequest(dataChannel, peersNeeded);
      } catch (error) {
        console.error("Failed to send PEX request:", error);
      }
    } else {
      console.warn("No open PEX data channels available to send request");
    }
  }

  private updatePeerProfile = async (peerId: string, profile: Profile): Promise<void> => {
      this.setPeers((prevPeers) => prevPeers.map((peer) => (peer.id === peerId ? { ...peer, profile } : peer)));
      console.log(profile.interests);
      const updates: Partial<Omit<User, 'peerId' | 'publicKey'>> = {
        name: profile.name,
        profilePic: profile.profilePic,
        birthDay: profile.birthDay,
        birthMonth: profile.birthMonth,
        birthYear: profile.birthYear,
        description: profile.description,
        sex: profile.sex,
        interests: profile.interests,
        searching: profile.searching,
        latitude: profile.latitude,
        longitude: profile.longitude,
      };
  
      await updateUser(peerId, updates);
    };
  
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));