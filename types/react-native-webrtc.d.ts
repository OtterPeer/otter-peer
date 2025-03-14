import 'react-native-webrtc'

declare module 'react-native-webrtc' {

  export interface RTCDataChannel {
    label: string;
    readyState: 'connecting' | 'open' | 'closing' | 'closed';
    send(data: string): void;
    close(): void;
    addEventListener<K extends keyof DataChannelEventMap>(
      type: K,
      listener: (ev: DataChannelEventMap[K]) => void
    ): void;
    removeEventListener<K extends keyof DataChannelEventMap>(
      type: K,
      listener: (ev: DataChannelEventMap[K]) => void
    ): void;
  }

  export interface DataChannelEventMap {
    open: Event;
    close: Event;
    message: MessageEvent;
    error?: Event;
    bufferedamountlow?: Event;
    closing?: Event;
  }

  export interface MessageEvent {
    data: string | ArrayBuffer | ArrayBufferView;
  }

  export interface RTCDataChannelEvent extends Event {
    channel: RTCDataChannel;
  }

  export interface RTCIceCandidateEvent extends Event {
    candidate: RTCIceCandidate | null; // Use the library's RTCIceCandidate
  }

  export interface Event {
    type: string;
  }

  interface RTCPeerConnection {
    createDataChannel(label: string, dataChannelDict?: RTCDataChannelInit): RTCDataChannel;
  }
}