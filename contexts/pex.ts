import { RTCDataChannel, RTCPeerConnection } from "react-native-webrtc";
import { MessageEvent } from "react-native-webrtc";
import { ConnectionManager } from "./connection-manger";
import { PEXMessage, PEXRequest, PEXAdvertisement, PeerDTO } from "../types/types";
import { fetchUserFromDB } from "./db/userdb";
import { convertUserToPeerDTO } from "./utils/peerdto-utils";

export const handlePEXMessages = (
  event: MessageEvent,
  pexDataChannel: RTCDataChannel,
  connections: Map<string, RTCPeerConnection>,
  connectionManager: ConnectionManager,
  signalingDataChannel: RTCDataChannel | null
): void => {
  console.log("Received pex message:", event);
  try {
    const message = JSON.parse(event.data) as PEXMessage;
    if (message.type === "request") {
      if (!connections || !(connections instanceof Map)) {
        console.error("Invalid connections Map in handlePEXMessages");
        return;
      }
      shareConnectedPeers(pexDataChannel, message, connections);
    } else if (message.type === "advertisement") {
      const receivedPeers: PeerDTO[] = message.peers;
      connectionManager.handleNewPeers(receivedPeers, signalingDataChannel);
    }
  } catch (error) {
    console.error("Error handling PEX request:", error);
  }
};

export const sendPEXRequest = (pexDataChannel: RTCDataChannel, requestedPeersNum: number): void => {
  console.log("Sending PEX request");
  const requestMessage: PEXRequest = {
    type: "request",
    maxNumberOfPeers: requestedPeersNum,
  };

  try {
    if (pexDataChannel.readyState !== "open") {
      throw new Error("PEX data channel is not open");
    }
    pexDataChannel.send(JSON.stringify(requestMessage));
  } catch (error) {
    console.error("Couldn’t send PEX request:", error);
  }
};

const shareConnectedPeers = async (
  pexDataChannel: RTCDataChannel,
  message: PEXRequest,
  connections: Map<string, RTCPeerConnection>
): Promise<void> => {
  const maxNumberOfPeers = message.maxNumberOfPeers;
  const peersToShare = new Set<PeerDTO>();

  try {
    if (!connections || !(connections instanceof Map)) {
      console.error("Invalid connections Map in shareConnectedPeers");
      return;
    }

    if (connections.size !== 0) {
      let count = 0;
      for (const peerId of connections.keys()) {
        if (maxNumberOfPeers !== undefined && count >= maxNumberOfPeers) {
          break;
        }
        const iceConnectionState = connections.get(peerId)?.iceConnectionState;
        if (iceConnectionState === "connected" || iceConnectionState === "completed") {
          const user = await fetchUserFromDB(peerId);
          const peerDto = convertUserToPeerDTO(user);
          if (peerDto) {
            peersToShare.add(peerDto);
            count++;
          }
        }
      }
    }

    const answer: PEXAdvertisement = {
      type: "advertisement",
      peers: Array.from(peersToShare),
    };

    if (pexDataChannel.readyState !== "open") {
      console.warn("PEX data channel is not open, cannot send advertisement");
      return;
    }
    pexDataChannel.send(JSON.stringify(answer));
  } catch (err) {
    console.error("Error in shareConnectedPeers:", err);
  }
};