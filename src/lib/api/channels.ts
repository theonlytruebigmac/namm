/**
 * Channels API
 *
 * Real Meshtastic HTTP API integration for channel management
 */

import type { Channel } from "@/types";
import { mockChannels } from "@/lib/mock";
import { delay } from "./client";
import { apiGet, apiPost, apiPut, apiDelete } from "./http";
import { transformChannel, transformChannels, type APIChannel } from "./transformers";

const USE_REAL_API = true; // Always use real API

// ============================================================================
// Channel Settings Types
// ============================================================================

export interface ChannelSettings {
  name?: string;
  psk?: string;
  uplinkEnabled?: boolean;
  downlinkEnabled?: boolean;
  moduleSettings?: {
    positionPrecision?: number;
    isClientMuted?: boolean;
  };
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get all channels
 */
export async function getChannels(): Promise<Channel[]> {
  if (USE_REAL_API) {
    try {
      const response = await apiGet<{ channels: APIChannel[] }>("/api/channels");

      if (!response.channels || !Array.isArray(response.channels)) {
        console.warn("Invalid channels response format:", response);
        return [];
      }

      return transformChannels(response.channels);
    } catch (error) {
      console.error("Failed to fetch real channels, falling back to mock data:", error);
    }
  }

  await delay();
  return [...mockChannels];
}

/**
 * Get a single channel by index
 */
export async function getChannel(index: number): Promise<Channel | null> {
  if (USE_REAL_API) {
    try {
      const response = await apiGet<APIChannel>(`/api/channels/${index}`);
      return transformChannel(response);
    } catch (error) {
      console.error(`Failed to fetch channel ${index}:`, error);
      return null;
    }
  }

  await delay();
  return mockChannels.find((c) => c.index === index) || null;
}

/**
 * Mark channel as read
 */
export async function markChannelRead(index: number): Promise<void> {
  if (USE_REAL_API) {
    try {
      await apiPost(`/api/channels/${index}/read`, {});
      return;
    } catch (error) {
      console.error(`Failed to mark channel ${index} as read:`, error);
    }
  }

  await delay();
  const channel = mockChannels.find((c) => c.index === index);
  if (channel) {
    channel.unreadCount = 0;
  }
}

/**
 * Save channel settings
 */
export async function saveChannel(
  index: number,
  settings: ChannelSettings
): Promise<Channel | null> {
  if (USE_REAL_API) {
    try {
      const response = await apiPut<APIChannel>(
        `/api/channels/${index}`,
        settings
      );
      return transformChannel(response);
    } catch (error) {
      console.error(`Failed to save channel ${index}:`, error);
      return null;
    }
  }

  await delay();
  const channel = mockChannels.find((c) => c.index === index);
  if (channel && settings.name) {
    channel.name = settings.name;
  }
  return channel || null;
}

/**
 * Delete a channel (reset to defaults)
 */
export async function deleteChannel(index: number): Promise<boolean> {
  if (USE_REAL_API) {
    try {
      await apiDelete(`/api/channels/${index}`);
      return true;
    } catch (error) {
      console.error(`Failed to delete channel ${index}:`, error);
      return false;
    }
  }

  await delay();
  return true;
}

/**
 * Generate a random PSK for a channel
 */
export async function generateChannelPSK(): Promise<string | null> {
  if (USE_REAL_API) {
    try {
      const response = await apiPost<{ psk: string }>(
        "/api/channels/generate-psk",
        {}
      );
      return response.psk;
    } catch (error) {
      console.error("Failed to generate PSK:", error);
      return null;
    }
  }

  await delay();
  // Generate a mock base64 PSK
  return btoa(Math.random().toString(36).substring(2, 15));
}

/**
 * Get channel URL for sharing
 */
export async function getChannelURL(index: number): Promise<string | null> {
  if (USE_REAL_API) {
    try {
      const response = await apiGet<{ url: string }>(
        `/api/channels/${index}/url`
      );
      return response.url;
    } catch (error) {
      console.error(`Failed to get channel ${index} URL:`, error);
      return null;
    }
  }

  await delay();
  return `https://meshtastic.org/e/#${btoa(`channel-${index}`)}`;
}

/**
 * Import channel from URL
 */
export async function importChannelURL(url: string): Promise<Channel | null> {
  if (USE_REAL_API) {
    try {
      const response = await apiPost<APIChannel>("/api/channels/import", {
        url,
      });
      return transformChannel(response);
    } catch (error) {
      console.error("Failed to import channel URL:", error);
      return null;
    }
  }

  await delay();
  return null;
}
