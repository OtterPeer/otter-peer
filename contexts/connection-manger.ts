import { RTCDataChannel, RTCPeerConnection } from "react-native-webrtc";
import { sendPEXRequest } from "./pex";
import DHT from "./dht/dht";
import { Peer, PeerDTO, Profile, ProfileMessage, SwipeLabel, UserFilter } from "../types/types";
import { Node } from "./dht/webrtc-rpc";
import { fetchUserFromDB, updateUser, User } from "./db/userdb";
import { calculateGeoDistance } from "./geolocation/geolocation";
import { calculateAge } from "./utils/user-utils";
import { convertProfileToPeerDTO, convertUserToPeerDTO } from "./utils/peerdto-utils";
import { sendData } from "./webrtcService";
import { MessageEvent } from "react-native-webrtc";
import { MutableRefObject } from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { predictModel, trainModel } from "./ai/knn";

export class ConnectionManager {
  private minConnections: number = 3;
  private checkInterval: number = 10 * 1000; // 10s for buffer checks
  private maxBufferSize: number = 6;//20?
  private minBufferSize: number = 3;//10?
  private swipeThreshold: number = 3; // Trigger ranking at 10th? swipe
  private profilesToAddAfterRanking: number = 3; // 9 best + 1 worst?
  private connectionsRef: Map<string, RTCPeerConnection>;
  private pexDataChannelsRef: Map<string, RTCDataChannel>;
  private dhtRef: DHT;
  private initiateConnection: (targetPeer: PeerDTO, dataChannelUsedForSignaling: RTCDataChannel | null, useDHTForSignaling: boolean) => Promise<void>;
  private intervalId: NodeJS.Timeout | null = null;
  private hasTriggeredInitialConnections: boolean = false;
  private userFilterRef: React.MutableRefObject<UserFilter>;
  private profilesToDisplayRef: MutableRefObject<Profile[]>;
  private displayedPeersRef: Set<string>;
  private setPeers: React.Dispatch<React.SetStateAction<Peer[]>>;
  private notifyProfilesChange: () => void;
  private requestedProfiles: Set<string> = new Set();
  private currentSwiperIndexRef: React.MutableRefObject<number>;
  private blockedPeersRef: React.MutableRefObject<Set<string>>;
  private filteredPeersReadyToDisplay: Set<PeerDTO> = new Set();
  private swipeLabels: SwipeLabel[] = []; // Store last 20 swipe actions

  constructor(
    connectionsRef: Map<string, RTCPeerConnection>,
    pexDataChannelsRef: Map<string, RTCDataChannel>,
    dhtRef: DHT,
    userFilterRef: React.MutableRefObject<UserFilter>,
    profilesToDisplayRef: MutableRefObject<Profile[]>,
    displayedPeersRef: Set<string>,
    currentSwiperIndexRef: React.MutableRefObject<number>,
    blockedPeersRef: React.MutableRefObject<Set<string>>,
    setPeers: React.Dispatch<React.SetStateAction<Peer[]>>,
    initiateConnection: (targetPeer: PeerDTO, dataChannelUsedForSignaling?: RTCDataChannel | null) => Promise<void>,
    notifyProfilesChange: () => void
  ) {
    this.connectionsRef = connectionsRef;
    this.pexDataChannelsRef = pexDataChannelsRef;
    this.dhtRef = dhtRef;
    this.userFilterRef = userFilterRef;
    this.blockedPeersRef = blockedPeersRef;
    this.displayedPeersRef = displayedPeersRef;
    this.currentSwiperIndexRef = currentSwiperIndexRef;
    this.profilesToDisplayRef = profilesToDisplayRef;
    this.initiateConnection = initiateConnection;
    this.setPeers = setPeers;
    this.notifyProfilesChange = notifyProfilesChange;
    this.loadSwipeLabels();
  }

  private async loadSwipeLabels(): Promise<void> {
    try {
      const swipeData = await AsyncStorage.getItem('@WebRTC:swipeLabels');
      if (swipeData) {
        this.swipeLabels = JSON.parse(swipeData) as SwipeLabel[];
      }
    } catch (error) {
      console.error('Error loading swipe labels:', error);
    }
  }

  private async saveSwipeLabels(): Promise<void> {
    try {
      await AsyncStorage.setItem('@WebRTC:swipeLabels', JSON.stringify(this.swipeLabels));
    } catch (error) {
      console.error('Error saving swipe labels:', error);
    }
  }

  public start(): void {
    if (this.intervalId) {
      console.warn("ConnectionManager is already running");
      return;
    }
    this.performInitialConnections();
    this.intervalId = setInterval(() => {
      this.checkNumberOfFilteredPeersReadyToDisplayAndFetch(); // commented for demo only
      this.checkBufferAndFillProfilesToDisplay();
    }, this.checkInterval);
    console.log("ConnectionManager started");
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("ConnectionManager stopped");
    }
  }

  public getBufferSize = (): number => {
    return this.profilesToDisplayRef.current.length - this.currentSwiperIndexRef.current;
  }

  private async performInitialConnections(): Promise<void> {
    if (this.hasTriggeredInitialConnections) {
      console.log("Initial PEX/DHT connections already triggered");
      return;
    }
    await delay(2000);
    console.log("Performing initial PEX request to closest peer known.");
    this.performPEXRequestToClosestPeer(this.minConnections);
    await delay(3000);
    console.log("Trying to restore DHT connections.");
    await this.tryToRestoreDHTConnections(this.dhtRef['k'] as number);
    this.rankAndAddPeers();
    this.hasTriggeredInitialConnections = true;
  }

  private performPEXRequestToClosestPeer(peersRequested: number): void {
    const dataChannel = this.getClosestOpenPEXDataChannel();
    if (dataChannel) {
      console.log(`Requesting ${peersRequested} additional peers via PEX`);
      try {
        sendPEXRequest(dataChannel, peersRequested);
      } catch (error) {
        console.error("Failed to send PEX request:", error);
      }
    } else {
      console.warn("No open PEX data channels available to send request");
    }
  }

  public logSwipeAction(peerId: string, x: number, y: number, action: 'right' | 'left'): void {
    const label: SwipeLabel = { x, y, label: action };
    this.swipeLabels.push(label);

    if (this.swipeLabels.length > 20) {
      this.swipeLabels.shift();
    }

    // Save swipe labels
    this.saveSwipeLabels();

    // Check if 10th swipe
    if ((this.currentSwiperIndexRef.current + 1) % this.swipeThreshold === 0) {
      this.rankAndAddPeers();
    }

    // Check buffer after swipe, refill if needed
    this.checkNumberOfFilteredPeersReadyToDisplayAndFetch();
    this.checkBufferAndFillProfilesToDisplay();
  }

  public closeConnectionWithPeer(peerId: string) {
    this.filteredPeersReadyToDisplay = new Set(
      Array.from(this.filteredPeersReadyToDisplay).filter((peerDto) => peerDto.peerId !== peerId)
    );

    for (let i = this.currentSwiperIndexRef.current; i < this.profilesToDisplayRef.current.length; i++) {
      const profile = this.profilesToDisplayRef.current[i];
      const peerDto = convertProfileToPeerDTO(profile);
      if (peerDto && !this.filterPeer(peerDto)) {
        this.removePeerFromProfilesToDisplay(peerDto.peerId);
        this.notifyProfilesChange();
      }
    }
  }

  private async rankAndAddPeers(): Promise<void> {
    const peersArray = Array.from(this.filteredPeersReadyToDisplay);
    if (peersArray.length === 0) {
      console.warn("No peers to rank, triggering PEX");
      this.performPEXRequestToRandomPeer(this.minConnections);
      return;
    }

    console.log("Triggering peers ranking from rankAndAddPeers()")
    const rankedPeers = await this.rankPeers(peersArray);

    const selectedPeers = rankedPeers.slice(0, this.profilesToAddAfterRanking - 1); // Top 9
    if (rankedPeers.length >= this.profilesToAddAfterRanking) {
      selectedPeers.push(rankedPeers[rankedPeers.length - 1]); // Bottom 1
    }

//     console.log("Peers selected by ranking:")
//     selectedPeers.forEach((item) => {
//         console.log(item.peerId);
//     });

    // Request profiles for selected peers
    let profilesAdded = 0;
    let index = 0;
    while (profilesAdded < this.profilesToAddAfterRanking && index < rankedPeers.length && this.getBufferSize() < this.maxBufferSize) {
      const peerDto = rankedPeers[index];
      if (!selectedPeers.includes(peerDto)) {
        selectedPeers.push(peerDto); // Add next best peer if needed
      }
      try {
        const profile = await this.requestProfileFromPeer(peerDto.peerId);
        if (profile) {
          if (this.addProfileToProfilesToDisplay(profile)) {
            this.filteredPeersReadyToDisplay.delete(peerDto);
            profilesAdded += 1;
          }
        }
      } catch (error) {
        console.error(`Failed to fetch profile for ${peerDto.peerId}:`, error);
      }
      index += 1;
    }

    // If fewer than 10 profiles added, trigger PEX
    if (profilesAdded < this.profilesToAddAfterRanking) {
      console.warn(`Only added ${profilesAdded} profiles, triggering PEX`);
      this.performPEXRequestToRandomPeer(this.minConnections);
    }
  }

  private async rankPeers(peers: PeerDTO[]): Promise<PeerDTO[]> {
    console.log("Ranking of peers triggered")
    try {
      const model = trainModel(this.swipeLabels);
      const peerIdRightScore = new Map<string, number>();
      for (const peer of peers) {
        if (peer.x === undefined || peer.y === undefined) {
          console.warn(`Peer ${peer.peerId} has invalid coordinates (x: ${peer.x}, y: ${peer.y}), assigning default score`);
          peerIdRightScore.set(peer.peerId, 0);
          continue;
        }

        const result = predictModel(model, { x: peer.x, y: peer.y });
        if (result.scores?.right === undefined) {
          console.warn(`No right score for peer ${peer.peerId}, assigning default score`);
          peerIdRightScore.set(peer.peerId, 0);
          continue;
        }

        peerIdRightScore.set(peer.peerId, result.scores.right);
      }

    // Log scores for debugging
    console.log('Peer scores:', Object.fromEntries(peerIdRightScore));

    // Sort peers in descending order (higher right score = better rank)
    const sortedPeers = [...peers].sort((a, b) => {
      const scoreA = peerIdRightScore.get(a.peerId) ?? 0;
      const scoreB = peerIdRightScore.get(b.peerId) ?? 0;
      return scoreB - scoreA; // Descending order
    });

    console.log('Sorted peers:', sortedPeers.map(p => ({
      peerId: p.peerId,
      score: peerIdRightScore.get(p.peerId) ?? 0
    })));


    console.log('Sorted peers:', sortedPeers.map(p => p.peerId));
    return sortedPeers;

    } catch (err) {
      console.error(err);
    }
    console.log("Failover to random ranking");
    return peers.sort(() => Math.random() - 0.5);
  }

  private async checkNumberOfFilteredPeersReadyToDisplayAndFetch(): Promise<void> {
    if (this.filteredPeersReadyToDisplay.size > this.profilesToAddAfterRanking) {
      return; // there are available peers for next recommendation iteration
    }

    const peersNeededInFilteredPeers = this.profilesToAddAfterRanking - this.filteredPeersReadyToDisplay.size;

    const peersToRequest = peersNeededInFilteredPeers * 4; // Request extra for filtering
    console.log(`Requesting ${peersToRequest} peers via PEX`);
    this.performPEXRequestToRandomPeer(peersToRequest);
  }

  private async checkBufferAndFillProfilesToDisplay(): Promise<void> {
    const availableProfiles = this.profilesToDisplayRef.current.length - this.currentSwiperIndexRef.current;
    console.log(`Available profiles: ${availableProfiles}`);

    if (availableProfiles >= this.minBufferSize) {
      return; // Buffer exists
    }

    const profilesNeededInProfilesToDisplay = this.minBufferSize - availableProfiles;
    console.log(`Need ${profilesNeededInProfilesToDisplay} more profiles`);
    console.log(`Triggering peers ranking from checkBufferAndFillProfilesToDisplay: ${this.filteredPeersReadyToDisplay.size > profilesNeededInProfilesToDisplay}`);

    // Use there are more filtered peers ready to display than neeeded use AI
    let peersToFetch: PeerDTO[];
    if (this.filteredPeersReadyToDisplay.size > profilesNeededInProfilesToDisplay) {
      const rankedPeers = await this.rankPeers(Array.from(this.filteredPeersReadyToDisplay));
      peersToFetch = rankedPeers
        .filter((peer) => !this.profilesToDisplayRef.current.some((p) => p.peerId === peer.peerId))
        .slice(0, profilesNeededInProfilesToDisplay);
    } else {
      peersToFetch = Array.from(this.filteredPeersReadyToDisplay)
        .filter((peer) => !this.profilesToDisplayRef.current.some((p) => p.peerId === peer.peerId))
        .slice(0, profilesNeededInProfilesToDisplay);
    }

    console.log("Peers to fetch profiles from:")
    console.log(peersToFetch)

    for (const peerDto of peersToFetch) {
      try {
        const profile = await this.requestProfileFromPeer(peerDto.peerId);
        if (profile) {
          if (this.addProfileToProfilesToDisplay(profile)) {
            this.filteredPeersReadyToDisplay.delete(peerDto);
          }
        }
      } catch (error) {
        console.error(`Failed to fetch profile for ${peerDto.peerId}:`, error);
      }
    }
  }

  private performPEXRequestToRandomPeer(peersRequested: number): void {
    const dataChannel = this.getRandomOpenDataChannel();
    if (dataChannel) {
      console.log(`Requesting ${peersRequested} additional peers via PEX to randome peer`);
      try {
        sendPEXRequest(dataChannel, peersRequested);
      } catch (error) {
        console.error("Failed to send PEX request:", error);
      }
    } else {
      console.warn("No open PEX data channels available to send request");
    }
  }

  public async triggerFilteringAndPeerDTOFetch(peerId: string): Promise<void> {
    let peerDto: PeerDTO | null;
    const user = await fetchUserFromDB(peerId);
    peerDto = convertUserToPeerDTO(user);
    if (!peerDto) {
      console.log("Requesting PeerDTO from peer " + peerId);
      peerDto = await this.requestPeerDTOFromPeer(peerId);
    }
    if (peerDto && this.filterPeer(peerDto)) {
      this.filteredPeersReadyToDisplay.add(peerDto);
      await this.checkBufferAndFillProfilesToDisplay();
    }
  }

  private addProfileToProfilesToDisplay(profile: Profile): boolean {
    if (!this.profilesToDisplayRef.current.some((p) => p.peerId === profile.peerId) && this.getBufferSize() < this.maxBufferSize) {
      this.profilesToDisplayRef.current.push(profile);
      this.notifyProfilesChange();
      console.log("Added profile to profilesToDisplayRef:", profile.peerId);
      return true;
    } else {
      return false;
    }
  }

  public async triggerFiltersChange(): Promise<void> {
    this.filteredPeersReadyToDisplay = new Set(
      Array.from(this.filteredPeersReadyToDisplay).filter((peerDto) => this.filterPeer(peerDto))
    );

    for (let i = this.currentSwiperIndexRef.current; i < this.profilesToDisplayRef.current.length; i++) {
      const profile = this.profilesToDisplayRef.current[i];
      const peerDto = convertProfileToPeerDTO(profile);
      if (peerDto && !this.filterPeer(peerDto)) {
        this.removePeerFromProfilesToDisplay(peerDto.peerId);
        this.notifyProfilesChange();
      }
    }

    for (const peerId of [...this.connectionsRef.keys()]) {
      const user = await fetchUserFromDB(peerId);
      const peerDto = convertUserToPeerDTO(user);
      if (peerDto && this.filterPeer(peerDto)) {
        this.filteredPeersReadyToDisplay.add(peerDto);
      }
    }

    await this.checkBufferAndFillProfilesToDisplay();
  }

  public handleNewPeers(receivedPeers: PeerDTO[], signalingDataChannel: RTCDataChannel | null) {
    // receivedPeers = receivedPeers.slice(0, 4);// demo only
    const tableOfPeers: PeerDTO[] = [];
    if (Array.isArray(receivedPeers)) {
      receivedPeers.forEach((peerDto) => {
        const alreadyConnected = this.connectionsRef.has(peerDto.peerId);
        if (
          !tableOfPeers.includes(peerDto) &&
          !alreadyConnected &&
          peerDto.peerId !== this.dhtRef.getNodeId() &&
          !this.blockedPeersRef.current.has(peerDto.peerId)
        ) {
          tableOfPeers.push(peerDto);
        }
      });
    }
    console.log(tableOfPeers);
    const filteredPeers = tableOfPeers.filter((peer) => this.filterPeer(peer));
    filteredPeers.forEach((peerDto) => {
      this.filteredPeersReadyToDisplay.add(peerDto);
      this.initiateConnection(peerDto, signalingDataChannel, false);
    });
    // connect to peers that are not meant to be displayed just to keep minConnections
    if (this.connectionsRef.size < this.minConnections) {
      const peersNeeded = this.minConnections - this.connectionsRef.size;
      const unconnectedPeers = tableOfPeers.filter(
        (peer) =>
          !filteredPeers.some((filteredPeer) => filteredPeer.peerId === peer.peerId) &&
          !this.connectionsRef.has(peer.peerId)
      );
      for (let i = 0; i < peersNeeded && i < unconnectedPeers.length; i++) {
        this.initiateConnection(unconnectedPeers[i], signalingDataChannel, false);
      }
    }
    this.checkBufferAndFillProfilesToDisplay();
  }

  private filterPeer(peer: PeerDTO) {
    if (this.displayedPeersRef.has(peer.peerId)) {
      console.log("Filtration failed: Peer already displayed to the user.");
      return false;
    }
    if (!peer.age || peer.age < this.userFilterRef.current.ageRange[0] || peer.age > this.userFilterRef.current.ageRange[1]) {
      console.log("Age filtration failed");
      return false;
    }
    if (peer.sex !== undefined) {
      const minLength = Math.min(peer.sex.length, this.userFilterRef.current.selectedSex.length);
      let sexMatch = false;
      for (let i = 0; i < minLength; i++) {
        if (peer.sex[i] === 1 && this.userFilterRef.current.selectedSex[i] === 1) {
          sexMatch = true;
          break;
        }
      }
      if (!sexMatch) {
        console.log("Sex filtration failed");
        return false;
      }
    } else if (this.userFilterRef.current.selectedSex.some((val) => val === 1)) {
      return false;
    }
    if (peer.searching !== undefined) {
      const minLength = Math.min(peer.searching.length, this.userFilterRef.current.selectedSearching.length);
      let searchingMatch = false;
      for (let i = 0; i < minLength; i++) {
        if (peer.searching[i] === 1 && this.userFilterRef.current.selectedSearching[i] === 1) {
          searchingMatch = true;
          break;
        }
      }
      if (!searchingMatch) {
        console.log("Searching type filtration failed");
        return false;
      }
    }
    return true;
  }

  private requestPeerDTOFromPeer = async (peerId: string, retries: number = 5, backoffMs: number = 1000): Promise<PeerDTO | null> => {
    if (this.requestedProfiles.has(peerId)) {
      console.log(`PeerDTO request for peer ${peerId} already in progress`);
      return null;
    }
    this.requestedProfiles.add(peerId);
    const tryRequest = async (attempt: number): Promise<PeerDTO | null> => {
      try {
        const peerConnection = this.connectionsRef.get(peerId);
        if (!peerConnection) {
          throw new Error(`No peer connection for peer ${peerId}`);
        }
        if (!["connected", "completed"].includes(peerConnection.iceConnectionState)) {
          throw new Error(`Peer connection for ${peerId} is not stable: ${peerConnection.iceConnectionState}`);
        }
        let peerDTODataChannel = peerConnection.createDataChannel('peer_dto');
        if (!peerDTODataChannel) {
          console.warn(`No peer connection for peer ${peerId}, falling back to chat channel`);
          throw new Error(`No peer connection for peer ${peerId} to open profile datachannel`);
        }
        const waitForOpen = (dataChannel: RTCDataChannel, timeoutMs: number): Promise<void> => {
          return new Promise((resolve, reject) => {
            if (dataChannel.readyState === "open") {
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
        await waitForOpen(peerDTODataChannel, 7000);
        await delay(1000);
        const peerDtoPromise = new Promise<PeerDTO>((resolve, reject) => {
          const responseTimeout = setTimeout(() => {
            reject(new Error(`PeerDTO response timeout for peer ${peerId}`));
          }, 15000);
          peerDTODataChannel.onmessage = (event: MessageEvent) => {
            const data = event.data;
            try {
              console.log("Received peerDTO response:", data);
              const peerDto = JSON.parse(data) as PeerDTO;
              clearTimeout(responseTimeout);
              resolve(peerDto);
            } catch (error) {
              clearTimeout(responseTimeout);
              reject(new Error(`Failed to parse PeerDTO for peer ${peerId}: ${error}`));
            }
          };
          peerDTODataChannel.onerror = (error) => {
            clearTimeout(responseTimeout);
            reject(new Error(`Data channel error during PeerDTO reception for peer ${peerId}: ${error}`));
          };
          peerDTODataChannel.onclose = () => {
            clearTimeout(responseTimeout);
            reject(new Error(`Data channel closed for peer ${peerId}`));
          };
        });
        peerDTODataChannel.send("request_peer_dto");
        console.log(`Sent PeerDTO request to peer ${peerId} (attempt ${attempt})`);
        const peerDto = await peerDtoPromise;
        await updateUser(peerId, peerDto);
        return peerDto;
      } catch (error) {
        console.error(`Attempt ${attempt} failed for peer ${peerId}:`, error);
        if (attempt < retries) {
          const delayMs = backoffMs * Math.pow(2, attempt);
          console.log(`Retrying PeerDTO request for ${peerId} after ${delayMs}ms`);
          await delay(delayMs);
          return tryRequest(attempt + 1);
        }
        throw error;
      }
    };
    try {
      const peerDto = await tryRequest(1);
      return peerDto;
    } catch (error) {
      console.error(`Failed to request PeerDTO from peer ${peerId} after ${retries} attempts:`, error);
      this.connectionsRef.get(peerId)?.close();
      return null;
    } finally {
      this.requestedProfiles.delete(peerId);
    }
  };

  private requestProfileFromPeer = async (peerId: string, retries: number = 5, backoffMs: number = 1000): Promise<Profile | null> => {
    if (this.requestedProfiles.has(peerId)) {
      console.log(`Profile request for peer ${peerId} already in progress`);
      return null;
    }
    this.requestedProfiles.add(peerId);
    const tryRequest = async (attempt: number): Promise<Profile | null> => {
      try {
        const peerConnection = this.connectionsRef.get(peerId);
        if (!peerConnection) {
          throw new Error(`No peer connection for peer ${peerId}`);
        }
        if (!["connected", "completed"].includes(peerConnection.iceConnectionState)) {
          throw new Error(`Peer connection for ${peerId} is not stable: ${peerConnection.iceConnectionState}`);
        }
        let profileDataChannel = peerConnection.createDataChannel('profile');
        if (!profileDataChannel) {
          console.warn(`No peer connection for peer ${peerId}`);
          throw new Error(`No peer connection for peer ${peerId} to open profile datachannel`);
        }
        const waitForOpen = (dataChannel: RTCDataChannel, timeoutMs: number): Promise<void> => {
          return new Promise((resolve, reject) => {
            if (dataChannel.readyState === "open") {
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
        await waitForOpen(profileDataChannel, 7000);
        let receivedChunks: string[] = [];
        const profilePromise = new Promise<Profile>((resolve, reject) => {
          const responseTimeout = setTimeout(() => {
            reject(new Error(`Profile response timeout for peer ${peerId}`));
          }, 10000);
          profileDataChannel.onmessage = (event: MessageEvent) => {
            const data = event.data;
            console.log("Receiving message for profile...");
            if (data === "request_profile") {
              // Handled in WebRTCContext.tsx - ignore
            } else if (data === "EOF") {
              console.log("Message received");
              try {
                const message = JSON.parse(receivedChunks.join("")) as ProfileMessage;
                clearTimeout(responseTimeout);
                this.updatePeerProfile(peerId, message.profile);
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
        await delay(1000);
        profileDataChannel.send("request_profile");
        console.log(`Sent profile request to peer ${peerId} (attempt ${attempt})`);
        const profile = await profilePromise;
        await updateUser(peerId, profile);
        return profile;
      } catch (error) {
        console.error(`Attempt ${attempt} failed for peer ${peerId}:`, error);
        if (attempt < retries) {
          const delayMs = backoffMs * Math.pow(2, attempt);
          console.log(`Retrying profile request for ${peerId} after ${delayMs}ms`);
          await delay(delayMs);
          return tryRequest(attempt + 1);
        }
        throw error;
      }
    };
    try {
      const profile = await tryRequest(1);
      return profile;
    } catch (error) {
      console.error(`Failed to request profile from peer ${peerId} after ${retries} attempts:`, error);
      this.removePeerFromProfilesToDisplay(peerId);
      this.filteredPeersReadyToDisplay = new Set(
        Array.from(this.filteredPeersReadyToDisplay).filter((peerDto) => peerDto.peerId !== peerId)
      );
      this.connectionsRef.get(peerId)?.close();
      return null;
    } finally {
      this.requestedProfiles.delete(peerId);
    }
  };

  private removePeerFromProfilesToDisplay(peerId: string) {
    const index = this.profilesToDisplayRef.current.findIndex((p) => p.peerId === peerId);
    if (index >= this.currentSwiperIndexRef.current) {
      this.profilesToDisplayRef.current.splice(index, 1);
      this.notifyProfilesChange();
      console.log("Removed profile from profilesToDisplayRef:", peerId);
    }
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
          await this.initiateConnection(peerDTO, null, true);
          peersAttempted++;
        }
      }
    } catch (err) {
      console.log(err);
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