/**
 * Device API
 *
 * Real Meshtastic HTTP API integration for device information
 */

import { apiGet, apiPost, apiPut } from "./http";

// ============================================================================
// Device Info Types
// ============================================================================

export interface DeviceInfo {
  myNodeNum: number;
  nodeId: string;
  longName: string;
  shortName: string;
  hwModel: string;
  firmwareVersion: string;
  hasGPS: boolean;
  hasBluetooth: boolean;
  region: string;
  modemPreset: string;
  role: string;
}

export interface DeviceConnection {
  connected: boolean;
  type: "http" | "bluetooth" | "serial" | null;
  lastSeen: number;
  uptime: number;
}

export interface DeviceStats {
  messagesReceived: number;
  messagesSent: number;
  nodesInMesh: number;
  channelUtilization: number;
  airUtilTx: number;
  uptimeSeconds: number;
}

interface APIDeviceInfo {
  myNodeNum: number;
  user: {
    id: string;
    longName: string;
    shortName: string;
    hwModel: number;
  };
  firmwareVersion?: string;
  hasGPS?: boolean;
  hasBluetooth?: boolean;
  region?: string;
  modemPreset?: string;
  role?: number;
}

interface APIDeviceStats {
  messagesReceived?: number;
  messagesSent?: number;
  nodesInMesh?: number;
  channelUtilization?: number;
  airUtilTx?: number;
  uptimeSeconds?: number;
}

// ============================================================================
// Hardware Model & Region Mappings
// ============================================================================

const HW_MODEL_MAP: Record<number, string> = {
  0: "UNSET",
  42: "HELTEC_V3",
  4: "TBEAM",
  9: "RAK4631",
  13: "RAK11200",
  18: "NANO_G2_ULTRA",
  30: "STATION_G2",
  36: "PORTDUINO",
  // Add more as needed
};

const REGION_MAP: Record<string, string> = {
  "US": "United States",
  "EU_433": "Europe 433MHz",
  "EU_868": "Europe 868MHz",
  "CN": "China",
  "JP": "Japan",
  "ANZ": "Australia/New Zealand",
  "KR": "Korea",
  "TW": "Taiwan",
  "RU": "Russia",
  "IN": "India",
  "NZ_865": "New Zealand 865MHz",
  "TH": "Thailand",
  "LORA_24": "2.4GHz",
  "UA_433": "Ukraine 433MHz",
  "UA_868": "Ukraine 868MHz",
};

const MODEM_PRESET_MAP: Record<string, string> = {
  "LONG_FAST": "Long Range - Fast",
  "LONG_SLOW": "Long Range - Slow",
  "VERY_LONG_SLOW": "Very Long Range",
  "MEDIUM_SLOW": "Medium Range - Slow",
  "MEDIUM_FAST": "Medium Range - Fast",
  "SHORT_SLOW": "Short Range - Slow",
  "SHORT_FAST": "Short Range - Fast",
  "LONG_MODERATE": "Long Range - Moderate",
};

const ROLE_MAP: Record<number, string> = {
  0: "CLIENT",
  1: "CLIENT_MUTE",
  2: "ROUTER",
  3: "ROUTER_CLIENT",
  4: "REPEATER",
  5: "TRACKER",
  6: "SENSOR",
};

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get device information
 */
export async function getDeviceInfo(): Promise<DeviceInfo | null> {
  try {
    const response = await apiGet<{
      connected: boolean;
      mode: string;
      device: APIDeviceInfo | null;
      message?: string;
    }>("/api/device");

    // Handle case where device is null (not connected)
    if (!response.device || !response.device.user) {
      return null;
    }

    const deviceData = response.device;

    return {
      myNodeNum: deviceData.myNodeNum,
      nodeId: deviceData.user.id,
      longName: deviceData.user.longName,
      shortName: deviceData.user.shortName,
      hwModel: HW_MODEL_MAP[deviceData.user.hwModel] || "UNKNOWN",
      firmwareVersion: deviceData.firmwareVersion || "Unknown",
      hasGPS: deviceData.hasGPS ?? false,
      hasBluetooth: deviceData.hasBluetooth ?? false,
      region: REGION_MAP[deviceData.region || ""] || deviceData.region || "Unknown",
      modemPreset: MODEM_PRESET_MAP[deviceData.modemPreset || ""] || deviceData.modemPreset || "Unknown",
      role: ROLE_MAP[deviceData.role || 0] || "CLIENT",
    };
  } catch (error) {
    console.error("Failed to fetch device info:", error);
    return null;
  }
}

/**
 * Get device connection status
 */
export async function getDeviceConnection(): Promise<DeviceConnection> {
  try {
    const response = await apiGet<{
      connected: boolean;
      connectionType?: string;
      lastSeen?: number;
      uptimeSeconds?: number;
    }>("/api/device/connection");

    return {
      connected: response.connected,
      type: (response.connectionType as "http" | "bluetooth" | "serial") || "http",
      lastSeen: response.lastSeen || Date.now(),
      uptime: response.uptimeSeconds || 0,
    };
  } catch (error) {
    console.error("Failed to fetch device connection:", error);
    return {
      connected: false,
      type: null,
      lastSeen: Date.now(),
      uptime: 0,
    };
  }
}

/**
 * Get device statistics
 */
export async function getDeviceStats(): Promise<DeviceStats | null> {
  try {
    const response = await apiGet<APIDeviceStats>("/api/device/stats");

    return {
      messagesReceived: response.messagesReceived || 0,
      messagesSent: response.messagesSent || 0,
      nodesInMesh: response.nodesInMesh || 0,
      channelUtilization: response.channelUtilization || 0,
      airUtilTx: response.airUtilTx || 0,
      uptimeSeconds: response.uptimeSeconds || 0,
    };
  } catch (error) {
    console.error("Failed to fetch device stats:", error);
    return null;
  }
}

/**
 * Update device settings
 */
export async function updateDeviceSettings(settings: {
  longName?: string;
  shortName?: string;
  region?: string;
  modemPreset?: string;
}): Promise<boolean> {
  try {
    await apiPut("/api/device/settings", settings);
    return true;
  } catch (error) {
    console.error("Failed to update device settings:", error);
    return false;
  }
}

/**
 * Reboot device
 */
export async function rebootDevice(): Promise<boolean> {
  try {
    await apiPost("/api/device/reboot", {});
    return true;
  } catch (error) {
    console.error("Failed to reboot device:", error);
    return false;
  }
}

/**
 * Shutdown device
 */
export async function shutdownDevice(): Promise<boolean> {
  try {
    await apiPost("/api/device/shutdown", {});
    return true;
  } catch (error) {
    console.error("Failed to shutdown device:", error);
    return false;
  }
}
