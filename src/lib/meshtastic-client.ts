/**
 * Meshtastic HTTP API Client
 *
 * Handles communication with Meshtastic devices via HTTP API
 * Default port: 4403 (HTTP) or 4413 (HTTPS)
 */

import { Node, Message, Channel } from "@/types";

const API_BASE_URL = process.env.MESHTASTIC_API_URL || "http://localhost:4403";

interface MeshtasticNode {
  num: number;
  user: {
    id: string;
    longName: string;
    shortName: string;
    macaddr?: string;
    hwModel?: string;
  };
  position?: {
    latitude: number;
    longitude: number;
    altitude?: number;
    time?: number;
  };
  snr?: number;
  lastHeard?: number;
  deviceMetrics?: {
    batteryLevel?: number;
    voltage?: number;
    channelUtilization?: number;
    airUtilTx?: number;
  };
}

interface MeshtasticMessage {
  id: number;
  from: number;
  to: number;
  channel: number;
  decoded?: {
    portnum?: string;
    payload?: string;
    text?: string;
  };
  rxTime?: number;
  rxSnr?: number;
  rxRssi?: number;
  hopLimit?: number;
}

class MeshtasticClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Fetch all nodes from the device
   */
  async getNodes(): Promise<Node[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/nodes`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return this.transformNodes(data.nodes || []);
    } catch (error) {
      console.error("Error fetching nodes:", error);
      throw error;
    }
  }

  /**
   * Fetch messages from the device
   */
  async getMessages(limit: number = 100): Promise<Message[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/messages?limit=${limit}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return this.transformMessages(data.messages || []);
    } catch (error) {
      console.error("Error fetching messages:", error);
      throw error;
    }
  }

  /**
   * Send a message to the mesh network
   */
  async sendMessage(text: string, channel: number = 0): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/message/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel,
          text,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  }

  /**
   * Get device information
   */
  async getDeviceInfo() {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/device`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching device info:", error);
      throw error;
    }
  }

  /**
   * Get channels from device
   */
  async getChannels(): Promise<Channel[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/channels`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return this.transformChannels(data.channels || []);
    } catch (error) {
      console.error("Error fetching channels:", error);
      throw error;
    }
  }

  /**
   * Transform Meshtastic node data to our Node type
   */
  private transformNodes(meshtasticNodes: MeshtasticNode[]): Node[] {
    return meshtasticNodes.map((node) => ({
      id: node.user.id || `node-${node.num}`,
      nodeNum: node.num,
      shortName: node.user.shortName || `Node${node.num}`,
      longName: node.user.longName || node.user.shortName || `Node ${node.num}`,
      hwModel: (node.user.hwModel as any) || "UNSET",
      role: this.inferRole(node) as any,
      batteryLevel: node.deviceMetrics?.batteryLevel,
      voltage: node.deviceMetrics?.voltage,
      snr: node.snr,
      position: node.position
        ? {
            latitude: node.position.latitude,
            longitude: node.position.longitude,
            altitude: node.position.altitude,
            time: node.position.time,
          }
        : undefined,
      lastHeard: node.lastHeard || Date.now(),
      hopsAway: 0, // Will be calculated from routing info
      neighborCount: 0, // Will be calculated from neighbor info
    }));
  }

  /**
   * Transform Meshtastic message data to our Message type
   */
  private transformMessages(meshtasticMessages: MeshtasticMessage[]): Message[] {
    return meshtasticMessages
      .filter((msg) => msg.decoded?.text) // Only text messages for now
      .map((msg, index) => ({
        id: `msg-${msg.id || index}`,
        from: msg.from,
        fromNode: `node-${msg.from}`,
        to: msg.to,
        toNode: msg.to === 0 ? "broadcast" : `node-${msg.to}`,
        channel: msg.channel,
        text: msg.decoded?.text || "",
        timestamp: msg.rxTime || Date.now(),
        snr: msg.rxSnr,
        rssi: msg.rxRssi,
        hopLimit: msg.hopLimit,
      }));
  }

  /**
   * Transform Meshtastic channel data to our Channel type
   */
  private transformChannels(meshtasticChannels: any[]): Channel[] {
    return meshtasticChannels.map((channel, index) => ({
      id: `ch-${index}`,
      index,
      name: channel.settings?.name || `Channel ${index}`,
      role: channel.role || "SECONDARY",
      psk: channel.settings?.psk,
      isEncrypted: !!channel.settings?.psk,
      uplinkEnabled: channel.settings?.uplinkEnabled ?? true,
      downlinkEnabled: channel.settings?.downlinkEnabled ?? true,
      unreadCount: 0,
    }));
  }

  /**
   * Infer node role from hardware model or other attributes
   */
  private inferRole(node: MeshtasticNode): string {
    // Default to CLIENT, can be enhanced based on device capabilities
    if (node.user.hwModel?.includes("ROUTER")) return "ROUTER";
    if (node.user.hwModel?.includes("REPEATER")) return "REPEATER";
    return "CLIENT";
  }

  /**
   * Test connection to the device
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/device`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const meshtasticClient = new MeshtasticClient();
export default MeshtasticClient;
