import { Node } from "./webrtc-rpc";

class KBucket {
  private buckets: Node[][];
  private localId: string;
  private k: number;

  constructor(localId: string, k: number = 20) {
    this.buckets = Array(160)
      .fill(null)
      .map(() => []); // 160 bits max for SHA-1-like IDs
    this.localId = localId;
    this.k = k;
  }

  // Add a node to the appropriate bucket
  public add(node: Node): void {
    if (node.id === this.localId) return; // Don’t add self
    const distance = this.xorDistance(this.localId, node.id);
    const bucketIndex = this.bucketIndex(distance);
    const bucket = this.buckets[bucketIndex];
    if (!bucket.some((n) => n.id === node.id)) {
      if (bucket.length < this.k) bucket.push(node);
      else bucket.shift();
      bucket.push(node); // Simple FIFO replacement
    }
  }

  // Get K closest nodes to a target ID
  public closest(target: string, k: number = this.k): Node[] {
    const distances = this.all().map((node) => ({
      node,
      distance: this.xorDistance(node.id, target),
    }));
    distances.sort((a, b) => a.distance.localeCompare(b.distance)); // Hex string comparison
    return distances.slice(0, k).map((d) => d.node);
  }

  // Get all nodes
  public all(): Node[] {
    return this.buckets.flat();
  }

  // Calculate XOR distance as a hex string
  private xorDistance(id1: string, id2: string): string {
    const b1 = Buffer.from(id1, "hex");
    const b2 = Buffer.from(id2, "hex");
    const result = Buffer.alloc(b1.length);
    for (let i = 0; i < b1.length; i++) result[i] = b1[i] ^ b2[i];
    return result.toString("hex");
  }

  // Determine bucket index (simplified)
  private bucketIndex(distance: string): number {
    const d = Buffer.from(distance, "hex");
    for (let i = 0; i < d.length; i++) {
      for (let j = 7; j >= 0; j--) {
        if ((d[i] & (1 << j)) !== 0) return i * 8 + (7 - j);
      }
    }
    return 0; // Same ID
  }
}

export default KBucket;
