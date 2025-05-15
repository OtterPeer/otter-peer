export const MessageEvent = jest.fn();
export default {
  // Mock WebRTC methods used by ConnectionManager
  RTCIceCandidate: jest.fn(),
  RTCSessionDescription: jest.fn(),
  RTCView: jest.fn(),
  MediaStream: jest.fn(),
  MediaStreamTrack: jest.fn(),
  getUserMedia: jest.fn(),
  // Add other methods as needed
};