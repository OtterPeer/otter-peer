import {
  RTCPeerConnection,
  RTCDataChannel,
  MessageEvent,
} from "react-native-webrtc";
import { PEXMessage, PEXRequest, PEXAdvertisement, PeerDTO } from "../types/types";
import { fetchUserFromDB } from "./db/userdb";

export const handlePEXMessages = (
  event: MessageEvent,
  pexDataChannel: RTCDataChannel,
  connections: Map<string, RTCPeerConnection>,
  userPeerId: string,
  initiateConnection: (
    peer: PeerDTO,
    dataChannelUsedForSignaling: RTCDataChannel | null
  ) => Promise<void>,
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
      const tableOfPeers: PeerDTO[] = [];

      if (Array.isArray(receivedPeers)) {
        receivedPeers.forEach((peerDto) => {
          const alreadyConnected = [...connections.keys()].some(
            (id) => id === peerDto.peerId
          );
          if (
            !tableOfPeers.includes(peerDto) &&
            !alreadyConnected &&
            peerDto.peerId !== userPeerId
          ) {
            tableOfPeers.push(peerDto);
          }
        });
      }

      tableOfPeers.forEach((peerDto) => {
        initiateConnection(peerDto, signalingDataChannel);
      });
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
        console.log(connections);
        console.log(maxNumberOfPeers);
        if (maxNumberOfPeers !== undefined && count >= maxNumberOfPeers) {
          break;
        }
        const user = await fetchUserFromDB(peerId);
        const publicKey = user?.publicKey!;
        peersToShare.add({ peerId, publicKey });
        count++;
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
