import { Socket } from 'socket.io-client';
import { RTCPeerConnection, RTCDataChannel, RTCSessionDescription } from 'react-native-webrtc';

export interface Profile {
    name: string;
    profilePic: string;
    publicKey: string;
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
    target: string | 'all';
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
    target: 'all';
    payload: {
      action: 'close';
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
    type: 'request';
    maxNumberOfPeers: number;
};
  
export type PEXAdvertisement = {
    type: 'advertisement';
    peers: string[];
};
  
export type PEXMessage = PEXRequest | PEXAdvertisement;
  
export type ProfileMessage = {
    type: 'profile';
    profile: Profile;
};
  
export interface WebRTCContextValue {
    peers: Peer[];
    setPeers: React.Dispatch<React.SetStateAction<Peer[]>>;
    profile: Profile;
    setProfile: React.Dispatch<React.SetStateAction<any>>;
    peerIdRef: React.MutableRefObject<string | null>;
    socket: Socket | null;
    connections: { [key: string]: RTCPeerConnection };
    chatDataChannels: Map<string, RTCDataChannel>;
    createPeerConnection: (peerId: string, signalingDataChannel?: RTCDataChannel | null) => RTCPeerConnection;
    updatePeerStatus: (peerId: string, status: string) => void;
    updatePeerProfile: (peerId: string, profile: any) => void;
    initiateConnection: (peerId: string, dataChannelUsedForSignaling?: RTCDataChannel | null) => Promise<void>;
    // handleOffer: (
    //     sdp: RTCSessionDescription,
    //     sender: string,
    //     channelUsedForSignaling?: RTCDataChannel | null,
    //     createPeerConnection?: (peerId: string, signalingDataChannel?: RTCDataChannel | null) => RTCPeerConnection
    // ) => Promise<void>;
    sendMessageChatToPeer: (peerId: string, message: string, peerPublicKey: string) => void;
    receiveMessageFromChat: (peerId: string, dataChannel: RTCDataChannel) => Promise<void>;
    disconnectFromWebSocket: () => void;
    chatMessagesRef: React.MutableRefObject<Map<string, MessageData[]>>;
    notifyChat: number;
}