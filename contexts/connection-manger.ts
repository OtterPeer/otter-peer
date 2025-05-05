import { RTCDataChannel, RTCPeerConnection } from "react-native-webrtc";
import { sendPEXRequest } from "./pex";

export class ConnectionManager {
  private minPeers: number = 20;
  private checkInterval: number = 20 * 1000; // 20s
  private connectionsRef: Map<string, RTCPeerConnection>;
  private pexDataChannelsRef: Map<string, RTCDataChannel>;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    connectionsRef: Map<string, RTCPeerConnection>,
    pexDataChannelsRef: Map<string, RTCDataChannel>
  ) {
    this.connectionsRef = connectionsRef;
    this.pexDataChannelsRef = pexDataChannelsRef;
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

  private checkPeerConnections(): void {
    const currentPeerCount = this.connectionsRef.size;
    console.log(`Current peer count: ${currentPeerCount}`);

    if (currentPeerCount < this.minPeers) {
      const peersNeeded = this.minPeers - currentPeerCount;
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
}