import { Socket } from "socket.io-client";
import {
  RTCPeerConnection,
  RTCDataChannel,
  RTCSessionDescription,
} from "react-native-webrtc";
import DHT from "@/contexts/dht/dht";

export interface Profile {
  name: string;
  profilePic: string;
  publicKey: string;
  peerId: string;
  birthDay?: number;
  birthMonth?: number;
  birthYear?: number;
  description?: string;
  sex?: number[];
  interestSex?: number[];
  interests?: number[];
  searching?: number[];
  additionalPics?: string[];
}

export interface TemporaryProfile {
  name?: string;
  profilePic?: string;
  publicKey?: string; // No needed for creating profile
  peerId?: string; // No needed for creating profile
  birthDay?: number;
  birthMonth?: number;
  birthYear?: number;
  description?: string;
  sex?: number[];
  interestSex?: number[];
  interests?: number[];
  searching?: number[];
  additionalPics?: string[];
}

export interface Peer {
  id: string;
  status: string;
  profile?: Profile;
}

export interface MessageData {
  timestamp: number;
  senderId: string;
  message: string;
  id: string;
}

export type WebSocketMessageBase = {
  from: string;
  target: string | "all";
};

export type OfferMessage = WebSocketMessageBase & {
  offer: RTCSessionDescription;
};

export type AnswerMessage = WebSocketMessageBase & {
  answer: RTCSessionDescription;
};

export type CandidateMessage = WebSocketMessageBase & {
  candidate: RTCIceCandidateInit;
};

export type ConnectionsMessage = WebSocketMessageBase & {
  payload: {
    connections: { peerId: string }[];
  };
};

export type BroadcastMessage = WebSocketMessageBase & {
  target: "all";
  payload: {
    action: "close";
  };
};

export type WebSocketMessage =
  | OfferMessage
  | AnswerMessage
  | CandidateMessage
  | ConnectionsMessage
  | BroadcastMessage;

export type ReadyMessage = {
  peerId: string;
  type: string;
};

export type PEXRequest = {
  type: "request";
  maxNumberOfPeers: number;
};

export type PEXAdvertisement = {
  type: "advertisement";
  peers: string[];
};

export type PEXMessage = PEXRequest | PEXAdvertisement;

export type ProfileMessage = {
  type: "profile";
  profile: Profile;
};

export interface WebRTCContextValue {
  peers: Peer[];
  setPeers: React.Dispatch<React.SetStateAction<Peer[]>>;
  profile: Promise<Profile>;
  setProfile: React.Dispatch<React.SetStateAction<Promise<Profile>>>;
  peerIdRef: React.MutableRefObject<string | null>;
  socket: Socket | null;
  connectionsRef: React.MutableRefObject<Map<string, RTCPeerConnection>>,
  chatDataChannels: Map<string, RTCDataChannel>;
  createPeerConnection: (
    peerId: string,
    signalingDataChannel?: RTCDataChannel | null
  ) => RTCPeerConnection;
  updatePeerStatus: (peerId: string, status: string) => void;
  updatePeerProfile: (peerId: string, profile: any) => void;
  initiateConnection: (
    peerId: string,
    dataChannelUsedForSignaling?: RTCDataChannel | null
  ) => Promise<void>;
  sendMessageChatToPeer: (
    peerId: string,
    message: string,
    peerPublicKey: string
  ) => void;
  disconnectFromWebSocket: () => void;
  chatMessagesRef: React.MutableRefObject<Map<string, MessageData[]>>;
  notifyChat: number;
  closePeerConnection: (peerId: string) => void;
  dhtRef: React.MutableRefObject<DHT | null>;
}
