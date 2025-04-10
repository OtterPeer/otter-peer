import { Socket } from "socket.io-client";
import {
  RTCPeerConnection,
  RTCDataChannel,
  RTCSessionDescription,
} from "react-native-webrtc";

export interface Profile {
  name: string;
  profilePic: string;
  publicKey: string;
  peerId: string;
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
  connections: { [key: string]: RTCPeerConnection };
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
}

export interface WebRTCRPCOptions {
  getDataChannel?: (node: Node) => Promise<RTCDataChannel>;
  timeout?: number;
}

export interface Node {
  id: string; // Unique peer ID
  // Add other properties if needed (e.g., host, port) based on your WebRTC setup
}

export interface QueryMessage {
  q: string; // Query method (e.g., "ping", "find_node")
  a: Record<string, any>; // Query arguments
}

export interface QueuedQuery {
  tid: string;
  message: QueryMessage;
  callback: Callback;
}

export interface Request {
  callback: Callback;
  timer: NodeJS.Timeout;
  nodeId: string;
}

export interface ChannelInfo {
  channel: RTCDataChannel | null;
  queue: QueuedQuery[];
}

export interface RPCMessage {
  type: "query" | "response" | "error";
  t: string; // Transaction ID
  q?: string; // Query method (for type: 'query')
  a?: Record<string, any>; // Arguments (for type: 'query')
  r?: Record<string, any>; // Response data (for type: 'response')
  e?: string; // Error message (for type: 'error')
  code?: string | number; // Optional error code
}

export type Callback = (
  error: Error | null,
  message: RPCMessage | null,
  peer: Node
) => void;
