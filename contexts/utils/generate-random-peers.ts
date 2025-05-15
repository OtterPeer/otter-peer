import { PeerDTO } from '../../types/types';

export function generateRandomPeers(count: number): PeerDTO[] {
  const peers: PeerDTO[] = [];
  const usedIds = new Set<string>();

  for (let i = 0; i < count; i++) {
    let peerId: string;
    do {
      peerId = `peer${Math.random().toString(36).substr(2, 9)}`;
    } while (usedIds.has(peerId));
    usedIds.add(peerId);

    const peer: PeerDTO = {
      peerId,
      publicKey: `pubkey${Math.random().toString(36).substr(2, 9)}`,
      x: Math.random() * 4 - 2, // Random float in [-2, 2]
      y: Math.random() * 4 - 2, // Random float in [-2, 2]
      age: Math.floor(Math.random() * (40 - 18 + 1)) + 18, // Random age 18-40
      sex: [Math.random() > 0.5 ? 1 : 0, Math.random() > 0.5 ? 1 : 0], // Random one-hot encoding
      searching: [Math.random() > 0.5 ? 1 : 0, Math.random() > 0.5 ? 1 : 0], // Random one-hot encoding
      latitude: Math.random() * 180 - 90, // Random latitude
      longitude: Math.random() * 360 - 180, // Random longitude
    };
    peers.push(peer);
  }

  return peers;
}