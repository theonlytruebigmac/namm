import { describe, it, expect } from "vitest";
import {
  transformNode,
  transformNodes,
  transformMessage,
  transformMessages,
  transformChannel,
  transformChannels,
  createNodeIdMap,
  parseNodeId,
  formatNodeId,
  type APINode,
  type APIMessage,
  type APIChannel,
} from "../transformers";
import type { Node } from "@/types";

describe("Node Transformers", () => {
  describe("transformNode", () => {
    it("should transform complete API node to frontend Node", () => {
      const apiNode: APINode = {
        nodeNum: 3748821076,
        user: {
          id: "!df727854",
          longName: "Test Node",
          shortName: "TEST",
          hwModel: 42, // HELTEC_V3
          role: 0, // CLIENT
        },
        position: {
          latitudeI: 374530000, // 37.453
          longitudeI: -1224400000, // -122.44
          altitude: 100,
          time: 1700000000,
        },
        deviceMetrics: {
          batteryLevel: 95,
          voltage: 4.2,
          channelUtilization: 15.5,
          airUtilTx: 2.3,
          uptimeSeconds: 86400,
        },
        lastHeard: 1700000000,
        snr: 8.5,
        rssi: -85,
        hopsAway: 2,
      };

      const node = transformNode(apiNode);

      expect(node).toEqual({
        id: "!df727854",
        nodeNum: 3748821076,
        shortName: "TEST",
        longName: "Test Node",
        hwModel: "HELTEC_V3",
        role: "CLIENT",
        batteryLevel: 95,
        voltage: 4.2,
        channelUtilization: 15.5,
        airUtilTx: 2.3,
        uptime: 86400,
        lastHeard: 1700000000000,
        snr: 8.5,
        rssi: -85,
        position: {
          latitude: 37.453,
          longitude: -122.44,
          altitude: 100,
          timestamp: 1700000000000,
        },
        hopsAway: 2,
        isFavorite: false,
      });
    });

    it("should handle node without optional fields", () => {
      const apiNode: APINode = {
        nodeNum: 123456,
        user: {
          id: "!00000123",
          longName: "Minimal Node",
          shortName: "MIN",
          hwModel: 0, // UNSET
        },
      };

      const node = transformNode(apiNode);

      expect(node.id).toBe("!00000123");
      expect(node.nodeNum).toBe(123456);
      expect(node.hwModel).toBe("UNSET");
      expect(node.role).toBe("CLIENT");
      expect(node.position).toBeUndefined();
      expect(node.batteryLevel).toBeUndefined();
      expect(node.snr).toBeUndefined();
      expect(node.rssi).toBeUndefined();
    });

    it("should handle unknown hardware model", () => {
      const apiNode: APINode = {
        nodeNum: 123456,
        user: {
          id: "!00000123",
          longName: "Unknown HW",
          shortName: "UNK",
          hwModel: 9999, // Unknown
        },
      };

      const node = transformNode(apiNode);
      expect(node.hwModel).toBe("UNSET");
    });

    it("should handle unknown role", () => {
      const apiNode: APINode = {
        nodeNum: 123456,
        user: {
          id: "!00000123",
          longName: "Test",
          shortName: "TST",
          hwModel: 42,
          role: 9999, // Unknown
        },
      };

      const node = transformNode(apiNode);
      expect(node.role).toBe("CLIENT");
    });

    it("should convert position coordinates correctly", () => {
      const apiNode: APINode = {
        nodeNum: 123456,
        user: {
          id: "!00000123",
          longName: "Test",
          shortName: "TST",
          hwModel: 42,
        },
        position: {
          latitudeI: 400000000, // 40.0
          longitudeI: -740000000, // -74.0
          altitude: 50,
        },
      };

      const node = transformNode(apiNode);
      expect(node.position?.latitude).toBe(40.0);
      expect(node.position?.longitude).toBe(-74.0);
      expect(node.position?.altitude).toBe(50);
    });

    it("should handle missing shortName and longName", () => {
      const apiNode: APINode = {
        nodeNum: 123456,
        user: {
          id: "!00000123",
          longName: "",
          shortName: "",
          hwModel: 42,
        },
      };

      const node = transformNode(apiNode);
      expect(node.shortName).toBe("Unknown");
      expect(node.longName).toBe("Unknown Node");
    });
  });

  describe("transformNodes", () => {
    it("should transform multiple nodes", () => {
      const apiNodes: APINode[] = [
        {
          nodeNum: 1,
          user: {
            id: "!00000001",
            longName: "Node 1",
            shortName: "N1",
            hwModel: 42,
          },
        },
        {
          nodeNum: 2,
          user: {
            id: "!00000002",
            longName: "Node 2",
            shortName: "N2",
            hwModel: 9,
          },
        },
      ];

      const nodes = transformNodes(apiNodes);
      expect(nodes).toHaveLength(2);
      expect(nodes[0].id).toBe("!00000001");
      expect(nodes[0].hwModel).toBe("HELTEC_V3");
      expect(nodes[1].id).toBe("!00000002");
      expect(nodes[1].hwModel).toBe("RAK4631");
    });

    it("should return empty array for empty input", () => {
      const nodes = transformNodes([]);
      expect(nodes).toEqual([]);
    });
  });
});

describe("Message Transformers", () => {
  describe("transformMessage", () => {
    it("should transform API message with node ID map", () => {
      const apiMessage: APIMessage = {
        id: 12345,
        from: 3748821076,
        to: 987654321,
        channel: 0,
        payload: {
          text: "Hello World",
        },
        rxTime: 1700000000,
        hopStart: 3,
        hopLimit: 7,
      };

      const nodeIdMap = new Map([
        [3748821076, "!df727854"],
        [987654321, "!3ade68b1"],
      ]);

      const message = transformMessage(apiMessage, nodeIdMap);

      expect(message).toEqual({
        id: "12345",
        fromNode: "!df727854",
        toNode: "!3ade68b1",
        text: "Hello World",
        channel: 0,
        timestamp: 1700000000000,
        hopStart: 3,
        hopLimit: 7,
        status: "delivered",
      });
    });

    it("should handle broadcast message", () => {
      const apiMessage: APIMessage = {
        id: 12345,
        from: 123456,
        to: 0xffffffff,
        channel: 0,
        payload: {
          text: "Broadcast",
        },
        rxTime: 1700000000,
      };

      const message = transformMessage(apiMessage);
      expect(message.toNode).toBe("broadcast");
    });

    it("should generate hex IDs when no node ID map provided", () => {
      const apiMessage: APIMessage = {
        id: 12345,
        from: 3748821076,
        to: 987654321,
        channel: 0,
        payload: {
          text: "Test",
        },
        rxTime: 1700000000,
      };

      const message = transformMessage(apiMessage);
      expect(message.fromNode).toBe("!df727854");
      expect(message.toNode).toBe("!3ade68b1");
    });

    it("should handle message without text payload", () => {
      const apiMessage: APIMessage = {
        id: 12345,
        from: 123456,
        to: 654321,
        channel: 0,
        rxTime: 1700000000,
      };

      const message = transformMessage(apiMessage);
      expect(message.text).toBe("");
    });
  });

  describe("transformMessages", () => {
    it("should transform multiple messages", () => {
      const apiMessages: APIMessage[] = [
        {
          id: 1,
          from: 123,
          to: 456,
          channel: 0,
          payload: { text: "Message 1" },
          rxTime: 1700000000,
        },
        {
          id: 2,
          from: 456,
          to: 123,
          channel: 0,
          payload: { text: "Message 2" },
          rxTime: 1700000001,
        },
      ];

      const messages = transformMessages(apiMessages);
      expect(messages).toHaveLength(2);
      expect(messages[0].text).toBe("Message 1");
      expect(messages[1].text).toBe("Message 2");
    });
  });
});

describe("Channel Transformers", () => {
  describe("transformChannel", () => {
    it("should transform API channel with all settings", () => {
      const apiChannel: APIChannel = {
        index: 0,
        settings: {
          name: "Primary Channel",
          psk: "base64encodedkey",
          uplinkEnabled: true,
          downlinkEnabled: true,
        },
        role: 1,
      };

      const channel = transformChannel(apiChannel);

      expect(channel).toEqual({
        id: "channel-0",
        index: 0,
        name: "Primary Channel",
        psk: "base64encodedkey",
        isEncrypted: true,
        uplinkEnabled: true,
        downlinkEnabled: true,
        unreadCount: 0,
      });
    });

    it("should handle channel without name", () => {
      const apiChannel: APIChannel = {
        index: 3,
        settings: {},
        role: 2,
      };

      const channel = transformChannel(apiChannel);
      expect(channel.name).toBe("Channel 3");
    });

    it("should detect unencrypted channel", () => {
      const apiChannel: APIChannel = {
        index: 0,
        settings: {
          name: "Open Channel",
          psk: "",
        },
        role: 1,
      };

      const channel = transformChannel(apiChannel);
      expect(channel.isEncrypted).toBe(false);
    });

    it("should default link settings to true", () => {
      const apiChannel: APIChannel = {
        index: 0,
        settings: {
          name: "Test",
        },
        role: 1,
      };

      const channel = transformChannel(apiChannel);
      expect(channel.uplinkEnabled).toBe(true);
      expect(channel.downlinkEnabled).toBe(true);
    });
  });

  describe("transformChannels", () => {
    it("should transform multiple channels", () => {
      const apiChannels: APIChannel[] = [
        {
          index: 0,
          settings: { name: "Primary" },
          role: 1,
        },
        {
          index: 1,
          settings: { name: "Secondary" },
          role: 2,
        },
      ];

      const channels = transformChannels(apiChannels);
      expect(channels).toHaveLength(2);
      expect(channels[0].name).toBe("Primary");
      expect(channels[1].name).toBe("Secondary");
    });
  });
});

describe("Utility Functions", () => {
  describe("createNodeIdMap", () => {
    it("should create map from nodes", () => {
      const nodes: Node[] = [
        {
          id: "!df727854",
          nodeNum: 3748821076,
          shortName: "TEST1",
          longName: "Test Node 1",
          hwModel: "HELTEC_V3",
          role: "CLIENT",
          lastHeard: Date.now(),
        },
        {
          id: "!3ade68b1",
          nodeNum: 987654321,
          shortName: "TEST2",
          longName: "Test Node 2",
          hwModel: "RAK4631",
          role: "ROUTER",
          lastHeard: Date.now(),
        },
      ];

      const map = createNodeIdMap(nodes);
      expect(map.get(3748821076)).toBe("!df727854");
      expect(map.get(987654321)).toBe("!3ade68b1");
    });

    it("should handle empty array", () => {
      const map = createNodeIdMap([]);
      expect(map.size).toBe(0);
    });
  });

  describe("parseNodeId", () => {
    it("should parse node ID with exclamation mark", () => {
      const nodeNum = parseNodeId("!df6ab854");
      expect(nodeNum).toBe(3748313172);
    });

    it("should parse node ID without exclamation mark", () => {
      const nodeNum = parseNodeId("df6ab854");
      expect(nodeNum).toBe(3748313172);
    });

    it("should parse lowercase hex", () => {
      const nodeNum = parseNodeId("!abcdef01");
      expect(nodeNum).toBe(2882400001);
    });

    it("should parse uppercase hex", () => {
      const nodeNum = parseNodeId("!ABCDEF01");
      expect(nodeNum).toBe(2882400001);
    });
  });

  describe("formatNodeId", () => {
    it("should format node number as hex ID", () => {
      const id = formatNodeId(3748821076);
      expect(id).toBe("!df727854");
    });

    it("should pad with zeros", () => {
      const id = formatNodeId(255);
      expect(id).toBe("!000000ff");
    });

    it("should handle large numbers", () => {
      const id = formatNodeId(0xffffffff);
      expect(id).toBe("!ffffffff");
    });
  });
});
