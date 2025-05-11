import { RTCDataChannel, RTCPeerConnection } from "react-native-webrtc";
import { sendPEXRequest } from "./pex";
import DHT from "./dht/dht";
import { PeerDTO, Profile, UserFilter } from "../types/types";
import { Node } from "./dht/webrtc-rpc";
import { fetchUserFromDB } from "./db/userdb";
import { calculateGeoDistance } from "./geolocation/geolocation";
import { calculateAge } from "./utils/user-utils";

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
  private setProfilesToDisplay: React.Dispatch<React.SetStateAction<Profile[]>>;

  constructor(
    connectionsRef: Map<string, RTCPeerConnection>,
    pexDataChannelsRef: Map<string, RTCDataChannel>,
    dhtRef: DHT,
    userFilter: UserFilter,
    profile: Profile,
    profilesToDisplay: Profile[],
    setProfilesToDisplay: React.Dispatch<React.SetStateAction<Profile[]>>,
    initiateConnection: (targetPeer: PeerDTO, dataChannelUsedForSignaling?: RTCDataChannel | null) => Promise<void>
  ) {
    this.profileRef = profile;
    this.connectionsRef = connectionsRef;
    this.pexDataChannelsRef = pexDataChannelsRef;
    this.dhtRef = dhtRef;
    this.userFilter = userFilter;
    this.profilesToDisplay = profilesToDisplay;
    this.initiateConnection = initiateConnection;
    this.setProfilesToDisplay = setProfilesToDisplay;
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
    this.filterPeersToDisplayFromConnections();
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
        const alreadyConnected = [...this.connectionsRef.keys()].some(
          (id) => id === peerDto.peerId
        );
        if (
          !tableOfPeers.includes(peerDto) &&
          !alreadyConnected &&
          peerDto.peerId !== this.dhtRef.getNodeId()
        ) {
          tableOfPeers.push(peerDto);
        }
      });
    }

    const filteredPeer = tableOfPeers.filter((peer) => this.filterPeer(peer));

    // todo: Apply priroty. Add peers to different lists depending on connections needed, e.g. peersToDisplay, connections
    filteredPeer.forEach((peerDto) => {
      this.initiateConnection(peerDto, signalingDataChannel, false);
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
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));