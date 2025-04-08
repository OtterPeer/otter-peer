import { handlePEXMessages, sendPEXRequest } from "../pex";
import { RTCDataChannel } from "react-native-webrtc";

// Mock RTCDataChannel
const mockSend = jest.fn();
const mockDataChannel = {
  send: mockSend,
} as unknown as RTCDataChannel;

// Mock initiateConnection
const mockInitiateConnection = jest.fn(() => Promise.resolve());

// Mock connections and signaling channel
const mockConnections: { [key: string]: RTCPeerConnection } = {};
const mockSignalingChannel = null; // Simplified for testing

describe("pex.ts", () => {
  beforeEach(() => {
    jest.clearAllMocks(); // Reset mock calls between tests
  });

  // Test sendPEXRequest
  describe("sendPEXRequest", () => {
    it("sends a PEX request with correct format", () => {
      sendPEXRequest(mockDataChannel);
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(
        JSON.stringify({ type: "request", maxNumberOfPeers: 20 })
      );
    });

    it("handles send errors gracefully", () => {
      const errorMockSend = jest.fn(() => {
        throw new Error("Send failed");
      });
      const errorMockChannel = {
        send: errorMockSend,
      } as unknown as RTCDataChannel;
      sendPEXRequest(errorMockChannel);
      expect(errorMockSend).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith(
        "Couldn’t send pex request: Error: Send failed"
      );
    });
  });

  // Test handlePEXMessages
  describe("handlePEXMessages", () => {
    it("handles PEX request by sharing connected peers", () => {
      const mockConnectionsWithPeers = {
        peer1: {} as RTCPeerConnection,
        peer2: {} as RTCPeerConnection,
      };
      const requestEvent = {
        data: JSON.stringify({ type: "request", maxNumberOfPeers: 10 }),
      } as MessageEvent;
      handlePEXMessages(
        requestEvent,
        mockDataChannel,
        mockConnectionsWithPeers,
        "userPeer",
        mockInitiateConnection,
        mockSignalingChannel
      );
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(
        JSON.stringify({ type: "advertisement", peers: ["peer1", "peer2"] })
      );
    });

    it("handles PEX advertisement and initiates connections", () => {
      const advertisementEvent = {
        data: JSON.stringify({
          type: "advertisement",
          peers: ["peer3", "peer4"],
        }),
      } as MessageEvent;
      handlePEXMessages(
        advertisementEvent,
        mockDataChannel,
        {},
        "userPeer",
        mockInitiateConnection,
        mockSignalingChannel
      );
      expect(mockInitiateConnection).toHaveBeenCalledTimes(2);
      expect(mockInitiateConnection).toHaveBeenCalledWith("peer3", null);
      expect(mockInitiateConnection).toHaveBeenCalledWith("peer4", null);
    });

    it("skips already connected peers and self in advertisement", () => {
      const mockConnectionsWithPeers = { peer1: {} as RTCPeerConnection };
      const advertisementEvent = {
        data: JSON.stringify({
          type: "advertisement",
          peers: ["peer1", "userPeer", "peer2"],
        }),
      } as MessageEvent;
      handlePEXMessages(
        advertisementEvent,
        mockDataChannel,
        mockConnectionsWithPeers,
        "userPeer",
        mockInitiateConnection,
        mockSignalingChannel
      );
      expect(mockInitiateConnection).toHaveBeenCalledTimes(1);
      expect(mockInitiateConnection).toHaveBeenCalledWith("peer2", null);
    });

    it("handles malformed messages gracefully", () => {
      const invalidEvent = { data: "invalid json" } as MessageEvent;
      handlePEXMessages(
        invalidEvent,
        mockDataChannel,
        {},
        "userPeer",
        mockInitiateConnection,
        mockSignalingChannel
      );
      expect(console.error).toHaveBeenCalledWith(
        "Error handling PEX request:",
        expect.any(Error)
      );
      expect(mockInitiateConnection).not.toHaveBeenCalled();
    });
  });

  // Test shareConnectedPeers (internal function)
  describe("shareConnectedPeers", () => {
    it("shares all connected peers", () => {
      const mockConnectionsWithPeers = {
        peer1: {} as RTCPeerConnection,
        peer2: {} as RTCPeerConnection,
      };
      const request = { type: "request", maxNumberOfPeers: 10 } as PEXRequest;
      // Note: shareConnectedPeers is private, so you'd need to expose it or test via handlePEXMessages
      handlePEXMessages(
        { data: JSON.stringify(request) } as MessageEvent,
        mockDataChannel,
        mockConnectionsWithPeers,
        "userPeer",
        mockInitiateConnection,
        mockSignalingChannel
      );
      expect(mockSend).toHaveBeenCalledWith(
        JSON.stringify({ type: "advertisement", peers: ["peer1", "peer2"] })
      );
    });
  });
});
