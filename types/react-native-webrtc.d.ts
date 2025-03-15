import 'react-native-webrtc'

declare module 'react-native-webrtc' {

  export interface RTCDataChannel {
    label: string;
    readyState: string; // Match library's internal type (looser than spec)
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

  // Define DataChannelEventMap
  export interface DataChannelEventMap {
    open: Event;
    close: Event;
    message: MessageEvent;
    error?: Event;
    bufferedamountlow?: Event;
    closing?: Event;
  }

  // Define MessageEvent
  export interface MessageEvent {
    type: 'message';
    data: string | ArrayBuffer | ArrayBufferView;
  }

  // Define RTCDataChannelEvent with generic type, matching library's expectation
  export interface RTCDataChannelEvent<T extends string = 'datachannel'> extends Event {
    type: T;
    channel: RTCDataChannel; // Use the custom RTCDataChannel with readyState as string
  }

  // Define RTCIceCandidateEvent with generic type
  export interface RTCIceCandidateEvent<T extends string = 'icecandidate'> extends Event {
    type: T;
    candidate: import('react-native-webrtc').RTCIceCandidate | null;
  }

  // Define a basic Event type
  export interface Event<T extends string = string> {
    type: T;
  }

  // Extend RTCPeerConnection
  interface RTCPeerConnection {
    createDataChannel(label: string, dataChannelDict?: RTCDataChannelInit): RTCDataChannel;
  }
}