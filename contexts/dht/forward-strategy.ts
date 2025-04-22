import { Node, RPCMessage } from './webrtc-rpc';
import { MessageDTO } from '../../app/chat/chatUtils'
import KBucket from './kbucket';

export interface ForwardStrategy {
  forward(
    sender: string,
    recipient: string,
    message: MessageDTO,
    buckets: KBucket,
    rpc: { sendMessage: (node: Node, sender: string, recipient: string, message: MessageDTO) => Promise<boolean> },
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
    message: MessageDTO,
    buckets: KBucket,
    rpc: { sendMessage: (node: Node, sender: string, recipient: string, message: MessageDTO) => Promise<boolean> },
    k: number,
    nodeId: string,
    forwardedMessagesIds: Set<string>,
    originNode: boolean,
    forceForwardingToKPeers: boolean,
    emit: (event: string, data?: any) => void
  ): Promise<void> {
    if (!message.id || forwardedMessagesIds.has(message.id)) {
      console.log(`Message ${message.id} already forwarded or no ID; skipping`);
      return;
    }
    emit("nodeProcessesMessage");
    const selfDistanceToTarget = KBucket.xorDistance(nodeId, recipient);
    const closest = buckets.closest(recipient, k);

    forceForwardingToKPeers = false;
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

    console.log(`Forwarding message ${message.id} to ${peersToForward.length} peers: ${peersToForward.map(n => n.id).join(', ')}`);

    let forwarded = false;
    try {
      for (const node of peersToForward) {
        emit("sent", { sender, recipient, content: message });
        await rpc.sendMessage(node, sender, recipient, message);
        emit("forward", { sender: nodeId, recipient: node.id, message });
        console.log(`I'm node ${nodeId} forwarding the message to ${node.id}`);
        forwarded = true;
      }

      forwardedMessagesIds.add(message.id);

      if (!forwarded) {
        console.log(`No peers available to forward message ${message.id}; will cache`);
      } else {
        console.log(`Message forwarded: ${message.id}`);
      }
    } catch (error) {
      console.error(`Error forwarding message: ${error}`);
      throw error;
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
    message: MessageDTO,
    buckets: KBucket,
    rpc: { sendMessage: (node: Node, sender: string, recipient: string, message: MessageDTO) => Promise<boolean> },
    k: number,
    nodeId: string,
    forwardedMessagesIds: Set<string>,
    originNode: boolean,
    forceForwardingToKPeers: boolean,
    emit: (event: string, data?: any) => void
  ): Promise<void> {
    if (!message.id || forwardedMessagesIds.has(message.id)) {
      console.log(`Message ${message.id} already forwarded or no ID; skipping`);
      return;
    }
    emit("nodeProcessesMessage");
    const distanceHex = KBucket.xorDistance(nodeId, recipient);

    const distanceHexShort = distanceHex.substring(0, 12);
    const distance = parseInt(distanceHexShort, 16) || 0;

    console.log(`Distance (48 most significant bits): ${distance}`);

    let probability: number;
    if (originNode) {
        probability = 1.0
    } else {
        console.log(this.forwardThreshold);
        probability = this.forwardThreshold / (distance + this.forwardThreshold);
        console.log(probability);
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
        await rpc.sendMessage(node, sender, recipient, message);
        emit("forward", { sender: nodeId, recipient: node.id, message });
        console.log(`I'm node ${nodeId} forwarding the message to ${node.id}`);
        forwarded = true;
      }
      forwardedMessagesIds.add(message.id);
      if (!forwarded) {
        console.log(`No peers selected to forward message ${message.id}; will cache`);
      }
      console.log(`Message forwarded: ${message.id}`);
    } catch (error) {
      console.error(`Error forwarding message: ${error}`);
      throw error;
    }
  }
}