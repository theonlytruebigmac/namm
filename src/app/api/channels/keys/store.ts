/**
 * Channel Keys Store
 *
 * Shared storage for channel keys received from serial devices.
 * Used by both the keys API and the channels API.
 */

import { addChannelKey } from "@/lib/mqtt-processor";

interface ChannelKeyInfo {
  psk: string;
  index: number;
  name: string;
  role: number;
  hasKey: boolean;
}

// In-memory channel key storage
const channelKeys = new Map<number, ChannelKeyInfo>();

/**
 * Store a channel key
 */
export function setChannelKey(index: number, name: string, psk: string, role: number): void {
  const channelName = name || getDefaultChannelName(index);
  const hasKey = !!psk && psk.length > 0;

  channelKeys.set(index, {
    psk,
    index,
    name: channelName,
    role,
    hasKey,
  });

  // Also add to MQTT processor for decryption
  if (hasKey) {
    try {
      addChannelKey(channelName, psk);
      console.log(`[Channel Store] Added key for channel "${channelName}" (index ${index})`);
    } catch (error) {
      console.error(`[Channel Store] Failed to add key for "${channelName}":`, error);
    }
  }
}

/**
 * Get all channel keys
 */
export function getChannelKeys(): Array<{ index: number; name: string; role: number; hasKey: boolean; psk?: string }> {
  return Array.from(channelKeys.values()).map(info => ({
    index: info.index,
    name: info.name,
    role: info.role,
    hasKey: info.hasKey,
    psk: info.psk, // Include PSK for encryption when sending
  }));
}

/**
 * Get a specific channel key
 */
export function getChannelKey(index: number): ChannelKeyInfo | undefined {
  return channelKeys.get(index);
}

/**
 * Clear all channel keys (e.g., when device disconnects)
 */
export function clearChannelKeys(): void {
  channelKeys.clear();
}

/**
 * Get default channel name based on index
 */
function getDefaultChannelName(index: number): string {
  if (index === 0) return "LongFast";
  return `Channel${index}`;
}
