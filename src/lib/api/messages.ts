/**
 * Messages API
 *
 * Real Meshtastic HTTP API integration for messages
 */

import type { Message } from "@/types";
import {
  mockMessages,
  getChannelMessages as getMockChannelMessages,
  getDirectMessages as getMockDirectMessages,
  getDMConversations as getMockDMConversations,
} from "@/lib/mock";
import { delay } from "./client";
import { apiGet, apiPost, apiPatch } from "./http";

const USE_REAL_API = true; // Always use real API

// Type for pre-transformed messages from the API
interface DBMessage {
  id: number;
  fromNode: string;
  toNode: string;
  channel: number;
  text: string;
  timestamp: number;
  snr?: number;
  rssi?: number;
  hopsAway?: number;
  readAt?: number | null;
}

/**
 * Convert pre-transformed DB message to frontend Message type
 */
function transformDBMessage(msg: DBMessage): Message {
  return {
    id: String(msg.id),
    fromNode: msg.fromNode,
    toNode: msg.toNode,
    text: msg.text || "",
    channel: msg.channel,
    timestamp: msg.timestamp,
    status: "delivered",
    readAt: msg.readAt ?? null,
  };
}

/**
 * Fetch all messages with optional limit
 */
export async function getMessages(limit: number = 100): Promise<Message[]> {
  if (USE_REAL_API) {
    try {
      const response = await apiGet<{ messages: DBMessage[] }>(
        `/api/messages?limit=${limit}`
      );

      if (!response.messages || !Array.isArray(response.messages)) {
        console.warn("Invalid messages response format:", response);
        return [];
      }

      return response.messages.map(transformDBMessage);
    } catch (error) {
      console.error(
        "Failed to fetch real messages, falling back to mock data:",
        error
      );
    }
  }

  await delay();
  return mockMessages.slice(-limit);
}

export async function getChannelMessages(channel: number, limit: number = 100): Promise<Message[]> {
  if (USE_REAL_API) {
    try {
      const response = await apiGet<{ messages: DBMessage[] }>(
        `/api/messages?channel=${channel}&limit=${limit}`
      );

      if (!response.messages || !Array.isArray(response.messages)) {
        console.warn("Invalid channel messages response format:", response);
        return [];
      }

      return response.messages.map(transformDBMessage);
    } catch (error) {
      console.error(
        `Failed to fetch channel ${channel} messages, falling back to mock:`,
        error
      );
    }
  }

  await delay();
  return getMockChannelMessages(channel).slice(-limit);
}

/**
 * Search messages by text content
 */
export async function searchMessages(query: string, limit: number = 50): Promise<Message[]> {
  if (!query.trim()) return [];

  try {
    const response = await apiGet<{ messages: DBMessage[] }>(
      `/api/messages?search=${encodeURIComponent(query)}&limit=${limit}`
    );

    if (!response.messages || !Array.isArray(response.messages)) {
      console.warn("Invalid search response format:", response);
      return [];
    }

    return response.messages.map(transformDBMessage);
  } catch (error) {
    console.error("Failed to search messages:", error);
    return [];
  }
}

export async function getDirectMessages(nodeA: string, nodeB: string, limit: number = 100): Promise<Message[]> {
  if (USE_REAL_API) {
    try {
      const response = await apiGet<{ messages: DBMessage[] }>(
        `/api/messages/dm?nodeA=${encodeURIComponent(nodeA)}&nodeB=${encodeURIComponent(nodeB)}&limit=${limit}`
      );

      if (!response.messages || !Array.isArray(response.messages)) {
        console.warn("Invalid DM messages response format:", response);
        return [];
      }

      return response.messages.map(transformDBMessage);
    } catch (error) {
      console.error(
        `Failed to fetch DMs between ${nodeA} and ${nodeB}, falling back to mock:`,
        error
      );
    }
  }

  await delay();
  return getMockDirectMessages(nodeA, nodeB).slice(-limit);
}

export async function getDMConversations(nodeId: string): Promise<{ nodeId: string; lastMessage: Message }[]> {
  if (USE_REAL_API) {
    try {
      const response = await apiGet<{ conversations: { nodeId: string; lastMessage: DBMessage }[] }>(
        `/api/messages/conversations?nodeId=${encodeURIComponent(nodeId)}`
      );

      if (!response.conversations || !Array.isArray(response.conversations)) {
        console.warn("Invalid conversations response format:", response);
        return [];
      }

      return response.conversations.map(conv => ({
        nodeId: conv.nodeId,
        lastMessage: transformDBMessage(conv.lastMessage),
      }));
    } catch (error) {
      console.error(
        `Failed to fetch DM conversations for ${nodeId}, falling back to mock:`,
        error
      );
    }
  }

  await delay();
  return getMockDMConversations(nodeId);
}

/**
 * Send a message via Meshtastic
 */
export async function sendMessage(params: {
  text: string;
  channel: number;
  toNode?: string;
  replyTo?: string;
}): Promise<Message> {
  if (USE_REAL_API) {
    try {
      const response = await apiPost<{ messageId: number; status: string }>(
        "/api/messages",
        {
          text: params.text,
          channel: params.channel,
          to: params.toNode,
        }
      );

      // Return a message object (API might not return full message immediately)
      return {
        id: `${response.messageId || Date.now()}`,
        fromNode: "!local", // Will be replaced by actual node ID
        toNode: params.toNode || "broadcast",
        text: params.text,
        channel: params.channel,
        timestamp: Date.now(),
        status: "sent",
        replyTo: params.replyTo,
      };
    } catch (error) {
      console.error(
        "Failed to send message via API, falling back to mock:",
        error
      );
    }
  }

  await delay(500); // Longer delay for sending

  const message: Message = {
    id: `msg-${Date.now()}`,
    fromNode: "!abcd1234", // Local node
    toNode: params.toNode || "broadcast",
    text: params.text,
    channel: params.channel,
    timestamp: Date.now(),
    status: "pending",
    replyTo: params.replyTo,
  };

  // Simulate delivery
  setTimeout(() => {
    message.status = "delivered";
  }, 1000);

  mockMessages.push(message);

  return message;
}

export async function addReaction(messageId: string, emoji: string): Promise<void> {
  if (USE_REAL_API) {
    try {
      await apiPost(`/api/messages/${messageId}/reactions`, { emoji });
      return;
    } catch (error) {
      console.error(
        `Failed to add reaction to message ${messageId}, falling back to mock:`,
        error
      );
    }
  }

  await delay();
  const message = mockMessages.find(m => m.id === messageId);
  if (message) {
    if (!message.reactions) {
      message.reactions = [];
    }
    const existingReaction = message.reactions.find(r => r.emoji === emoji);
    if (existingReaction) {
      if (!existingReaction.fromNodes.includes("!abcd1234")) {
        existingReaction.fromNodes.push("!abcd1234");
      }
    } else {
      message.reactions.push({
        emoji: emoji as any,
        fromNodes: ["!abcd1234"],
      });
    }
  }
}

/**
 * Mark messages as read
 */
export async function markMessagesAsRead(options: {
  messageIds?: number[];
  channel?: number;
}): Promise<{ success: boolean; updated: number }> {
  try {
    const response = await apiPatch<{ success: boolean; updated: number }>(
      "/api/messages",
      options
    );
    return response;
  } catch (error) {
    console.error("Failed to mark messages as read:", error);
    return { success: false, updated: 0 };
  }
}

/**
 * Mark all messages in a channel as read
 */
export async function markChannelAsRead(channel: number): Promise<{ success: boolean; updated: number }> {
  return markMessagesAsRead({ channel });
}
