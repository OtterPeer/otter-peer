import {
  RTCPeerConnection,
  RTCDataChannel,
  MessageEvent,
} from "react-native-webrtc";
import { PEXMessage, PEXRequest, PEXAdvertisement, PeerDTO } from "../types/types";
import { fetchUserFromDB } from "./db/userdb";
import { ConnectionManager } from "./connection-manger";

export const handlePEXMessages = (
  event: MessageEvent,
  pexDataChannel: RTCDataChannel,
  connections: Map<string, RTCPeerConnection>,
  connectionManager: ConnectionManager,
  signalingDataChannel: RTCDataChannel | null
): void => {
  console.log("Received pex message:");
  console.log(event);
  try {
    const message = JSON.parse(event.data) as PEXMessage;
    if (message.type === "request") {
      console.log(connections)
      shareConnectedPeers(pexDataChannel, message, connections);
    } else if (message.type === "advertisement") {
      const receivedPeers: PeerDTO[] = message.peers;
      connectionManager.handlePEXAdvertisement(receivedPeers, signalingDataChannel);
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
    pexDataChannel.send(JSON.stringify(requestMessage));
  } catch (error) {
    console.log("Couldn’t send pex request: " + error);
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
    if (connections.size !== 0) {
      let count = 0;
      for (const peerId of connections.keys()) {
        if (maxNumberOfPeers !== undefined && count >= maxNumberOfPeers) {
          break;
        }
        const iceCandidatesState = connections.get(peerId)?.iceConnectionState;
        if (iceCandidatesState === "connected" || iceCandidatesState === "completed") {
          const user = await fetchUserFromDB(peerId);
          const publicKey = user?.publicKey!;
          peersToShare.add({ peerId, publicKey });
          count++;
        } 
      }
    }
  } catch (err) {
    console.error(err);
  }

  const answer: PEXAdvertisement = {
    type: "advertisement",
    peers: Array.from(peersToShare),
  };
  pexDataChannel.send(JSON.stringify(answer));
};
