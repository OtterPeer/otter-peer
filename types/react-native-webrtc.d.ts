import 'react-native-webrtc'

declare module 'react-native-webrtc' {
  
  export type RTCDataChannelState = 'connecting' | 'open' | 'closing' | 'closed';

  export interface DataChannelEventMap {
    bufferedamountlow: RTCDataChannelEvent<'bufferedamountlow'>;
    close: RTCDataChannelEvent<'close'>;
    closing: RTCDataChannelEvent<'closing'>;
    error: RTCDataChannelEvent<'error'>;
    message: MessageEvent<'message'>;
    open: RTCDataChannelEvent<'open'>;
  }

  // Define MessageEvent
  export interface MessageEvent {
    type: 'message';
    data: string | ArrayBuffer | ArrayBufferView;
  }

  // Define RTCDataChannelEvent with generic type, matching library's expectation
  export interface RTCDataChannelEvent<T extends string = 'datachannel'> extends Event {
    type: T;
    channel: RTCDataChannel;
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

  export interface RTCDataChannel{
    label: string;
    readyState: string;
    bufferedAmount: number;
    bufferedAmountLowThreshold: number;
    id: number;
    ordered: boolean;
    maxPacketLifeTime?: number;
    maxRetransmits?: number;
    protocol: string;
    negotiated: boolean;
    binaryType: string;

    send(data: string): void;
    send(data: ArrayBuffer): void;
    send(data: ArrayBufferView): void;

    close(): void;

    addEventListener<K extends keyof DataChannelEventMap>(
      type: K,
      listener: (ev: DataChannelEventMap[K]) => void
    ): void;
    removeEventListener<K extends keyof DataChannelEventMap>(
      type: K,
      listener: (ev: DataChannelEventMap[K]) => void
    ): void;

    onmessage?: (event: MessageEvent) => void;
    onopen?: (event: RTCDataChannelEvent<'open'>) => void;
    onclose?: (event: RTCDataChannelEvent<'close'>) => void;
    onerror?: (event: RTCDataChannelEvent<'error'>) => void;
  }

  interface RTCPeerConnection {
    createDataChannel(label: string, dataChannelDict?: RTCDataChannelInit): RTCDataChannel;
  }
}