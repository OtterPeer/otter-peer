import {
  RTCPeerConnection,
  RTCDataChannel,
  MessageEvent,
} from "react-native-webrtc";
import { PEXMessage, PEXRequest, PEXAdvertisement } from "../types/types";

export const handlePEXMessages = (
  event: MessageEvent,
  pexDataChannel: RTCDataChannel,
  connections: { [key: string]: RTCPeerConnection },
  userPeerId: string,
  initiateConnection: (
    peerId: string,
    dataChannelUsedForSignaling: RTCDataChannel | null
  ) => Promise<void>,
  signalingDataChannel: RTCDataChannel | null
): void => {
  try {
    const message = JSON.parse(event.data) as PEXMessage;
    if (message.type === "request") {
      shareConnectedPeers(pexDataChannel, message, connections);
    } else if (message.type === "advertisement") {
      const receivedPeers: string[] = message.peers;
      const tableOfPeers: string[] = [];

      if (Array.isArray(receivedPeers)) {
        receivedPeers.forEach((peerId) => {
          const alreadyConnected = Object.keys(connections).some(
            (id) => id === peerId
          );
          if (
            !tableOfPeers.includes(peerId) &&
            !alreadyConnected &&
            peerId !== userPeerId
          ) {
            tableOfPeers.push(peerId);
          }
        });
      }

      tableOfPeers.forEach((peerId) => {
        initiateConnection(peerId, signalingDataChannel);
      });
    }
  } catch (error) {
    console.error("Error handling PEX request:", error);
  }
};

export const sendPEXRequest = (pexDataChannel: RTCDataChannel): void => {
  console.log("Sending PEX request");
  const requestMessage: PEXRequest = {
    type: "request",
    maxNumberOfPeers: 20,
  };

  try {
    pexDataChannel.send(JSON.stringify(requestMessage));
  } catch (error) {
    console.log("Couldn’t send pex request: " + error);
  }
};

const shareConnectedPeers = (
  pexDataChannel: RTCDataChannel,
  message: PEXRequest,
  connections: { [key: string]: RTCPeerConnection }
): void => {
  // TODO: read requested number of peers from PEXRequest
  const peersToShare = new Set<string>();
  if (Object.keys(connections).length !== 0) {
    Object.keys(connections).forEach((peerId) => {
      peersToShare.add(peerId);
    });
  }

  const answer: PEXAdvertisement = {
    type: "advertisement",
    peers: Array.from(peersToShare),
  };
  pexDataChannel.send(JSON.stringify(answer));
};
