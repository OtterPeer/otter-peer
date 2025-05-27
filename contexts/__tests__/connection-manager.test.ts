import { ConnectionManager } from '../connection-manger';
import { PeerDTO, Profile, SwipeLabel } from '../../types/types';
import { trainModel, predictModel } from '../ai/knn';
import { generateRandomPeers } from '../utils/generate-random-peers';
import { MutableRefObject } from 'react';
import DHT from '../dht/dht';
import { RTCPeerConnection } from 'react-native-webrtc';
import KBucket from '../dht/kbucket';

// Mock native modules
jest.mock('react-native-sqlite-storage');
jest.mock('@react-native-async-storage/async-storage');
jest.mock('react-native-webrtc', () => ({
  RTCPeerConnection: jest.fn().mockImplementation(() => ({
    close: jest.fn(),
    iceConnectionState: 'connected',
    createDataChannel: jest.fn().mockReturnValue({
      readyState: 'open',
      send: jest.fn(),
      close: jest.fn(),
    }),
  })),
  RTCDataChannel: jest.fn(),
}));
jest.mock('react-native', () => {
  const rn = jest.requireActual('react-native');
  return {
    ...rn,
    Appearance: {
      getColorScheme: jest.fn(() => 'light'),
      addChangeListener: jest.fn(() => ({ remove: jest.fn() })),
    },
  };
});

// Mock DHT dependencies
jest.mock('../dht/dht', () => {
  return jest.fn().mockImplementation(() => ({
    getNodeId: jest.fn(() => 'self'),
    findNode: jest.fn(),
    addNode: jest.fn(),
    removeNode: jest.fn(),
    getBuckets: jest.fn(() => ({
      all: jest.fn(() => []),
      sortClosestToSelf: jest.fn((peerIds) => peerIds), // Preserve order for simplicity
    })),
  }));
});

// Mock KBucket
jest.mock('../dht/kbucket', () => {
  return jest.fn().mockImplementation(() => ({
    all: jest.fn(() => []),
    sortClosestToSelf: jest.fn((peerIds) => peerIds.slice().sort()), // Simple sort for deterministic tests
    remove: jest.fn(),
  }));
});

// Mock dependencies for ConnectionManager
const mockInitiateConnection = jest.fn();
const mockSetPeers = jest.fn();
const mockNotifyProfilesChange = jest.fn();

describe('ConnectionManager', () => {
  let connectionManager: ConnectionManager;
  let connectionsRef: Map<string, RTCPeerConnection>;
  let pexDataChannelsRef: Map<string, any>;
  let dhtRef: DHT;
  let profilesToDisplayRef: MutableRefObject<Profile[]>;
  let currentSwiperIndexRef: MutableRefObject<number>;
  let blockedPeersRef: MutableRefObject<Set<string>>;
  let userFilterRef: MutableRefObject<any>;

  // Sample swipeLabels used for training the knn model
  const swipeLabels: SwipeLabel[] = [
    { x: 1.0, y: 1.0, label: 'right' },
    { x: -1.0, y: -1.0, label: 'left' },
    { x: 0.5, y: 0.5, label: 'right' },
    { x: -0.5, y: -0.5, label: 'left' },
    { x: 1.8, y: 0.3, label: 'right' },
    { x: -1.2, y: -0.7, label: 'left' },
    { x: 0.8, y: 1.5, label: 'right' },
    { x: -0.9, y: -1.3, label: 'left' },
    { x: 1.4, y: -0.2, label: 'right' },
    { x: -1.5, y: 0.4, label: 'left' },
    { x: 0.2, y: 1.7, label: 'right' },
    { x: -0.3, y: -1.8, label: 'left' },
    { x: 1.6, y: 0.9, label: 'right' },
    { x: -1.7, y: -0.1, label: 'left' },
    { x: 0.7, y: 1.2, label: 'right' },
    { x: -0.6, y: -1.4, label: 'left' },
    { x: 1.3, y: -0.5, label: 'right' },
    { x: -1.1, y: 0.8, label: 'left' },
    { x: 0.4, y: 1.9, label: 'right' },
    { x: -0.8, y: -1.6, label: 'left' },
  ];

  // Generate random peers
  const peers: PeerDTO[] = generateRandomPeers(5);

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock refs
    connectionsRef = new Map();
    pexDataChannelsRef = new Map();
    profilesToDisplayRef = { current: [] };
    currentSwiperIndexRef = { current: 0 };
    userFilterRef = { current: {} };
    blockedPeersRef = { current: new Set() };

    // Instantiate DHT
    dhtRef = new DHT({ nodeId: 'self', k: 20 }, blockedPeersRef);

    // Instantiate ConnectionManager
    connectionManager = new ConnectionManager(
      connectionsRef,
      pexDataChannelsRef,
      dhtRef,
      userFilterRef,
      profilesToDisplayRef,
      new Set(),
      currentSwiperIndexRef,
      blockedPeersRef,
      mockSetPeers,
      mockInitiateConnection,
      mockNotifyProfilesChange
    );

    // Set internal properties
    (connectionManager as any).swipeLabels = swipeLabels;
    (connectionManager as any).minConnections = 20;
    (connectionManager as any).maxConnections = 100;
    (connectionManager as any).maxBufferSize = 20;
    (connectionManager as any).minBufferSize = 10;
    (connectionManager as any).swipeThreshold = 10;
    (connectionManager as any).profilesToAddAfterRanking = 10;
  });

  it('should return all peers when scores are identical', async () => {
    const sameScorePeers: PeerDTO[] = [
      { peerId: 'peer1', publicKey: 'pub1', x: 1.0, y: 1.0 },
      { peerId: 'peer2', publicKey: 'pub2', x: 1.0, y: 1.0 },
      { peerId: 'peer3', publicKey: 'pub3', x: 1.0, y: 1.0 },
      { peerId: 'peer4', publicKey: 'pub4', x: 1.0, y: 1.0 },
      { peerId: 'peer5', publicKey: 'pub5', x: 1.0, y: 1.0 },
      { peerId: 'peer6', publicKey: 'pub6', x: 1.0, y: 1.0 },
      { peerId: 'peer7', publicKey: 'pub1', x: -1.0, y: -1.0 },
      { peerId: 'peer8', publicKey: 'pub2', x: -1.0, y: -1.0 },
      { peerId: 'peer9', publicKey: 'pub3', x: -1.0, y: -1.0 },
      { peerId: 'peer10', publicKey: 'pub4', x: -1.0, y: -1.0 },
      { peerId: 'peer11', publicKey: 'pub5', x: -1.0, y: -1.0 },
      { peerId: 'peer12', publicKey: 'pub6', x: -1.0, y: -1.0 },
    ];
    const result = await connectionManager['rankPeers'](sameScorePeers);
    expect(result).toHaveLength(sameScorePeers.length);
    expect(result.map(p => p.peerId)).toEqual(['peer1', 'peer2', 'peer3', 'peer4', 'peer5', 'peer6', 'peer7', 'peer8', 'peer9', 'peer10', 'peer11', 'peer12']);
    expect(result).toEqual(sameScorePeers); // Order preserved
  });

  it('should return all peers with varied scores', async () => {
    const result = await connectionManager['rankPeers'](peers);
    expect(result).toHaveLength(5);
    const scores = result.map(p => {
      const model = trainModel(swipeLabels);
      const prediction = predictModel(model, { x: p.x ?? 0, y: p.y ?? 0 });
      return prediction.scores.right;
    });
    // Verify descending order
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
    }
  });

  it('should return empty array for empty input', async () => {
    const result = await connectionManager['rankPeers']([]);
    expect(result).toEqual([]);
  });

  // describe('Connection Limiting', () => {
  //   beforeEach(() => {
  //     // Reset mocks and state
  //     connectionsRef.clear();
  //     pexDataChannelsRef.clear();
  //     profilesToDisplayRef.current = [];
  //     (connectionManager as any).filteredPeersReadyToDisplay.clear();
  //     connectionManager.stop(); // Clear failedRequestPeers via stop method
  //     mockInitiateConnection.mockReset();
  //     (dhtRef.getBuckets().all as jest.Mock).mockReset();
  //     (dhtRef.getBuckets().sortClosestToSelf as jest.Mock).mockReset();
  //   });

  //   it('should not disconnect peers when connections are below or at limit', async () => {
  //     // Setup 100 connections (at limit)
  //     for (let i = 0; i < 100; i++) {
  //       const peerId = `peer${i}`;
  //       connectionsRef.set(peerId, new RTCPeerConnection({}));
  //       pexDataChannelsRef.set(peerId, { readyState: 'open', send: jest.fn(), close: jest.fn() });
  //     }

  //     await (connectionManager as any).checkAndLimitConnections();
  //     expect(connectionsRef.size).toBe(100);
  //     expect(dhtRef.removeNode).not.toHaveBeenCalled();
  //   });

  //   it('should disconnect excess peers not in use when over limit', async () => {
  //     // Setup 101 connections (1 over limit)
  //     for (let i = 0; i < 101; i++) {
  //       const peerId = `peer${i}`;
  //       connectionsRef.set(peerId, new RTCPeerConnection({}));
  //       pexDataChannelsRef.set(peerId, { readyState: 'open', send: jest.fn(), close: jest.fn() });
  //     }

  //     await (connectionManager as any).checkAndLimitConnections();
  //     expect(connectionsRef.size).toBe(100);
  //     expect(dhtRef.removeNode).toHaveBeenCalledTimes(1);
  //     expect(mockNotifyProfilesChange).not.toHaveBeenCalled(); // No profiles affected
  //   });

  //   it('should preserve peers in filteredPeersReadyToDisplay', async () => {
  //     // Setup 101 connections
  //     for (let i = 0; i < 101; i++) {
  //       const peerId = `peer${i}`;
  //       connectionsRef.set(peerId, new RTCPeerConnection({}));
  //       pexDataChannelsRef.set(peerId, { readyState: 'open', send: jest.fn(), close: jest.fn() });
  //     }

  //     // Add some peers to filteredPeersReadyToDisplay
  //     const protectedPeers = [
  //       { peerId: 'peer0', publicKey: 'pub0' },
  //       { peerId: 'peer1', publicKey: 'pub1' },
  //     ];
  //     protectedPeers.forEach(peer => {
  //       (connectionManager as any).filteredPeersReadyToDisplay.add(peer);
  //     });

  //     await (connectionManager as any).checkAndLimitConnections();
  //     expect(connectionsRef.size).toBe(100);
  //     expect(connectionsRef.has('peer0')).toBe(true);
  //     expect(connectionsRef.has('peer1')).toBe(true);
  //     expect(dhtRef.removeNode).toHaveBeenCalledTimes(1);
  //     expect(dhtRef.removeNode).not.toHaveBeenCalledWith('peer0');
  //     expect(dhtRef.removeNode).not.toHaveBeenCalledWith('peer1');
  //   });

  //   it('should preserve peers in profilesToDisplayRef after currentSwiperIndex', async () => {
  //     // Setup 101 connections
  //     for (let i = 0; i < 101; i++) {
  //       const peerId = `peer${i}`;
  //       connectionsRef.set(peerId, new RTCPeerConnection({}));
  //       pexDataChannelsRef.set(peerId, { readyState: 'open', send: jest.fn(), close: jest.fn() });
  //     }

  //     // Add profiles to profilesToDisplayRef
  //     profilesToDisplayRef.current = [
  //       { peerId: 'peer0', name: 'Peer0' } as Profile,
  //       { peerId: 'peer1', name: 'Peer1' } as Profile,
  //       { peerId: 'peer2', name: 'Peer2' } as Profile,
  //     ];
  //     currentSwiperIndexRef.current = 1; // Protect peer1, peer2

  //     await (connectionManager as any).checkAndLimitConnections();
  //     expect(connectionsRef.size).toBe(100);
  //     expect(connectionsRef.has('peer1')).toBe(true);
  //     expect(connectionsRef.has('peer2')).toBe(true);
  //     expect(dhtRef.removeNode).toHaveBeenCalledTimes(1);
  //     expect(dhtRef.removeNode).not.toHaveBeenCalledWith('peer1');
  //     expect(dhtRef.removeNode).not.toHaveBeenCalledWith('peer2');
  //   });

  //   it('should preserve peers in DHT buckets', async () => {
  //     // Setup 101 connections
  //     for (let i = 0; i < 101; i++) {
  //       const peerId = `peer${i}`;
  //       connectionsRef.set(peerId, new RTCPeerConnection({}));
  //       pexDataChannelsRef.set(peerId, { readyState: 'open', send: jest.fn(), close: jest.fn() });
  //     }

  //     // Mock DHT buckets
  //     (dhtRef.getBuckets().all as jest.Mock).mockReturnValue([
  //       { id: 'peer0' },
  //       { id: 'peer1' },
  //     ]);

  //     await (connectionManager as any).checkAndLimitConnections();
  //     expect(connectionsRef.size).toBe(100);
  //     expect(connectionsRef.has('peer0')).toBe(true);
  //     expect(connectionsRef.has('peer1')).toBe(true);
  //     expect(dhtRef.removeNode).toHaveBeenCalledTimes(1);
  //     expect(dhtRef.removeNode).not.toHaveBeenCalledWith('peer0');
  //     expect(dhtRef.removeNode).not.toHaveBeenCalledWith('peer1');
  //   });

  //   it('should disconnect furthest peer when all peers are in use', async () => {
  //     // Setup 101 connections
  //     for (let i = 0; i < 101; i++) {
  //       const peerId = `peer${i}`;
  //       connectionsRef.set(peerId, new RTCPeerConnection({}));
  //       pexDataChannelsRef.set(peerId, { readyState: 'open', send: jest.fn(), close: jest.fn() });
  //     }

  //     // All peers are in filteredPeersReadyToDisplay
  //     for (let i = 0; i < 101; i++) {
  //       (connectionManager as any).filteredPeersReadyToDisplay.add({ peerId: `peer${i}`, publicKey: `pub${i}` });
  //     }

  //     // Mock sortClosestToSelf to return peers in reverse order (peer100 is furthest)
  //     (dhtRef.getBuckets().sortClosestToSelf as jest.Mock).mockImplementation((peerIds) => peerIds.slice().sort().reverse());

  //     await (connectionManager as any).checkAndLimitConnections();
  //     expect(connectionsRef.size).toBe(100);
  //     expect(connectionsRef.has('peer100')).toBe(false);
  //     expect(dhtRef.removeNode).toHaveBeenCalledWith('peer100');
  //   });

  //   it('should disconnect oldest peer as fallback when no other peers can be disconnected', async () => {
  //     // Setup 101 connections
  //     for (let i = 0; i < 101; i++) {
  //       const peerId = `peer${i}`;
  //       connectionsRef.set(peerId, new RTCPeerConnection({}));
  //       pexDataChannelsRef.set(peerId, { readyState: 'open', send: jest.fn(), close: jest.fn() });
  //     }

  //     // All peers are in profilesToDisplayRef
  //     profilesToDisplayRef.current = Array.from({ length: 101 }, (_, i) => ({
  //       peerId: `peer${i}`,
  //       name: `Peer${i}`,
  //     } as Profile));
  //     currentSwiperIndexRef.current = 0;

  //     // Mock sortClosestToSelf to return empty array (no disconnectable peers)
  //     (dhtRef.getBuckets().sortClosestToSelf as jest.Mock).mockReturnValue([]);

  //     await (connectionManager as any).checkAndLimitConnections();
  //     expect(connectionsRef.size).toBe(100);
  //     expect(connectionsRef.has('peer0')).toBe(false); // Oldest peer disconnected
  //     expect(dhtRef.removeNode).toHaveBeenCalledWith('peer0');
  //   });

  //   it('should respect maxConnections in handleNewPeers', async () => {
  //     // Setup 100 connections (at limit)
  //     for (let i = 0; i < 100; i++) {
  //       const peerId = `peer${i}`;
  //       connectionsRef.set(peerId, new RTCPeerConnection({}));
  //       pexDataChannelsRef.set(peerId, { readyState: 'open', send: jest.fn(), close: jest.fn() });
  //     }

  //     const newPeers: PeerDTO[] = [
  //       { peerId: 'newPeer1', publicKey: 'pub1' },
  //       { peerId: 'newPeer2', publicKey: 'pub2' },
  //     ];

  //     await connectionManager.handleNewPeers(newPeers, null);
  //     expect(mockInitiateConnection).not.toHaveBeenCalled();
  //     expect(connectionsRef.size).toBe(100);
  //   });

  //   it('should allow new connections when under maxConnections in handleNewPeers', async () => {
  //     // Setup 99 connections (below limit)
  //     for (let i = 0; i < 99; i++) {
  //       const peerId = `peer${i}`;
  //       connectionsRef.set(peerId, new RTCPeerConnection({}));
  //       pexDataChannelsRef.set(peerId, { readyState: 'open', send: jest.fn(), close: jest.fn() });
  //     }

  //     const newPeers: PeerDTO[] = [
  //       { peerId: 'newPeer1', publicKey: 'pub1' },
  //       { peerId: 'newPeer2', publicKey: 'pub2' },
  //     ];

  //     // Mock filterPeer to allow all peers
  //     jest.spyOn(connectionManager as any, 'filterPeer').mockReturnValue(true);

  //     await connectionManager.handleNewPeers(newPeers, null);
  //     expect(mockInitiateConnection).toHaveBeenCalledTimes(1); // Only 1 slot available
  //     expect(mockInitiateConnection).toHaveBeenCalledWith(newPeers[0], null, false);
  //   });

  //   it('should respect maxConnections in tryToRestoreDHTConnections', async () => {
  //     // Setup 100 connections (at limit)
  //     for (let i = 0; i < 100; i++) {
  //       const peerId = `peer${i}`;
  //       connectionsRef.set(peerId, new RTCPeerConnection({}));
  //       pexDataChannelsRef.set(peerId, { readyState: 'open', send: jest.fn(), close: jest.fn() });
  //     }

  //     (dhtRef.getBuckets().all as jest.Mock).mockReturnValue([
  //       { id: 'newPeer1' },
  //       { id: 'newPeer2' },
  //     ]);

  //     await (connectionManager as any).tryToRestoreDHTConnections(5);
  //     expect(mockInitiateConnection).not.toHaveBeenCalled();
  //     expect(connectionsRef.size).toBe(100);
  //   });

  //   it('should allow new connections when under maxConnections in tryToRestoreDHTConnections', async () => {
  //     // Setup 99 connections (below limit)
  //     for (let i = 0; i < 99; i++) {
  //       const peerId = `peer${i}`;
  //       connectionsRef.set(peerId, new RTCPeerConnection({}));
  //       pexDataChannelsRef.set(peerId, { readyState: 'open', send: jest.fn(), close: jest.fn() });
  //     }

  //     (dhtRef.getBuckets().all as jest.Mock).mockReturnValue([
  //       { id: 'newPeer1' },
  //       { id: 'newPeer2' },
  //     ]);

  //     // Mock fetchUserFromDB
  //     jest.spyOn(require('../db/userdb'), 'fetchUserFromDB').mockImplementation(async (peerId) => ({
  //       publicKey: `pub_${peerId}`,
  //     }));

  //     await (connectionManager as any).tryToRestoreDHTConnections(5);
  //     expect(mockInitiateConnection).toHaveBeenCalledTimes(1); // Only 1 slot available
  //     expect(mockInitiateConnection).toHaveBeenCalledWith(
  //       { peerId: 'newPeer1', publicKey: 'pub_newPeer1' },
  //       null,
  //       true
  //     );
  //   });
  // });
});