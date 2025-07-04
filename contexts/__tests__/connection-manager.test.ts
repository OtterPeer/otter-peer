import { ConnectionManager } from '../connection-manger';
import { PeerDTO, Profile, SwipeLabel } from '../../types/types';
import { trainModel, predictModel } from '../ai/knn';
import { generateRandomPeers } from '../utils/generate-random-peers';
import { MutableRefObject } from 'react';
import DHT from '../dht/dht';
import { RTCPeerConnection } from 'react-native-webrtc';
import KBucket from '../dht/kbucket';

// Mock native modules
jest.useFakeTimers()
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
  let profile: MutableRefObject<Profile | null>;

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
    jest.clearAllTimers();
    jest.spyOn(console, 'log').mockImplementation(() => {});

    // Create mock refs
    connectionsRef = new Map();
    pexDataChannelsRef = new Map();
    profilesToDisplayRef = { current: [] };
    currentSwiperIndexRef = { current: 0 };
    userFilterRef = { current: {} };
    blockedPeersRef = { current: new Set() };
    profile = {
      current: {
        name: "",
        profilePic: "",
        publicKey: "",
        peerId: "",
        x: 1,
        y: 1,
        latitude: 30,
        longitude: 40
      }

    }

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
      profile,
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

  afterEach(() => {
    jest.restoreAllMocks();
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
});