import { Node, NodeRole, HardwareModel } from "@/types";

const createNode = (
  num: number,
  shortName: string,
  longName: string,
  role: NodeRole,
  hwModel: HardwareModel,
  options: Partial<Node> = {}
): Node => ({
  id: `!${num.toString(16).padStart(8, "0")}`,
  nodeNum: num,
  shortName,
  longName,
  role,
  hwModel,
  lastHeard: Date.now() - Math.random() * 3600000, // Random time in last hour
  batteryLevel: Math.floor(Math.random() * 40) + 60,
  voltage: 3.7 + Math.random() * 0.5,
  snr: Math.random() * 20 - 5,
  rssi: Math.floor(Math.random() * 50) - 90,
  hopsAway: Math.floor(Math.random() * 3),
  ...options,
});

export const mockNodes: Node[] = [
  // Local node (self)
  createNode(0xabcd1234, "BASE", "Base Station Alpha", "ROUTER", "STATION_G2", {
    hopsAway: 0,
    batteryLevel: 100,
    position: { latitude: 37.7749, longitude: -122.4194, altitude: 10 },
    isFavorite: true,
  }),

  // Nearby routers
  createNode(0xdef56789, "RTR1", "Router One", "ROUTER", "HELTEC_V3", {
    hopsAway: 1,
    position: { latitude: 37.7849, longitude: -122.4094, altitude: 25 },
    isFavorite: true,
  }),
  createNode(0x12345678, "RTR2", "Router Two", "ROUTER_CLIENT", "RAK4631", {
    hopsAway: 1,
    position: { latitude: 37.7649, longitude: -122.4294, altitude: 50 },
  }),

  // Client nodes
  createNode(0x11111111, "JOE", "Joe's Heltec", "CLIENT", "HELTEC_V3", {
    hopsAway: 2,
    position: { latitude: 37.7800, longitude: -122.4100, altitude: 5 },
    isMobile: true,
  }),
  createNode(0x22222222, "SARA", "Sara's T-Beam", "CLIENT", "TBEAM", {
    hopsAway: 2,
    position: { latitude: 37.7700, longitude: -122.4300, altitude: 15 },
  }),
  createNode(0x33333333, "BOB", "Bob's Radio", "CLIENT", "TBEAM_S3_CORE", {
    hopsAway: 3,
    position: { latitude: 37.7600, longitude: -122.4400, altitude: 8 },
  }),
  createNode(0x44444444, "MIKE", "Mike Mobile", "TRACKER", "TLORA_V2", {
    hopsAway: 2,
    isMobile: true,
    position: { latitude: 37.7550, longitude: -122.4250, altitude: 3 },
  }),

  // Repeaters
  createNode(0x55555555, "REP1", "Hilltop Repeater", "REPEATER", "STATION_G2", {
    hopsAway: 1,
    batteryLevel: undefined, // Solar powered
    position: { latitude: 37.7950, longitude: -122.4050, altitude: 200 },
  }),
  createNode(0x66666666, "REP2", "Valley Repeater", "REPEATER", "RAK4631", {
    hopsAway: 2,
    position: { latitude: 37.7450, longitude: -122.4450, altitude: 150 },
  }),

  // Sensors
  createNode(0x77777777, "WX01", "Weather Station 1", "SENSOR", "HELTEC_V3", {
    hopsAway: 2,
    position: { latitude: 37.7850, longitude: -122.4350, altitude: 30 },
  }),

  // More clients for testing
  ...Array.from({ length: 15 }, (_, i) =>
    createNode(
      0x88880000 + i,
      `N${String(i + 1).padStart(2, "0")}`,
      `Node ${i + 1}`,
      (["CLIENT", "CLIENT_MUTE", "TRACKER"] as NodeRole[])[i % 3],
      (["HELTEC_V3", "TBEAM", "RAK4631"] as HardwareModel[])[i % 3],
      {
        hopsAway: Math.floor(Math.random() * 4) + 1,
        position: i % 3 === 0 ? {
          latitude: 37.7749 + (Math.random() - 0.5) * 0.1,
          longitude: -122.4194 + (Math.random() - 0.5) * 0.1,
          altitude: Math.floor(Math.random() * 100),
        } : undefined,
      }
    )
  ),
];

// Helper to get node by ID
export function getNodeById(id: string): Node | undefined {
  return mockNodes.find(n => n.id === id);
}

// Helper to get node by nodeNum
export function getNodeByNum(num: number): Node | undefined {
  return mockNodes.find(n => n.nodeNum === num);
}
