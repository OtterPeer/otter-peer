import { Node } from './webrtc-rpc';
import { MessageDTO } from '../../app/chat/chatUtils';
import KBucket from './kbucket';
import { WebSocketMessage } from '@/types/types';

export interface ForwardStrategy {
  forward(
    sender: string,
    recipient: string,
    message: MessageDTO | WebSocketMessage,
    buckets: KBucket,
    rpc: {
      sendMessage: (
        node: Node,
        sender: string,
        recipient: string,
        message: MessageDTO | null,
        signalingMessage: WebSocketMessage | null
      ) => Promise<boolean>;
    },
    k: number,
    nodeId: string,
    forwardedMessagesIds: Set<string>,
    originNode: boolean,
    forceForwardingToKPeers: boolean,
    emit: (event: string, data?: any) => void
  ): Promise<void>;
}

export class ForwardToAllCloserForwardStrategy implements ForwardStrategy {
  async forward(
    sender: string,
    recipient: string,
    message: MessageDTO | WebSocketMessage,
    buckets: KBucket,
    rpc: {
      sendMessage: (
        node: Node,
        sender: string,
        recipient: string,
        message: MessageDTO | null,
        signalingMessage: WebSocketMessage | null
      ) => Promise<boolean>;
    },
    k: number,
    nodeId: string,
    forwardedMessagesIds: Set<string>,
    originNode: boolean,
    forceForwardingToKPeers: boolean,
    emit: (event: string, data?: any) => void
  ): Promise<void> {
    const messageId = 'id' in message ? message.id : undefined;
    if (messageId && forwardedMessagesIds.has(messageId)) {
      console.log(`Message ${messageId} already forwarded; skipping`);
      return;
    }
    emit("nodeProcessesMessage");
    const selfDistanceToTarget = KBucket.xorDistance(nodeId, recipient);
    const closest = buckets.closest(recipient, k);

    let peersToForward: Node[];
    if (forceForwardingToKPeers) {
      peersToForward = closest.filter(node => node.id !== sender && node.id !== nodeId);
    } else {
      peersToForward = closest.filter(node => {
        if (node.id === sender || node.id === nodeId) return false;
        const peerDistanceToTarget = KBucket.xorDistance(node.id, recipient);
        return peerDistanceToTarget < selfDistanceToTarget;
      });
    }

    // console.log(`Forwarding message to ${peersToForward.length} peers: ${peersToForward.map(n => n.id).join(', ')}`);

    let forwarded = false;
    try {
      for (const node of peersToForward) {
        emit("sent", { sender, recipient, content: message });
        const isSignaling = !('encryptedMessage' in message); // WebSocketMessage has no 'encryptedMessage'
        await rpc.sendMessage(
          node,
          sender,
          recipient,
          isSignaling ? null : (message as MessageDTO),
          isSignaling ? (message as WebSocketMessage) : null
        );
        emit("forward", { sender: nodeId, recipient: node.id, message });
        // console.log(`Node ${nodeId} forwarding message to ${node.id}`);
        forwarded = true;
      }

      if (messageId) {
        forwardedMessagesIds.add(messageId);
      }

      if (!forwarded) {
        console.log(`No peers available to forward message; ${'content' in message ? 'will cache' : 'skipping cache'}`);
      } else {
        console.log(`Message forwarded`);
      }
    } catch (error) {
      console.error(`Error forwarding message: ${error}`);
      if ('content' in message) {
        // Only cache MessageDTO, not WebSocketMessage
        throw error; // Will trigger cacheMessage in DHT for MessageDTO
      }
    }
  }
}

export class ProbabilisticForwardStrategy implements ForwardStrategy {
  private forwardThreshold: number;

  constructor(forwardThreshold: number = 2 ** 42) {
    this.forwardThreshold = forwardThreshold;
  }

  async forward(
    sender: string,
    recipient: string,
    message: MessageDTO | WebSocketMessage,
    buckets: KBucket,
    rpc: {
      sendMessage: (
        node: Node,
        sender: string,
        recipient: string,
        message: MessageDTO | null,
        signalingMessage: WebSocketMessage | null
      ) => Promise<boolean>;
    },
    k: number,
    nodeId: string,
    forwardedMessagesIds: Set<string>,
    originNode: boolean,
    forceForwardingToKPeers: boolean,
    emit: (event: string, data?: any) => void
  ): Promise<void> {
    const messageId = 'id' in message ? message.id : undefined;
    if (messageId && forwardedMessagesIds.has(messageId)) {
      console.log(`Message ${messageId} already forwarded; skipping`);
      return;
    }
    emit("nodeProcessesMessage");
    const distanceHex = KBucket.xorDistance(nodeId, recipient);
    const distanceHexShort = distanceHex.substring(0, 12);
    const distance = parseInt(distanceHexShort, 16) || 0;

    console.log(`Distance (48 most significant bits): ${distance}`);

    let probability: number;
    if (originNode) {
      probability = 1.0;
    } else {
      probability = this.forwardThreshold / (distance + this.forwardThreshold);
      console.log(`Forward probability: ${probability}`);
    }

    const closest = buckets.closest(recipient, k);
    const selectedPeers = closest.filter(
      node => node.id !== sender && node.id !== nodeId && Math.random() < probability
    );
    console.log(`Forwarding message to selected peers: ${selectedPeers.map(n => n.id)}`);

    let forwarded = false;
    try {
      for (const node of selectedPeers) {
        emit("sent", { sender, recipient, content: message });
        const isSignaling = !('content' in message);
        await rpc.sendMessage(
          node,
          sender,
          recipient,
          isSignaling ? null : (message as MessageDTO),
          isSignaling ? (message as WebSocketMessage) : null
        );
        emit("forward", { sender: nodeId, recipient: node.id, message });
        console.log(`Node ${nodeId} forwarding message to ${node.id}`);
        forwarded = true;
      }

      if (messageId) {
        forwardedMessagesIds.add(messageId);
      }

      if (!forwarded) {
        console.log(`No peers selected to forward message; ${'content' in message ? 'will cache' : 'skipping cache'}`);
      } else {
        console.log(`Message forwarded`);
      }
    } catch (error) {
      console.error(`Error forwarding message: ${error}`);
      if ('content' in message) {
        // Only cache MessageDTO
        throw error;
      }
    }
  }
}
