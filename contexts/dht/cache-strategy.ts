import { EventEmitter } from 'events';
import { QueuedMessage } from './dht';
import { MessageDTO } from '../../app/chat/chatUtils'
import { Node } from './webrtc-rpc';
import KBucket from './kbucket';

export interface CacheStrategy extends EventEmitter {
  cacheMessage(sender: string, recipient: string, message: MessageDTO, nodeId: string, recipienFoundInBuckets: boolean): void;
  tryToDeliverCachedMessages(
    findAndPingNode: (targetId: string) => Promise<Node | null>,
    sendMessage: (node: Node, sender: string, recipient: string, message: MessageDTO) => Promise<boolean>,
    maxTTL: number
  ): Promise<void>;
  getCachedMessageCount(): number;
  clear(): void;
  addCachedMessages(cachedMessages: Map<string, QueuedMessage>): void,
  getCachedMessages(): Map<string, QueuedMessage>
}

export class DistanceBasedCacheStrategy extends EventEmitter implements CacheStrategy {
  private cachedMessages: Map<string, QueuedMessage>;
  private accessOrder: string[];
  private maxSize: number;
  private distanceThreshold: number;

  constructor(maxSize: number = 2000, distanceThreshhold: number = 2 ** 40, cachedMessages = null) {
    super();
    this.cachedMessages = cachedMessages || new Map();
    this.accessOrder = [];
    this.maxSize = maxSize;
    this.distanceThreshold = distanceThreshhold;
  }

  cacheMessage(sender: string, recipient: string, message: MessageDTO, nodeId: string, recipienFoundInBuckets: boolean): void {
    if (!message.id || this.cachedMessages.has(message.id)) {
      console.log(`Message ${message.id} already cached or no ID; skipping`);
      return;
    }

    const distanceHex = KBucket.xorDistance(nodeId, recipient);

    const distanceHexShort = distanceHex.substring(0, 12);
    const distance = parseInt(distanceHexShort, 16) || 0;

    console.log(`Distance (48 most significant bits): ${distance}`);

    if (!recipienFoundInBuckets) {
      if (distance > this.distanceThreshold) {
        console.log(`Distance too far; skipping`);
        return;
      }
    } else {
      console.log(`Recipient found in buckets, caching message ${message.id}`);
    }


    if (this.cachedMessages.size >= this.maxSize) {
      const oldestId = this.accessOrder.shift();
      if (oldestId) {
        this.cachedMessages.delete(oldestId);
        console.log(`Evicted oldest message ${oldestId} due to cache size limit`);
      }
    }

    const queued: QueuedMessage = {
      sender,
      recipient,
      message,
    };
    this.cachedMessages.set(message.id, queued);
    this.accessOrder.push(message.id);
    this.emit('messageCached');
    console.log(`Cached message ${message.id} for ${recipient} (DistanceBasedCacheStrategy)`);
  }

  async tryToDeliverCachedMessages(
    findAndPingNode: (targetId: string) => Promise<Node | null>,
    sendMessage: (node: Node, sender: string, recipient: string, message: MessageDTO) => Promise<boolean>,
    maxTTL: number
  ): Promise<void> {
    // console.log("Trying to deliver cached messages (LRU)");
    const now = Date.now();
    for (const [messageId, msg] of this.cachedMessages) {
      if (now - msg.message.timestamp > maxTTL) {
        console.log(`Message ${messageId} expired; removing`);
        this.cachedMessages.delete(messageId);
        this.accessOrder = this.accessOrder.filter(id => id !== messageId);
        continue;
      }

      const targetNode = await findAndPingNode(msg.recipient);
      try {
        if (targetNode) {
          const success = await sendMessage(targetNode, msg.sender, msg.recipient, msg.message);
          if (success) {
            console.log(`Delivered cached message ${messageId} to ${msg.recipient}`);
            this.cachedMessages.delete(messageId);
            this.accessOrder = this.accessOrder.filter(id => id !== messageId);
          } else {
            this.accessOrder = this.accessOrder.filter(id => id !== messageId);
            this.accessOrder.push(messageId);
          }
        } else {
          console.log(`Recipient ${msg.recipient} offline; keeping message ${messageId} in cache`);
          this.accessOrder = this.accessOrder.filter(id => id !== messageId);
          this.accessOrder.push(messageId);
        }
      } catch (error) {
        console.error(`Error delivering cached message ${messageId}:`, error);
      }
    }
  }

  addCachedMessages(cachedMessages: Map<string, QueuedMessage>): void {
    for (const [key, value] of cachedMessages) {
      if (!this.cachedMessages.has(key)) {
        this.cachedMessages.set(key, value);
      }
    }
  }

  getCachedMessages(): Map<string, QueuedMessage> {
    return this.cachedMessages;
  }

  getCachedMessageCount(): number {
    return this.cachedMessages.size;
  }

  clear(): void {
    this.cachedMessages.clear();
    this.accessOrder = [];
  }
}

export class DistanceBasedProbabilisticCacheStrategy extends EventEmitter implements CacheStrategy {
  private cachedMessages: Map<string, QueuedMessage>;
  private accessOrder: string[];
  private maxSize: number;
  private distanceThreshold: number;
  private cacheProbability: number;

  constructor(maxSize: number = 100, distanceThreshold: number = 2 ** 39, cacheProbability: number = 0.7) {
    super();
    this.cachedMessages = new Map();
    this.accessOrder = [];
    this.maxSize = maxSize;
    this.distanceThreshold = distanceThreshold;
    this.cacheProbability = cacheProbability;
  }
  addCachedMessages(cachedMessages: Map<string, QueuedMessage>): void {
    throw new Error('Method not implemented.');
  }
  getCachedMessages(): Map<string, QueuedMessage> {
    throw new Error('Method not implemented.');
  }

  cacheMessage(sender: string, recipient: string, message: MessageDTO, nodeId: string, recipienFoundInBuckets: boolean): void {
    if (!message.id || this.cachedMessages.has(message.id)) {
      console.log(`Message ${message.id} already cached or no ID; skipping`);
      return;
    }

    const distanceHex = KBucket.xorDistance(nodeId, recipient);
    const distanceHexShort = distanceHex.substring(0, 12);
    const distance = parseInt(distanceHexShort, 16) || 0;

    console.log(`Distance (48 most significant bits): ${distance}`);

    if (!recipienFoundInBuckets) {
      if (distance > this.distanceThreshold) {
        console.log(`Distance ${distance} exceeds threshold ${this.distanceThreshold}; not caching`);
        return;
      }
  
      if (Math.random() > this.cacheProbability) {
        console.log(`Probabilistic skip: Not caching message ${message.id} (probability=${this.cacheProbability})`);
        return;
      }
    } else {
      console.log(`Recipient found in buckets, caching message ${message.id}`);
    }

    if (this.cachedMessages.size >= this.maxSize) {
      const oldestId = this.accessOrder.shift();
      if (oldestId) {
        this.cachedMessages.delete(oldestId);
        console.log(`Evicted oldest message ${oldestId} due to cache size limit`);
      }
    }

    const queued: QueuedMessage = {
      sender,
      recipient,
      message,
    };
    this.cachedMessages.set(message.id, queued);
    this.accessOrder.push(message.id);
    this.emit('cache');
    console.log(`Cached message ${message.id} for ${recipient} with probability ${this.cacheProbability}`);
  }

  async tryToDeliverCachedMessages(
    findAndPingNode: (targetId: string) => Promise<Node | null>,
    sendMessage: (node: Node, sender: string, recipient: string, message: MessageDTO) => Promise<boolean>,
    maxTTL: number
  ): Promise<void> {
    console.log("Trying to deliver cached messages (DistanceBasedProbabilistic)");
    const now = Date.now();
    for (const [messageId, msg] of this.cachedMessages) {
      if (now - msg.message.timestamp > maxTTL) {
        console.log(`Message ${messageId} expired; removing`);
        this.cachedMessages.delete(messageId);
        this.accessOrder = this.accessOrder.filter(id => id !== messageId);
        continue;
      }

      const targetNode = await findAndPingNode(msg.recipient);
      try {
        if (targetNode) {
          const success = await sendMessage(targetNode, msg.sender, msg.recipient, msg.message);
          if (success) {
            console.log(`Delivered cached message ${messageId} to ${msg.recipient}`);
            this.cachedMessages.delete(messageId);
            this.accessOrder = this.accessOrder.filter(id => id !== messageId);
          } else {
            this.accessOrder = this.accessOrder.filter(id => id !== messageId);
            this.accessOrder.push(messageId);
          }
        } else {
          console.log(`Recipient ${msg.recipient} offline; keeping message ${messageId} in cache`);
          this.accessOrder = this.accessOrder.filter(id => id !== messageId);
          this.accessOrder.push(messageId);
        }
      } catch (error) {
        console.error(`Error delivering cached message ${messageId}:`, error);
      }
    }
  }

  getCachedMessageCount(): number {
    return this.cachedMessages.size;
  }

  clear(): void {
    this.cachedMessages.clear();
    this.accessOrder = [];
  }
}