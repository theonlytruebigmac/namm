/**
 * Virtual Nodes System
 * Create simulated nodes for testing and demonstration purposes
 */

export interface VirtualNode {
  id: string;
  nodeNum: number;
  shortName: string;
  longName: string;
  role: "CLIENT" | "ROUTER" | "ROUTER_CLIENT" | "REPEATER";
  position?: {
    latitude: number;
    longitude: number;
    altitude?: number;
  };
  batteryLevel: number;
  voltage: number;
  channelUtilization: number;
  airUtilTx: number;
  snr: number;
  lastHeard: number;
  isVirtual: true;
  createdAt: number;
  movementPattern?: "static" | "random" | "path";
  pathPoints?: { lat: number; lng: number }[];
  pathIndex?: number;
}

export interface VirtualNodeConfig {
  enabled: boolean;
  nodes: VirtualNode[];
  updateInterval: number; // How often to update virtual nodes (ms)
  simulateMessages: boolean;
  simulateTelemetry: boolean;
}

const STORAGE_KEY = "namm-virtual-nodes";

const DEFAULT_CONFIG: VirtualNodeConfig = {
  enabled: false,
  nodes: [],
  updateInterval: 30000, // 30 seconds
  simulateMessages: false,
  simulateTelemetry: true,
};

/**
 * Generate a random node ID
 */
export function generateNodeId(): string {
  const randomNum = Math.floor(Math.random() * 0xffffffff);
  return `!${randomNum.toString(16).padStart(8, "0")}`;
}

/**
 * Generate a random short name (4 chars)
 */
export function generateShortName(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let name = "";
  for (let i = 0; i < 4; i++) {
    name += chars[Math.floor(Math.random() * chars.length)];
  }
  return name;
}

/**
 * Create a new virtual node with default values
 */
export function createVirtualNode(
  overrides: Partial<Omit<VirtualNode, "id" | "nodeNum" | "isVirtual" | "createdAt">> = {}
): VirtualNode {
  const id = generateNodeId();
  const nodeNum = parseInt(id.replace("!", ""), 16);
  const shortName = overrides.shortName || generateShortName();

  return {
    id,
    nodeNum,
    shortName,
    longName: overrides.longName || `Virtual Node ${shortName}`,
    role: overrides.role || "CLIENT",
    position: overrides.position,
    batteryLevel: overrides.batteryLevel ?? Math.floor(Math.random() * 50) + 50,
    voltage: overrides.voltage ?? 3.7 + Math.random() * 0.5,
    channelUtilization: overrides.channelUtilization ?? Math.random() * 20,
    airUtilTx: overrides.airUtilTx ?? Math.random() * 10,
    snr: overrides.snr ?? Math.random() * 15 - 5,
    lastHeard: Date.now(),
    isVirtual: true,
    createdAt: Date.now(),
    movementPattern: overrides.movementPattern || "static",
    pathPoints: overrides.pathPoints,
    pathIndex: overrides.pathIndex ?? 0,
  };
}

/**
 * Get virtual node configuration
 */
export function getVirtualNodeConfig(): VirtualNodeConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error("[VirtualNodes] Failed to load config:", error);
  }
  return DEFAULT_CONFIG;
}

/**
 * Save virtual node configuration
 */
export function saveVirtualNodeConfig(config: VirtualNodeConfig): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    // Notify other components
    window.dispatchEvent(
      new CustomEvent("virtual-nodes-changed", { detail: config })
    );
  } catch (error) {
    console.error("[VirtualNodes] Failed to save config:", error);
  }
}

/**
 * Add a virtual node
 */
export function addVirtualNode(node: VirtualNode): VirtualNodeConfig {
  const config = getVirtualNodeConfig();
  config.nodes.push(node);
  saveVirtualNodeConfig(config);
  return config;
}

/**
 * Update a virtual node
 */
export function updateVirtualNode(
  nodeId: string,
  updates: Partial<VirtualNode>
): VirtualNodeConfig {
  const config = getVirtualNodeConfig();
  const index = config.nodes.findIndex((n) => n.id === nodeId);
  if (index >= 0) {
    config.nodes[index] = { ...config.nodes[index], ...updates };
    saveVirtualNodeConfig(config);
  }
  return config;
}

/**
 * Remove a virtual node
 */
export function removeVirtualNode(nodeId: string): VirtualNodeConfig {
  const config = getVirtualNodeConfig();
  config.nodes = config.nodes.filter((n) => n.id !== nodeId);
  saveVirtualNodeConfig(config);
  return config;
}

/**
 * Toggle virtual nodes enabled state
 */
export function toggleVirtualNodes(enabled: boolean): VirtualNodeConfig {
  const config = getVirtualNodeConfig();
  config.enabled = enabled;
  saveVirtualNodeConfig(config);
  return config;
}

/**
 * Simulate node movement
 */
export function updateNodePosition(node: VirtualNode): VirtualNode {
  if (!node.position) return node;

  switch (node.movementPattern) {
    case "random": {
      // Random walk within ~100m
      const latDelta = (Math.random() - 0.5) * 0.001;
      const lngDelta = (Math.random() - 0.5) * 0.001;
      return {
        ...node,
        position: {
          ...node.position,
          latitude: node.position.latitude + latDelta,
          longitude: node.position.longitude + lngDelta,
        },
        lastHeard: Date.now(),
      };
    }
    case "path": {
      if (node.pathPoints && node.pathPoints.length > 0) {
        const nextIndex = ((node.pathIndex || 0) + 1) % node.pathPoints.length;
        const point = node.pathPoints[nextIndex];
        return {
          ...node,
          position: {
            ...node.position,
            latitude: point.lat,
            longitude: point.lng,
          },
          pathIndex: nextIndex,
          lastHeard: Date.now(),
        };
      }
      return { ...node, lastHeard: Date.now() };
    }
    default:
      return { ...node, lastHeard: Date.now() };
  }
}

/**
 * Simulate telemetry updates
 */
export function updateNodeTelemetry(node: VirtualNode): VirtualNode {
  // Simulate battery drain
  const batteryDrain = Math.random() * 0.1;
  const newBattery = Math.max(0, node.batteryLevel - batteryDrain);

  // Simulate varying channel utilization
  const channelDelta = (Math.random() - 0.5) * 5;
  const newChannelUtil = Math.max(0, Math.min(100, node.channelUtilization + channelDelta));

  // Simulate varying SNR
  const snrDelta = (Math.random() - 0.5) * 2;
  const newSnr = Math.max(-20, Math.min(20, node.snr + snrDelta));

  return {
    ...node,
    batteryLevel: newBattery,
    channelUtilization: newChannelUtil,
    snr: newSnr,
    lastHeard: Date.now(),
  };
}

/**
 * Create preset virtual networks for testing
 */
export function createPresetNetwork(
  preset: "small" | "medium" | "large" | "stress"
): VirtualNode[] {
  const baseLatitude = 38.2527; // Kentucky
  const baseLongitude = -85.7585;

  const createNodeAtPosition = (
    index: number,
    role: VirtualNode["role"],
    latOffset: number,
    lngOffset: number
  ): VirtualNode => {
    return createVirtualNode({
      shortName: `V${index.toString().padStart(3, "0")}`,
      longName: `Virtual Node ${index}`,
      role,
      position: {
        latitude: baseLatitude + latOffset,
        longitude: baseLongitude + lngOffset,
      },
      movementPattern: Math.random() > 0.7 ? "random" : "static",
    });
  };

  switch (preset) {
    case "small":
      return [
        createNodeAtPosition(1, "ROUTER", 0, 0),
        createNodeAtPosition(2, "CLIENT", 0.01, 0.01),
        createNodeAtPosition(3, "CLIENT", -0.01, 0.01),
        createNodeAtPosition(4, "CLIENT", 0, -0.01),
        createNodeAtPosition(5, "CLIENT", 0.02, 0),
      ];

    case "medium":
      const mediumNodes: VirtualNode[] = [];
      // 3 routers
      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2;
        mediumNodes.push(
          createNodeAtPosition(
            i + 1,
            "ROUTER",
            Math.cos(angle) * 0.02,
            Math.sin(angle) * 0.02
          )
        );
      }
      // 12 clients
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const radius = 0.03 + Math.random() * 0.02;
        mediumNodes.push(
          createNodeAtPosition(
            i + 4,
            "CLIENT",
            Math.cos(angle) * radius,
            Math.sin(angle) * radius
          )
        );
      }
      return mediumNodes;

    case "large":
      const largeNodes: VirtualNode[] = [];
      // 5 routers in a line
      for (let i = 0; i < 5; i++) {
        largeNodes.push(
          createNodeAtPosition(i + 1, "ROUTER", 0, i * 0.015 - 0.03)
        );
      }
      // 25 clients scattered
      for (let i = 0; i < 25; i++) {
        const x = (Math.random() - 0.5) * 0.08;
        const y = (Math.random() - 0.5) * 0.08;
        largeNodes.push(createNodeAtPosition(i + 6, "CLIENT", x, y));
      }
      return largeNodes;

    case "stress":
      const stressNodes: VirtualNode[] = [];
      // 100 nodes for stress testing
      for (let i = 0; i < 100; i++) {
        const role = i < 10 ? "ROUTER" : "CLIENT";
        const x = (Math.random() - 0.5) * 0.1;
        const y = (Math.random() - 0.5) * 0.1;
        stressNodes.push(createNodeAtPosition(i + 1, role, x, y));
      }
      return stressNodes;

    default:
      return [];
  }
}

/**
 * Clear all virtual nodes
 */
export function clearVirtualNodes(): VirtualNodeConfig {
  const config = getVirtualNodeConfig();
  config.nodes = [];
  saveVirtualNodeConfig(config);
  return config;
}
