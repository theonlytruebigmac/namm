import { Message, REACTION_EMOJIS } from "@/types";
import { mockNodes } from "./nodes";

const nodeIds = mockNodes.map(n => n.id);

function randomNodeId(): string {
  return nodeIds[Math.floor(Math.random() * nodeIds.length)];
}

function generateMessages(): Message[] {
  const messages: Message[] = [];
  const now = Date.now();

  // Channel 0 (Primary) messages
  const channel0Texts = [
    "Good morning everyone! 👋",
    "Network looks healthy today",
    "Anyone seeing the packet storm?",
    "Testing from the hilltop",
    "Can someone relay to BOB?",
    "Signal is great here!",
    "Battery at 45%, heading home soon",
    "Weather station showing 72°F",
    "Just updated to latest firmware",
    "CQ CQ CQ anyone copy?",
    "Thanks for the relay!",
    "Heading out for a hike",
    "Router is back online",
    "Nice coverage from up here",
    "Anyone near downtown?",
  ];

  for (let i = 0; i < 50; i++) {
    const fromNode = randomNodeId();
    const timestamp = now - (50 - i) * 600000; // Every 10 minutes

    messages.push({
      id: `msg-ch0-${i}`,
      fromNode,
      toNode: "broadcast",
      text: channel0Texts[i % channel0Texts.length],
      channel: 0,
      timestamp,
      status: "delivered",
      reactions: i % 5 === 0 ? [
        {
          emoji: REACTION_EMOJIS[i % REACTION_EMOJIS.length],
          fromNodes: [randomNodeId(), randomNodeId()],
        }
      ] : undefined,
      replyTo: i > 5 && i % 7 === 0 ? `msg-ch0-${i - 3}` : undefined,
    });
  }

  // Channel 1 (Secondary) messages
  const channel1Texts = [
    "Secondary channel test",
    "Moving to channel 1",
    "Backup comms working",
    "Testing alt channel",
  ];

  for (let i = 0; i < 20; i++) {
    messages.push({
      id: `msg-ch1-${i}`,
      fromNode: randomNodeId(),
      toNode: "broadcast",
      text: channel1Texts[i % channel1Texts.length],
      channel: 1,
      timestamp: now - (20 - i) * 1800000, // Every 30 minutes
      status: "delivered",
    });
  }

  // Direct messages between specific nodes
  const dmPairs = [
    [nodeIds[0], nodeIds[1]],
    [nodeIds[0], nodeIds[3]],
    [nodeIds[2], nodeIds[4]],
  ];

  const dmTexts = [
    "Hey, can you relay my message?",
    "Sure thing!",
    "What's your battery level?",
    "About 60%, should be good for a few hours",
    "Thanks for the info",
    "No problem, happy to help",
    "Did you see that weather station data?",
    "Yeah, looks like rain coming",
    "Better head back then",
    "Good idea, stay safe!",
  ];

  dmPairs.forEach(([a, b], pairIdx) => {
    for (let i = 0; i < 10; i++) {
      const isFromA = i % 2 === 0;
      messages.push({
        id: `dm-${pairIdx}-${i}`,
        fromNode: isFromA ? a : b,
        toNode: isFromA ? b : a,
        text: dmTexts[i],
        channel: 0,
        timestamp: now - (10 - i) * 300000, // Every 5 minutes
        status: "delivered",
      });
    }
  });

  return messages.sort((a, b) => a.timestamp - b.timestamp);
}

export const mockMessages: Message[] = generateMessages();

// Get messages for a specific channel
export function getChannelMessages(channel: number): Message[] {
  return mockMessages.filter(
    m => m.channel === channel && m.toNode === "broadcast"
  );
}

// Get DM messages between two nodes
export function getDirectMessages(nodeA: string, nodeB: string): Message[] {
  return mockMessages.filter(
    m =>
      (m.fromNode === nodeA && m.toNode === nodeB) ||
      (m.fromNode === nodeB && m.toNode === nodeA)
  );
}

// Get all DM conversations for a node
export function getDMConversations(nodeId: string): { nodeId: string; lastMessage: Message }[] {
  const dms = mockMessages.filter(
    m => (m.fromNode === nodeId || m.toNode === nodeId) && m.toNode !== "broadcast"
  );

  const conversations = new Map<string, Message>();

  dms.forEach(m => {
    const otherId = m.fromNode === nodeId ? m.toNode : m.fromNode;
    const existing = conversations.get(otherId);
    if (!existing || m.timestamp > existing.timestamp) {
      conversations.set(otherId, m);
    }
  });

  return Array.from(conversations.entries())
    .map(([nodeId, lastMessage]) => ({ nodeId, lastMessage }))
    .sort((a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp);
}
