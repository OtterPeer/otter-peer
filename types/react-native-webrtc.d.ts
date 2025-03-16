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

  export interface MessageEvent {
    type: 'message';
    data: string;
  }

  export interface RTCDataChannelEvent<T extends string = 'datachannel'> extends Event {
    type: T;
    channel: RTCDataChannel;
  }

  export interface RTCIceCandidateEvent<T extends string = 'icecandidate'> extends Event {
    type: T;
    candidate: import('react-native-webrtc').RTCIceCandidate | null;
  }

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

    onmessage?: (event: MessageEvent) => void;
    onopen?: (event: RTCDataChannelEvent<'open'>) => void;
    onclose?: (event: RTCDataChannelEvent<'close'>) => void;
    onerror?: (event: RTCDataChannelEvent<'error'>) => void;
  }

  export interface RTCPeerConnection {
    createDataChannel(label: string, dataChannelDict?: RTCDataChannelInit): RTCDataChannel;
    ondatachannel?: (event: RTCDataChannelEvent<'datachannel'>) => void;
    onicecandidate?: (event: RTCIceCandidateEvent<'icecandidate'>) => void;
    oniceconnectionstatechange?: (event: Event<'iceconnectionstatechange'>) => void;
  }
}