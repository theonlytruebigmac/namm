/**
 * LoRa Coverage Estimation
 *
 * Provides realistic coverage estimates based on:
 * - Node positions and spacing (infer urban/suburban/rural)
 * - SNR readings (signal quality indicates environment)
 * - Node roles (routers/repeaters typically have better placement)
 * - Real-world LoRa performance data
 *
 * Reference ranges for 915MHz LoRa @ SF10/125kHz (Meshtastic Long Fast):
 * - Dense Urban: 0.5-2 km (buildings, interference)
 * - Urban: 1.5-4 km (moderate buildings)
 * - Suburban: 3-8 km (lower density)
 * - Rural: 5-15 km (open terrain)
 * - Line-of-sight: 15-50+ km (elevated, unobstructed)
 */

import type { Node, NodeRole } from "@/types/node";

// Environment types based on node density and signal quality
export type EnvironmentType = "dense-urban" | "urban" | "suburban" | "rural" | "open";

// Base ranges in km for each environment (typical Meshtastic Long Fast)
export const ENVIRONMENT_RANGES: Record<EnvironmentType, { min: number; typical: number; max: number }> = {
  "dense-urban": { min: 0.3, typical: 1.0, max: 2.0 },
  "urban": { min: 1.0, typical: 2.5, max: 4.0 },
  "suburban": { min: 2.0, typical: 5.0, max: 8.0 },
  "rural": { min: 4.0, typical: 8.0, max: 15.0 },
  "open": { min: 8.0, typical: 15.0, max: 40.0 },
};

// Role bonuses - routers/repeaters usually have better antenna placement
export const ROLE_RANGE_MULTIPLIER: Record<NodeRole, number> = {
  ROUTER: 1.3,
  ROUTER_CLIENT: 1.2,
  REPEATER: 1.4,
  CLIENT: 1.0,
  CLIENT_MUTE: 1.0,
  CLIENT_HIDDEN: 1.0,
  TRACKER: 0.9, // Usually mobile, lower power
  SENSOR: 0.8, // Often embedded, compact antenna
  TAK: 1.0,
  TAK_TRACKER: 0.9,
  LOST_AND_FOUND: 0.7, // Low power mode
};

// SNR thresholds for environment inference
const SNR_THRESHOLDS = {
  excellent: 7,   // SNR > 7 = clear signal, likely open/rural
  good: 3,        // SNR 3-7 = decent signal, suburban
  fair: -3,       // SNR -3 to 3 = moderate interference, urban
  poor: -10,      // SNR < -10 = heavy interference, dense urban
};

export interface CoverageEstimate {
  environment: EnvironmentType;
  environmentConfidence: number; // 0-1
  totalCoverageKm2: number;
  effectiveRadiusKm: number;
  perNodeCoverageKm2: number;
  networkSpanKm: number;
  analysis: {
    avgNodeSpacingKm: number;
    avgSnr: number | null;
    routerCount: number;
    mobileNodeCount: number;
    inferenceMethod: string;
  };
  recommendations: string[];
}

/**
 * Calculate distance between two points using Haversine formula
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate average distance between nearest neighbors
 */
function calculateAverageNodeSpacing(nodes: Node[]): number {
  const nodesWithPos = nodes.filter(n => n.position);
  if (nodesWithPos.length < 2) return 0;

  let totalMinDistance = 0;
  let count = 0;

  for (const node of nodesWithPos) {
    let minDistance = Infinity;
    for (const other of nodesWithPos) {
      if (node.id === other.id) continue;
      const dist = haversineDistance(
        node.position!.latitude,
        node.position!.longitude,
        other.position!.latitude,
        other.position!.longitude
      );
      minDistance = Math.min(minDistance, dist);
    }
    if (minDistance !== Infinity) {
      totalMinDistance += minDistance;
      count++;
    }
  }

  return count > 0 ? totalMinDistance / count : 0;
}

/**
 * Infer environment type from node data
 */
function inferEnvironment(nodes: Node[]): { type: EnvironmentType; confidence: number; method: string } {
  const nodesWithPos = nodes.filter(n => n.position);
  if (nodesWithPos.length === 0) {
    return { type: "suburban", confidence: 0.2, method: "default (no data)" };
  }

  // Factor 1: Average node spacing
  const avgSpacing = calculateAverageNodeSpacing(nodes);

  // Factor 2: Average SNR (if available)
  const nodesWithSnr = nodes.filter(n => n.snr !== undefined);
  const avgSnr = nodesWithSnr.length > 0
    ? nodesWithSnr.reduce((sum, n) => sum + (n.snr || 0), 0) / nodesWithSnr.length
    : null;

  // Factor 3: Node roles (high router ratio = planned deployment, likely better placement)
  const routerRatio = nodes.filter(n =>
    n.role === "ROUTER" || n.role === "ROUTER_CLIENT" || n.role === "REPEATER"
  ).length / nodes.length;

  let environmentScore = 0; // -2 (dense urban) to +2 (open)
  let confidence = 0.5;
  const methods: string[] = [];

  // Spacing analysis (primary factor)
  if (avgSpacing > 0) {
    if (avgSpacing < 0.8) {
      environmentScore -= 1.5;
      methods.push(`spacing ${avgSpacing.toFixed(1)}km (dense)`);
    } else if (avgSpacing < 2.0) {
      environmentScore -= 0.5;
      methods.push(`spacing ${avgSpacing.toFixed(1)}km (urban)`);
    } else if (avgSpacing < 5.0) {
      environmentScore += 0.5;
      methods.push(`spacing ${avgSpacing.toFixed(1)}km (suburban)`);
    } else if (avgSpacing < 10.0) {
      environmentScore += 1.0;
      methods.push(`spacing ${avgSpacing.toFixed(1)}km (rural)`);
    } else {
      environmentScore += 1.5;
      methods.push(`spacing ${avgSpacing.toFixed(1)}km (open)`);
    }
    confidence += 0.2;
  }

  // SNR analysis (secondary factor)
  if (avgSnr !== null) {
    if (avgSnr > SNR_THRESHOLDS.excellent) {
      environmentScore += 0.8;
      methods.push(`SNR ${avgSnr.toFixed(1)} (excellent)`);
    } else if (avgSnr > SNR_THRESHOLDS.good) {
      environmentScore += 0.3;
      methods.push(`SNR ${avgSnr.toFixed(1)} (good)`);
    } else if (avgSnr > SNR_THRESHOLDS.fair) {
      environmentScore -= 0.3;
      methods.push(`SNR ${avgSnr.toFixed(1)} (fair)`);
    } else {
      environmentScore -= 0.8;
      methods.push(`SNR ${avgSnr.toFixed(1)} (poor)`);
    }
    confidence += 0.15;
  }

  // Router ratio (minor factor - well-planned networks have more routers)
  if (routerRatio > 0.3) {
    environmentScore += 0.2; // Likely better antenna placement
    methods.push(`${Math.round(routerRatio * 100)}% routers`);
  }

  // Map score to environment type
  let type: EnvironmentType;
  if (environmentScore <= -1.2) {
    type = "dense-urban";
  } else if (environmentScore <= -0.3) {
    type = "urban";
  } else if (environmentScore <= 0.6) {
    type = "suburban";
  } else if (environmentScore <= 1.2) {
    type = "rural";
  } else {
    type = "open";
  }

  return {
    type,
    confidence: Math.min(confidence, 0.95),
    method: methods.join(", ") || "insufficient data"
  };
}

/**
 * Calculate effective range for a single node
 */
function calculateNodeRange(node: Node, environment: EnvironmentType): number {
  const baseRange = ENVIRONMENT_RANGES[environment].typical;

  // Apply role multiplier
  const roleMultiplier = ROLE_RANGE_MULTIPLIER[node.role] || 1.0;

  // SNR adjustment (-15 to +10 typical range)
  let snrMultiplier = 1.0;
  if (node.snr !== undefined) {
    // Map SNR to multiplier: -15 → 0.6, 0 → 1.0, +10 → 1.4
    snrMultiplier = 0.6 + Math.min(Math.max((node.snr + 15) / 25, 0), 1) * 0.8;
  }

  // Altitude bonus (if available)
  let altitudeMultiplier = 1.0;
  if (node.position?.altitude && node.position.altitude > 50) {
    // Every 100m of altitude adds ~5% range (simplified)
    altitudeMultiplier = 1 + Math.min(node.position.altitude / 2000, 0.5);
  }

  return baseRange * roleMultiplier * snrMultiplier * altitudeMultiplier;
}

/**
 * Calculate network bounding box span
 */
function calculateNetworkSpan(nodes: Node[]): number {
  const nodesWithPos = nodes.filter(n => n.position);
  if (nodesWithPos.length < 2) return 0;

  const lats = nodesWithPos.map(n => n.position!.latitude);
  const lons = nodesWithPos.map(n => n.position!.longitude);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const centerLat = (minLat + maxLat) / 2;

  const latSpan = (maxLat - minLat) * 111; // km
  const lonSpan = (maxLon - minLon) * 111 * Math.cos(centerLat * Math.PI / 180); // km

  return Math.sqrt(latSpan * latSpan + lonSpan * lonSpan); // Diagonal
}

/**
 * Main coverage estimation function
 */
export function estimateCoverage(nodes: Node[]): CoverageEstimate {
  const nodesWithPos = nodes.filter(n => n.position);

  // Infer environment
  const { type: environment, confidence, method } = inferEnvironment(nodes);

  // Calculate per-node ranges
  const nodeRanges = nodesWithPos.map(n => calculateNodeRange(n, environment));
  const avgNodeRange = nodeRanges.length > 0
    ? nodeRanges.reduce((a, b) => a + b, 0) / nodeRanges.length
    : ENVIRONMENT_RANGES[environment].typical;

  // Calculate coverage using circular area with overlap reduction
  // When nodes overlap, we apply a reduction factor
  const avgSpacing = calculateAverageNodeSpacing(nodes);
  const overlapFactor = avgSpacing > 0
    ? Math.min(avgSpacing / (avgNodeRange * 2), 1) // If spacing < 2*range, there's overlap
    : 1;

  // Per-node coverage area (π * r²)
  const perNodeArea = Math.PI * avgNodeRange * avgNodeRange;

  // Total coverage with overlap reduction
  // Also consider that nodes at edges extend coverage beyond the network span
  const networkSpan = calculateNetworkSpan(nodes);
  const nodeCount = nodesWithPos.length;

  let totalCoverage: number;
  if (nodeCount === 0) {
    totalCoverage = 0;
  } else if (nodeCount === 1) {
    totalCoverage = perNodeArea;
  } else {
    // Coverage = sum of node areas, adjusted for overlap
    const rawTotal = nodeCount * perNodeArea;
    // Apply overlap reduction (sqrt to prevent over-reduction)
    totalCoverage = rawTotal * Math.sqrt(overlapFactor);

    // Cap at reasonable maximum (can't cover more than extended bounding box)
    const maxCoverage = Math.PI * Math.pow(networkSpan / 2 + avgNodeRange, 2);
    totalCoverage = Math.min(totalCoverage, maxCoverage);
  }

  // Calculate stats
  const nodesWithSnr = nodes.filter(n => n.snr !== undefined);
  const avgSnr = nodesWithSnr.length > 0
    ? nodesWithSnr.reduce((sum, n) => sum + (n.snr || 0), 0) / nodesWithSnr.length
    : null;

  const routerCount = nodes.filter(n =>
    n.role === "ROUTER" || n.role === "ROUTER_CLIENT" || n.role === "REPEATER"
  ).length;

  const mobileCount = nodes.filter(n => n.isMobile || n.role === "TRACKER").length;

  // Generate recommendations
  const recommendations: string[] = [];

  if (nodeCount < 3) {
    recommendations.push("Add more nodes for better coverage estimates");
  }
  if (avgSpacing > 0 && avgSpacing > avgNodeRange * 1.5) {
    recommendations.push("Consider adding nodes - current spacing may have gaps");
  }
  if (routerCount === 0 && nodeCount > 3) {
    recommendations.push("No routers detected - adding a router improves mesh reliability");
  }
  if (avgSnr !== null && avgSnr < SNR_THRESHOLDS.fair) {
    recommendations.push("Low average SNR - consider antenna upgrades or repositioning");
  }
  if (environment === "dense-urban" && routerCount < nodeCount / 4) {
    recommendations.push("Dense urban area - more routers/repeaters recommended");
  }

  return {
    environment,
    environmentConfidence: confidence,
    totalCoverageKm2: Math.round(totalCoverage * 10) / 10,
    effectiveRadiusKm: Math.round(avgNodeRange * 10) / 10,
    perNodeCoverageKm2: Math.round(perNodeArea * 10) / 10,
    networkSpanKm: Math.round(networkSpan * 10) / 10,
    analysis: {
      avgNodeSpacingKm: Math.round(avgSpacing * 100) / 100,
      avgSnr,
      routerCount,
      mobileNodeCount: mobileCount,
      inferenceMethod: method,
    },
    recommendations,
  };
}

/**
 * Get human-readable environment description
 */
export function getEnvironmentDescription(env: EnvironmentType): string {
  const descriptions: Record<EnvironmentType, string> = {
    "dense-urban": "Dense Urban (downtown, high-rises)",
    "urban": "Urban (city residential/commercial)",
    "suburban": "Suburban (neighborhoods, light commercial)",
    "rural": "Rural (farmland, low density)",
    "open": "Open (hilltops, water, line-of-sight)",
  };
  return descriptions[env];
}

/**
 * Get expected range for an environment
 */
export function getExpectedRange(env: EnvironmentType): string {
  const range = ENVIRONMENT_RANGES[env];
  return `${range.min}-${range.max} km typical`;
}

// ============================================================================
// ROUTE-BASED CONNECTIVITY ANALYSIS
// ============================================================================

/**
 * A confirmed link between two nodes (from traceroute or message data)
 */
export interface NodeLink {
  nodeA: string;
  nodeB: string;
  snr?: number; // Average SNR on this link
  rssi?: number;
  distance?: number; // km (if both nodes have position)
  seenCount: number; // How many times this link was observed
  lastSeen: number;
  bidirectional: boolean; // True if traffic seen in both directions
}

/**
 * Traceroute data for connectivity analysis
 */
export interface TracerouteData {
  fromId: string;
  toId: string;
  route: number[]; // Node numbers in the path
  snrTowards?: number[];
  snrBack?: number[];
  timestamp: number;
  success: boolean;
}

/**
 * Message routing data
 */
export interface MessageRoutingData {
  fromNode: string;
  toNode: string;
  hopsAway?: number;
  snr?: number;
  rssi?: number;
  timestamp: number;
}

/**
 * Network connectivity graph
 */
export interface ConnectivityGraph {
  links: NodeLink[];
  nodeConnections: Map<string, string[]>; // Node ID -> connected node IDs
  hubNodes: string[]; // Nodes with many connections (likely good relay points)
  bridgeNodes: string[]; // Nodes that connect otherwise separate clusters
  isolatedNodes: string[]; // Nodes with no confirmed connections
  overlappingPairs: Array<{ nodeA: string; nodeB: string; sharedNeighbors: string[] }>;
}

/**
 * Extended coverage estimate with route data
 */
export interface EnhancedCoverageEstimate extends CoverageEstimate {
  connectivity: {
    confirmedLinks: number;
    avgLinksPerNode: number;
    hubNodes: string[];
    bridgeNodes: string[];
    overlappingCoverage: number; // Percentage of nodes with shared neighbors
    networkConnectivity: number; // 0-1 score (1 = fully connected mesh)
  };
  linkDistances: {
    min: number;
    max: number;
    avg: number;
    measuredLinks: number;
  };
}

/**
 * Convert node number to hex ID format
 */
function nodeNumToId(num: number): string {
  return "!" + num.toString(16).padStart(8, "0");
}

/**
 * Build a connectivity graph from traceroute and message data
 */
export function buildConnectivityGraph(
  nodes: Node[],
  traceroutes: TracerouteData[],
  messages: MessageRoutingData[] = []
): ConnectivityGraph {
  const linksMap = new Map<string, NodeLink>();
  const nodeConnections = new Map<string, Set<string>>();

  // Initialize node connections
  for (const node of nodes) {
    nodeConnections.set(node.id, new Set());
  }

  // Helper to get or create a link key (alphabetically sorted for consistency)
  const getLinkKey = (a: string, b: string) => [a, b].sort().join("<->");

  // Helper to update a link
  const updateLink = (
    nodeA: string,
    nodeB: string,
    snr?: number,
    rssi?: number,
    timestamp?: number,
    isReverse = false
  ) => {
    const key = getLinkKey(nodeA, nodeB);
    const existing = linksMap.get(key);

    if (existing) {
      existing.seenCount++;
      if (timestamp && timestamp > existing.lastSeen) {
        existing.lastSeen = timestamp;
      }
      if (snr !== undefined) {
        existing.snr = existing.snr !== undefined
          ? (existing.snr + snr) / 2 // Running average
          : snr;
      }
      if (isReverse) {
        existing.bidirectional = true;
      }
    } else {
      linksMap.set(key, {
        nodeA,
        nodeB,
        snr,
        rssi,
        seenCount: 1,
        lastSeen: timestamp || Date.now(),
        bidirectional: false,
      });
    }

    // Update node connections
    nodeConnections.get(nodeA)?.add(nodeB);
    nodeConnections.get(nodeB)?.add(nodeA);
  };

  // Process traceroutes - these give us explicit route paths
  for (const tr of traceroutes) {
    if (!tr.success || tr.route.length < 2) continue;

    // Extract links from the route path
    // Route format is typically: [from, hop1, hop2, ..., to] as node numbers
    for (let i = 0; i < tr.route.length - 1; i++) {
      const nodeA = nodeNumToId(tr.route[i]);
      const nodeB = nodeNumToId(tr.route[i + 1]);
      const snr = tr.snrTowards?.[i];
      updateLink(nodeA, nodeB, snr, undefined, tr.timestamp);
    }

    // If we have route back data, process that too
    if (tr.snrBack && tr.snrBack.length > 0) {
      for (let i = 0; i < tr.route.length - 1; i++) {
        const nodeA = nodeNumToId(tr.route[i + 1]);
        const nodeB = nodeNumToId(tr.route[i]);
        const snr = tr.snrBack?.[i];
        updateLink(nodeA, nodeB, snr, undefined, tr.timestamp, true);
      }
    }
  }

  // Process messages - direct communication implies 1-hop connectivity
  // (or multi-hop if hopsAway > 1, but we at least know endpoints can reach)
  for (const msg of messages) {
    if (msg.hopsAway === 0 || msg.hopsAway === 1) {
      // Direct link confirmed
      updateLink(msg.fromNode, msg.toNode, msg.snr, msg.rssi, msg.timestamp);
    }
    // For multi-hop messages, we know the endpoints can eventually reach
    // but don't know the intermediate nodes without traceroute data
  }

  // Calculate link distances using node positions
  const nodePositions = new Map<string, { lat: number; lon: number }>();
  for (const node of nodes) {
    if (node.position) {
      nodePositions.set(node.id, {
        lat: node.position.latitude,
        lon: node.position.longitude,
      });
    }
  }

  for (const link of linksMap.values()) {
    const posA = nodePositions.get(link.nodeA);
    const posB = nodePositions.get(link.nodeB);
    if (posA && posB) {
      link.distance = haversineDistance(posA.lat, posA.lon, posB.lat, posB.lon);
    }
  }

  // Identify hub nodes (high connectivity)
  const hubThreshold = Math.max(3, Math.ceil(nodes.length * 0.2)); // Top 20% or at least 3 connections
  const hubNodes: string[] = [];
  for (const [nodeId, connections] of nodeConnections.entries()) {
    if (connections.size >= hubThreshold) {
      hubNodes.push(nodeId);
    }
  }

  // Identify bridge nodes (connect otherwise separate groups)
  // Simple heuristic: nodes whose removal would increase isolated nodes
  const bridgeNodes: string[] = [];
  for (const [nodeId, connections] of nodeConnections.entries()) {
    if (connections.size >= 2) {
      // Check if any of this node's neighbors only connect through this node
      let isBridge = false;
      const neighbors = Array.from(connections);
      for (let i = 0; i < neighbors.length && !isBridge; i++) {
        for (let j = i + 1; j < neighbors.length && !isBridge; j++) {
          const neighborA = neighbors[i];
          const neighborB = neighbors[j];
          // If A and B don't directly connect, this node might be a bridge
          if (!nodeConnections.get(neighborA)?.has(neighborB)) {
            isBridge = true;
          }
        }
      }
      if (isBridge) {
        bridgeNodes.push(nodeId);
      }
    }
  }

  // Identify isolated nodes
  const isolatedNodes: string[] = [];
  for (const [nodeId, connections] of nodeConnections.entries()) {
    if (connections.size === 0) {
      isolatedNodes.push(nodeId);
    }
  }

  // Find overlapping coverage pairs (nodes that share neighbors)
  const overlappingPairs: Array<{ nodeA: string; nodeB: string; sharedNeighbors: string[] }> = [];
  const nodeIds = Array.from(nodeConnections.keys());
  for (let i = 0; i < nodeIds.length; i++) {
    for (let j = i + 1; j < nodeIds.length; j++) {
      const nodeA = nodeIds[i];
      const nodeB = nodeIds[j];
      const neighborsA = nodeConnections.get(nodeA) || new Set();
      const neighborsB = nodeConnections.get(nodeB) || new Set();
      const shared = Array.from(neighborsA).filter(n => neighborsB.has(n));
      if (shared.length > 0) {
        overlappingPairs.push({ nodeA, nodeB, sharedNeighbors: shared });
      }
    }
  }

  return {
    links: Array.from(linksMap.values()),
    nodeConnections: new Map(
      Array.from(nodeConnections.entries()).map(([k, v]) => [k, Array.from(v)])
    ),
    hubNodes,
    bridgeNodes,
    isolatedNodes,
    overlappingPairs,
  };
}

/**
 * Calculate network connectivity score (0-1)
 * 1.0 = every node can reach every other node
 * 0.0 = no connections at all
 */
function calculateConnectivityScore(graph: ConnectivityGraph, totalNodes: number): number {
  if (totalNodes < 2) return 1;

  // Use BFS to find connected components
  const visited = new Set<string>();
  const allNodes = Array.from(graph.nodeConnections.keys());
  let largestComponent = 0;

  for (const startNode of allNodes) {
    if (visited.has(startNode)) continue;

    // BFS from this node
    const queue = [startNode];
    let componentSize = 0;

    while (queue.length > 0) {
      const node = queue.shift()!;
      if (visited.has(node)) continue;
      visited.add(node);
      componentSize++;

      const neighbors = graph.nodeConnections.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }

    largestComponent = Math.max(largestComponent, componentSize);
  }

  // Score is the fraction of nodes in the largest connected component
  return largestComponent / totalNodes;
}

/**
 * Enhanced coverage estimation with route data
 */
export function estimateEnhancedCoverage(
  nodes: Node[],
  traceroutes: TracerouteData[] = [],
  messages: MessageRoutingData[] = []
): EnhancedCoverageEstimate {
  // Get base coverage estimate
  const baseCoverage = estimateCoverage(nodes);

  // Build connectivity graph
  const graph = buildConnectivityGraph(nodes, traceroutes, messages);

  // Calculate link distance stats
  const linksWithDistance = graph.links.filter(l => l.distance !== undefined);
  const linkDistances = {
    min: linksWithDistance.length > 0 ? Math.min(...linksWithDistance.map(l => l.distance!)) : 0,
    max: linksWithDistance.length > 0 ? Math.max(...linksWithDistance.map(l => l.distance!)) : 0,
    avg: linksWithDistance.length > 0
      ? linksWithDistance.reduce((sum, l) => sum + l.distance!, 0) / linksWithDistance.length
      : 0,
    measuredLinks: linksWithDistance.length,
  };

  // Calculate connectivity metrics
  const totalNodes = nodes.length;
  const confirmedLinks = graph.links.length;
  const avgLinksPerNode = totalNodes > 0 ? (confirmedLinks * 2) / totalNodes : 0;
  const overlappingCoverage = totalNodes > 1
    ? (graph.overlappingPairs.length / ((totalNodes * (totalNodes - 1)) / 2)) * 100
    : 0;
  const networkConnectivity = calculateConnectivityScore(graph, totalNodes);

  // Update recommendations based on connectivity data
  const recommendations = [...baseCoverage.recommendations];

  if (graph.isolatedNodes.length > 0) {
    recommendations.push(
      `${graph.isolatedNodes.length} node(s) have no confirmed connections - verify antenna/placement`
    );
  }

  if (graph.bridgeNodes.length > 0 && graph.bridgeNodes.length <= 2) {
    recommendations.push(
      `Network depends on ${graph.bridgeNodes.length} bridge node(s) - add redundancy`
    );
  }

  if (linkDistances.max > 0 && linkDistances.max > baseCoverage.effectiveRadiusKm * 2) {
    // We have links longer than expected - adjust environment estimate upward
    recommendations.push(
      `Measured ${linkDistances.max.toFixed(1)}km link - better range than expected`
    );
  }

  if (linkDistances.avg > 0 && linkDistances.avg < 1) {
    // Very short links suggest urban environment
    if (baseCoverage.environment !== "dense-urban" && baseCoverage.environment !== "urban") {
      recommendations.push(
        `Avg link distance ${linkDistances.avg.toFixed(1)}km suggests denser environment`
      );
    }
  }

  return {
    ...baseCoverage,
    recommendations,
    connectivity: {
      confirmedLinks,
      avgLinksPerNode: Math.round(avgLinksPerNode * 10) / 10,
      hubNodes: graph.hubNodes,
      bridgeNodes: graph.bridgeNodes,
      overlappingCoverage: Math.round(overlappingCoverage * 10) / 10,
      networkConnectivity: Math.round(networkConnectivity * 100) / 100,
    },
    linkDistances: {
      min: Math.round(linkDistances.min * 100) / 100,
      max: Math.round(linkDistances.max * 100) / 100,
      avg: Math.round(linkDistances.avg * 100) / 100,
      measuredLinks: linkDistances.measuredLinks,
    },
  };
}

/**
 * Export haversineDistance for use in connectivity calculations
 */
export { haversineDistance };
