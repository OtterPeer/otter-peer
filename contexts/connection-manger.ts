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

    this.checkPeerConnections();
    this.intervalId = setInterval(() => {
      this.checkPeerConnections();
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

  private async checkPeerConnections(): Promise<void> {
    const currentPeerCount = this.connectionsRef.size;
    console.log(`Current peer count: ${currentPeerCount}`);

    if (currentPeerCount >= this.minPeers) {
      console.log(`Minimum peer count (${this.minPeers}) already satisfied`);
      return;
    }

    const peersNeeded = this.minPeers - currentPeerCount;
    console.log(`Need ${peersNeeded} additional peers`);

    const availablePeers: Node[] = [];
    // Access the buckets directly (Node[][])
    try {
      const nodesInBuckets = this.dhtRef.getBuckets().all() as Node[];
      const nodeId = this.dhtRef.getNodeId();

      // Collect available peers from buckets, starting from bucket 0 (closest)
      
      for (const peer of nodesInBuckets) {
        if (peer.id !== nodeId && !this.connectionsRef.has(peer.id)) {
          availablePeers.push(peer);
        }
      }

      if (availablePeers.length === 0) {
        console.warn("No available peers in k-buckets; falling back to PEX");
        this.requestPeersViaPEX(peersNeeded);
        return;
      }
    } catch(err) {
      console.log(err)
    }
    

    console.log(`Found ${availablePeers.length} available peers in k-buckets`);

    // Attempt to connect to up to peersNeeded peers
    let peersAttempted = 0;
    for (const peer of availablePeers) {
      if (peersAttempted >= peersNeeded) {
        break;
      }

      const peerDTO: PeerDTO = {
        peerId: peer.id,
        publicKey: (await fetchUserFromDB(peer.id))?.publicKey!
      };

      console.log(`Attempting connection to peer ${peer.id}`);
      try {
        await this.initiateConnection(peerDTO, null, true); // Use DHT for signaling
        peersAttempted++;
      } catch (error) {
        console.error(`Failed to initiate connection to peer ${peer.id}:`, error);
        // Continue to the next peer
      }
    }

    console.log(`Attempted connections to ${peersAttempted} peers`);

    // If we couldn't attempt enough connections, fall back to PEX
    if (peersAttempted < peersNeeded) {
      console.log(`Could only attempt ${peersAttempted} of ${peersNeeded} needed peers; requesting via PEX`);
      // this.requestPeersViaPEX(peersNeeded - peersAttempted);
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