import { Socket } from "socket.io-client";
import {
  RTCPeerConnection,
  RTCDataChannel,
} from "react-native-webrtc";
import DHT from "@/contexts/dht/dht";

export interface Profile {
  name: string;
  profilePic: string;
  publicKey: string;
  peerId: string;
  x: number;
  y: number;
  latitude: number;
  longitude: number;
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
  x?: number;
  y?: number;
  latitude?: number;
  longitude?: number;
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

export interface userFiltration {
  sex?: number[];
  distance?: number;
  age?: number[];
  searching?: number[];
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
  id?: string;
  from: string;
  target: string | "all";
};

export type OfferMessage = WebSocketMessageBase & {
  encryptedOffer: string;
  publicKey: string;
  encryptedAesKey: string;
  encryptedAesKeySignature: string;
  iv: string;
  keyId: string;
  authTag: string;
};

export type AnswerMessage = WebSocketMessageBase & {
  encryptedAnswer: string;
  public_key: string;
  authTag: string;
};

export type SignalingMessage = WebSocketMessageBase & {
  encrypted_sdp: string;
  public_key: string;
};

export type CandidateMessage = WebSocketMessageBase & {
  candidate: RTCIceCandidateInit;
};

export type ConnectionsMessage = WebSocketMessageBase & {
  payload: {
    connections: PeerDTO[];
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
  peerDto: PeerDTO;
  type: string;
};

export type PEXRequest = {
  type: "request";
  maxNumberOfPeers: number;
};

export type PEXAdvertisement = {
  type: "advertisement";
  peers: PeerDTO[];
};

export type LikeMessage = {
  type: "like";
  from: string;
};

export type PEXMessage = PEXRequest | PEXAdvertisement;

export type ProfileMessage = {
  type: "profile";
  profile: Profile;
};

export type PeerDTO = {
  peerId: string;
  publicKey: string;
  age?: number;
  x?: number;
  y?: number;
  sex?: number[];
  searching?: number[];
  // todo - add geolocation
}

export interface WebRTCContextValue {
  peers: Peer[];
  profilesToDisplay: Profile[];
  matchesTimestamps: Map<string, number>;
  setPeers: React.Dispatch<React.SetStateAction<Peer[]>>;
  profile: Promise<Profile>;
  setProfile: React.Dispatch<React.SetStateAction<Promise<Profile>>>;
  peerIdRef: React.MutableRefObject<string | null>;
  socket: Socket | null;
  connectionsRef: React.MutableRefObject<Map<string, RTCPeerConnection>>,
  chatDataChannels: Map<string, RTCDataChannel>;
  createPeerConnection: (
    targetPeer: PeerDTO,
    signalingDataChannel?: RTCDataChannel | null
  ) => RTCPeerConnection;
  updatePeerStatus: (peerId: string, status: string) => void;
  updatePeerProfile: (peerId: string, profile: any) => void;
  initiateConnection: (
    targetPeer: PeerDTO,
    dataChannelUsedForSignaling?: RTCDataChannel | null
  ) => Promise<void>;
  sendMessageChatToPeer: (
    peerId: string,
    message: string,
  ) => Promise<void>;
  sendLikeMessage: (peerId: string) => void;
  addToDisplayedPeers: (peerId: string) => void;
  disconnectFromWebSocket: () => void;
  chatMessagesRef: React.MutableRefObject<Map<string, MessageData[]>>;
  notifyChat: number;
  closePeerConnection: (peerId: string) => void;
  dhtRef: React.MutableRefObject<DHT | null>;
  setMatchesTimestamps: React.Dispatch<React.SetStateAction<Map<string, number>>>;
  peersReceivedLikeFromRef: React.MutableRefObject<{ queue: string[]; lookup: Set<string> }>;
  likedPeersRef: React.MutableRefObject<Set<string>>;
  displayedPeersRef: React.MutableRefObject<Set<string>>;
}
