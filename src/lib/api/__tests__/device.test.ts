import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getDeviceInfo,
  getDeviceConnection,
  getDeviceStats,
  updateDeviceSettings,
  rebootDevice,
  shutdownDevice,
  type DeviceInfo,
  type DeviceConnection,
  type DeviceStats,
} from "../device";
import * as http from "../http";

vi.mock("../http");

describe("Device API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getDeviceInfo", () => {
    it("should fetch and transform device info", async () => {
      const mockApiResponse = {
        connected: true,
        mode: "http",
        device: {
          myNodeNum: 123456789,
          user: {
            id: "!07654321",
            longName: "Test Device",
            shortName: "TEST",
            hwModel: 42, // HELTEC_V3
          },
          firmwareVersion: "2.2.0",
          hasGPS: true,
          hasBluetooth: true,
          region: "US",
          modemPreset: "LONG_FAST",
          role: 0,
        },
      };

      vi.mocked(http.apiGet).mockResolvedValue(mockApiResponse);

      const result = await getDeviceInfo();

      expect(http.apiGet).toHaveBeenCalledWith("/api/device");
      expect(result).toEqual({
        myNodeNum: 123456789,
        nodeId: "!07654321",
        longName: "Test Device",
        shortName: "TEST",
        hwModel: "HELTEC_V3",
        firmwareVersion: "2.2.0",
        hasGPS: true,
        hasBluetooth: true,
        region: "United States",
        modemPreset: "Long Range - Fast",
        role: "CLIENT",
      });
    });

    it("should handle missing optional fields", async () => {
      const mockApiResponse = {
        connected: true,
        mode: "http",
        device: {
          myNodeNum: 123456789,
          user: {
            id: "!07654321",
            longName: "Minimal Device",
            shortName: "MIN",
            hwModel: 0,
          },
        },
      };

      vi.mocked(http.apiGet).mockResolvedValue(mockApiResponse);

      const result = await getDeviceInfo();

      expect(result).toEqual({
        myNodeNum: 123456789,
        nodeId: "!07654321",
        longName: "Minimal Device",
        shortName: "MIN",
        hwModel: "UNSET",
        firmwareVersion: "Unknown",
        hasGPS: false,
        hasBluetooth: false,
        region: "Unknown",
        modemPreset: "Unknown",
        role: "CLIENT",
      });
    });

    it("should handle unknown hardware model", async () => {
      const mockApiResponse = {
        connected: true,
        mode: "http",
        device: {
          myNodeNum: 123,
          user: {
            id: "!00000123",
            longName: "Test",
            shortName: "TST",
            hwModel: 9999,
          },
        },
      };

      vi.mocked(http.apiGet).mockResolvedValue(mockApiResponse);

      const result = await getDeviceInfo();

      expect(result?.hwModel).toBe("UNKNOWN");
    });

    it("should return null on error", async () => {
      vi.mocked(http.apiGet).mockRejectedValue(new Error("Network error"));

      const result = await getDeviceInfo();

      expect(result).toBeNull();
    });
  });

  describe("getDeviceConnection", () => {
    it("should fetch device connection status", async () => {
      const mockApiResponse = {
        connected: true,
        connectionType: "http",
        lastSeen: 1700000000000,
        uptimeSeconds: 86400,
      };

      vi.mocked(http.apiGet).mockResolvedValue(mockApiResponse);

      const result = await getDeviceConnection();

      expect(http.apiGet).toHaveBeenCalledWith("/api/device/connection");
      expect(result).toEqual({
        connected: true,
        type: "http",
        lastSeen: 1700000000000,
        uptime: 86400,
      });
    });

    it("should return disconnected status on error", async () => {
      vi.mocked(http.apiGet).mockRejectedValue(new Error("Connection failed"));

      const result = await getDeviceConnection();

      expect(result.connected).toBe(false);
      expect(result.type).toBeNull();
    });
  });

  describe("getDeviceStats", () => {
    it("should fetch device statistics", async () => {
      const mockApiResponse = {
        messagesReceived: 1234,
        messagesSent: 567,
        nodesInMesh: 42,
        channelUtilization: 15.5,
        airUtilTx: 2.3,
        uptimeSeconds: 172800,
      };

      vi.mocked(http.apiGet).mockResolvedValue(mockApiResponse);

      const result = await getDeviceStats();

      expect(http.apiGet).toHaveBeenCalledWith("/api/device/stats");
      expect(result).toEqual({
        messagesReceived: 1234,
        messagesSent: 567,
        nodesInMesh: 42,
        channelUtilization: 15.5,
        airUtilTx: 2.3,
        uptimeSeconds: 172800,
      });
    });

    it("should handle missing fields with defaults", async () => {
      vi.mocked(http.apiGet).mockResolvedValue({});

      const result = await getDeviceStats();

      expect(result).toEqual({
        messagesReceived: 0,
        messagesSent: 0,
        nodesInMesh: 0,
        channelUtilization: 0,
        airUtilTx: 0,
        uptimeSeconds: 0,
      });
    });

    it("should return null on error", async () => {
      vi.mocked(http.apiGet).mockRejectedValue(new Error("Stats unavailable"));

      const result = await getDeviceStats();

      expect(result).toBeNull();
    });
  });

  describe("updateDeviceSettings", () => {
    it("should update device settings", async () => {
      const settings = {
        longName: "New Name",
        shortName: "NEW",
        region: "EU_868",
        modemPreset: "LONG_SLOW",
      };

      vi.mocked(http.apiPut).mockResolvedValue({});

      const result = await updateDeviceSettings(settings);

      expect(http.apiPut).toHaveBeenCalledWith("/api/device/settings", settings);
      expect(result).toBe(true);
    });

    it("should return false on error", async () => {
      vi.mocked(http.apiPut).mockRejectedValue(new Error("Update failed"));

      const result = await updateDeviceSettings({ longName: "Test" });

      expect(result).toBe(false);
    });
  });

  describe("rebootDevice", () => {
    it("should reboot the device", async () => {
      vi.mocked(http.apiPost).mockResolvedValue({});

      const result = await rebootDevice();

      expect(http.apiPost).toHaveBeenCalledWith("/api/device/reboot", {});
      expect(result).toBe(true);
    });

    it("should return false on error", async () => {
      vi.mocked(http.apiPost).mockRejectedValue(new Error("Reboot failed"));

      const result = await rebootDevice();

      expect(result).toBe(false);
    });
  });

  describe("shutdownDevice", () => {
    it("should shutdown the device", async () => {
      vi.mocked(http.apiPost).mockResolvedValue({});

      const result = await shutdownDevice();

      expect(http.apiPost).toHaveBeenCalledWith("/api/device/shutdown", {});
      expect(result).toBe(true);
    });

    it("should return false on error", async () => {
      vi.mocked(http.apiPost).mockRejectedValue(new Error("Shutdown failed"));

      const result = await shutdownDevice();

      expect(result).toBe(false);
    });
  });
});
