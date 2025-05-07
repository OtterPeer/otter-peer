import { RTCDataChannel, RTCPeerConnection } from "react-native-webrtc";
import { sendPEXRequest } from "./pex";
import DHT from "./dht/dht";
import { PeerDTO } from "../types/types";
import { Node } from "./dht/webrtc-rpc";
import { fetchUserFromDB } from "./db/userdb";

export class ConnectionManager {
  private minPeers: number = 20;
  private checkInterval: number = 20 * 1000; // 20s
  private connectionsRef: Map<string, RTCPeerConnection>;
  private pexDataChannelsRef: Map<string, RTCDataChannel>;
  private dhtRef: DHT;
  private initiateConnection: (targetPeer: PeerDTO, dataChannelUsedForSignaling: RTCDataChannel | null, useDHTForSignaling: boolean) => Promise<void>;
  private intervalId: NodeJS.Timeout | null = null;
  private hasTriggeredInitialConnections: boolean = false;

  constructor(
    connectionsRef: Map<string, RTCPeerConnection>,
    pexDataChannelsRef: Map<string, RTCDataChannel>,
    dhtRef: DHT,
    initiateConnection: (targetPeer: PeerDTO, dataChannelUsedForSignaling?: RTCDataChannel | null) => Promise<void>
  ) {
    this.connectionsRef = connectionsRef;
    this.pexDataChannelsRef = pexDataChannelsRef;
    this.dhtRef = dhtRef;
    this.initiateConnection = initiateConnection;
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

  public triggerConnectionsStateChange(): void {
    // this.checkPeerConnections();
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

      // todo: Apply filtering and priroty. Add peers to different lists depending on connections needed.
      tableOfPeers.forEach((peerDto) => {
        this.initiateConnection(peerDto, signalingDataChannel, false);
      });
  }

  private async performInitialConnections(): Promise<void> {
    if (this.hasTriggeredInitialConnections) {
      console.log("Initial PEX/DHT connections already triggered");
      return;
    }

    // Perform PEX request to closest peer
    await delay(2000);
    console.log("Performing initial PEX request to closests peer known.")
    this.performPEXRequestToClosestPeer(this.minPeers);

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
    } catch(err) {
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