/**
 * Path Analysis Utilities
 *
 * Implements Dijkstra's algorithm and graph analysis for mesh network routing
 */

import type { Traceroute } from '@/lib/db/repositories/traceroutes';

/**
 * Represents an edge in the network graph
 */
interface Edge {
  to: number;
  weight: number;
  count: number;      // How many times this link was observed
  lastSeen: number;   // Last time this link was used
  avgSnr?: number;    // Average SNR for this link
}

/**
 * Represents the network graph built from traceroutes
 */
export interface NetworkGraph {
  nodes: Set<number>;
  edges: Map<number, Edge[]>;
  nodeIdMap: Map<string, number>;  // hex ID -> node num
  reverseMap: Map<number, string>; // node num -> hex ID
}

/**
 * Path result from Dijkstra's algorithm
 */
export interface PathResult {
  path: number[];
  totalWeight: number;
  hopCount: number;
  reliable: boolean;  // All links seen recently
}

/**
 * Build a weighted network graph from traceroute data
 *
 * Weight is calculated based on:
 * - Hop count (each hop adds base weight)
 * - SNR (lower SNR = higher weight)
 * - Recency (older links have higher weight)
 * - Reliability (links used less frequently have higher weight)
 */
export function buildNetworkGraph(traceroutes: Traceroute[]): NetworkGraph {
  const nodes = new Set<number>();
  const edges = new Map<number, Edge[]>();
  const nodeIdMap = new Map<string, number>();
  const reverseMap = new Map<number, string>();
  const linkData = new Map<string, {
    count: number;
    lastSeen: number;
    snrSum: number;
    snrCount: number;
  }>();

  // Process each traceroute to build the graph
  for (const trace of traceroutes) {
    if (!trace.success || trace.route.length < 2) continue;

    // Map IDs
    const fromNum = hexToNum(trace.fromId);
    const toNum = hexToNum(trace.toId);
    nodeIdMap.set(trace.fromId, fromNum);
    nodeIdMap.set(trace.toId, toNum);
    reverseMap.set(fromNum, trace.fromId);
    reverseMap.set(toNum, trace.toId);

    // Process forward path
    for (let i = 0; i < trace.route.length - 1; i++) {
      const from = trace.route[i];
      const to = trace.route[i + 1];
      nodes.add(from);
      nodes.add(to);
      reverseMap.set(from, numToHex(from));
      reverseMap.set(to, numToHex(to));

      const linkKey = `${from}-${to}`;
      const existing = linkData.get(linkKey) || {
        count: 0,
        lastSeen: 0,
        snrSum: 0,
        snrCount: 0,
      };

      existing.count++;
      existing.lastSeen = Math.max(existing.lastSeen, trace.timestamp);

      if (trace.snrTowards && trace.snrTowards[i + 1] !== undefined) {
        existing.snrSum += trace.snrTowards[i + 1];
        existing.snrCount++;
      }

      linkData.set(linkKey, existing);
    }

    // Process reverse path if available
    if (trace.routeBack && trace.routeBack.length > 1) {
      for (let i = 0; i < trace.routeBack.length - 1; i++) {
        const from = trace.routeBack[i];
        const to = trace.routeBack[i + 1];
        nodes.add(from);
        nodes.add(to);
        reverseMap.set(from, numToHex(from));
        reverseMap.set(to, numToHex(to));

        const linkKey = `${from}-${to}`;
        const existing = linkData.get(linkKey) || {
          count: 0,
          lastSeen: 0,
          snrSum: 0,
          snrCount: 0,
        };

        existing.count++;
        existing.lastSeen = Math.max(existing.lastSeen, trace.timestamp);

        if (trace.snrBack && trace.snrBack[i + 1] !== undefined) {
          existing.snrSum += trace.snrBack[i + 1];
          existing.snrCount++;
        }

        linkData.set(linkKey, existing);
      }
    }
  }

  // Build edges with calculated weights
  const now = Date.now();
  for (const [linkKey, data] of linkData) {
    const [fromStr, toStr] = linkKey.split('-');
    const from = parseInt(fromStr);
    const to = parseInt(toStr);

    // Calculate weight
    // Base weight of 1 per hop
    let weight = 1;

    // Reliability factor: fewer observations = higher weight
    const reliabilityFactor = Math.max(1, 3 - Math.log2(data.count + 1));
    weight *= reliabilityFactor;

    // Recency factor: older links have higher weight
    const ageHours = (now - data.lastSeen) / (1000 * 60 * 60);
    const recencyFactor = 1 + Math.min(1, ageHours / 24); // Up to 2x for 24hr old links
    weight *= recencyFactor;

    // SNR factor: lower SNR = higher weight
    if (data.snrCount > 0) {
      const avgSnr = data.snrSum / data.snrCount;
      // SNR typically ranges from -20 to +10
      // Higher is better, so invert and normalize
      const snrFactor = Math.max(0.5, 1 + (0 - avgSnr) / 20);
      weight *= snrFactor;
    }

    const edge: Edge = {
      to,
      weight,
      count: data.count,
      lastSeen: data.lastSeen,
      avgSnr: data.snrCount > 0 ? data.snrSum / data.snrCount : undefined,
    };

    const nodeEdges = edges.get(from) || [];
    nodeEdges.push(edge);
    edges.set(from, nodeEdges);
  }

  return { nodes, edges, nodeIdMap, reverseMap };
}

/**
 * Dijkstra's shortest path algorithm
 */
export function dijkstraShortestPath(
  graph: NetworkGraph,
  startNode: number,
  endNode: number
): PathResult | null {
  if (!graph.nodes.has(startNode) || !graph.nodes.has(endNode)) {
    return null;
  }

  if (startNode === endNode) {
    return { path: [startNode], totalWeight: 0, hopCount: 0, reliable: true };
  }

  const distances = new Map<number, number>();
  const previous = new Map<number, number>();
  const visited = new Set<number>();
  const queue = new PriorityQueue<number>();

  // Initialize distances
  for (const node of graph.nodes) {
    distances.set(node, Infinity);
  }
  distances.set(startNode, 0);
  queue.enqueue(startNode, 0);

  while (!queue.isEmpty()) {
    const current = queue.dequeue()!;

    if (visited.has(current)) continue;
    visited.add(current);

    if (current === endNode) break;

    const edges = graph.edges.get(current) || [];
    for (const edge of edges) {
      if (visited.has(edge.to)) continue;

      const newDist = distances.get(current)! + edge.weight;
      if (newDist < (distances.get(edge.to) || Infinity)) {
        distances.set(edge.to, newDist);
        previous.set(edge.to, current);
        queue.enqueue(edge.to, newDist);
      }
    }
  }

  // Reconstruct path
  if (!previous.has(endNode) && startNode !== endNode) {
    return null;
  }

  const path: number[] = [];
  let current = endNode;
  while (current !== undefined && current !== startNode) {
    path.unshift(current);
    current = previous.get(current)!;
  }
  path.unshift(startNode);

  // Check if all links are recent (within 1 hour)
  const now = Date.now();
  let reliable = true;
  for (let i = 0; i < path.length - 1; i++) {
    const edges = graph.edges.get(path[i]) || [];
    const edge = edges.find(e => e.to === path[i + 1]);
    if (edge && now - edge.lastSeen > 3600000) {
      reliable = false;
      break;
    }
  }

  return {
    path,
    totalWeight: distances.get(endNode) || 0,
    hopCount: path.length - 1,
    reliable,
  };
}

/**
 * Find all paths between two nodes (for visualization)
 * Uses BFS with depth limit
 */
export function findAllPaths(
  graph: NetworkGraph,
  startNode: number,
  endNode: number,
  maxHops: number = 7
): number[][] {
  if (!graph.nodes.has(startNode) || !graph.nodes.has(endNode)) {
    return [];
  }

  const paths: number[][] = [];
  const queue: { path: number[]; visited: Set<number> }[] = [
    { path: [startNode], visited: new Set([startNode]) }
  ];

  while (queue.length > 0 && paths.length < 10) {
    const { path, visited } = queue.shift()!;
    const current = path[path.length - 1];

    if (path.length > maxHops + 1) continue;

    if (current === endNode) {
      paths.push(path);
      continue;
    }

    const edges = graph.edges.get(current) || [];
    for (const edge of edges) {
      if (!visited.has(edge.to)) {
        const newVisited = new Set(visited);
        newVisited.add(edge.to);
        queue.push({ path: [...path, edge.to], visited: newVisited });
      }
    }
  }

  // Sort by path length
  paths.sort((a, b) => a.length - b.length);
  return paths;
}

/**
 * Get graph statistics
 */
export function getGraphStats(graph: NetworkGraph): {
  nodeCount: number;
  edgeCount: number;
  avgDegree: number;
  isolatedNodes: number;
} {
  let edgeCount = 0;
  let isolatedNodes = 0;

  for (const node of graph.nodes) {
    const edges = graph.edges.get(node) || [];
    edgeCount += edges.length;
    if (edges.length === 0) {
      // Check if node has any incoming edges
      let hasIncoming = false;
      for (const [, nodeEdges] of graph.edges) {
        if (nodeEdges.some(e => e.to === node)) {
          hasIncoming = true;
          break;
        }
      }
      if (!hasIncoming) isolatedNodes++;
    }
  }

  return {
    nodeCount: graph.nodes.size,
    edgeCount,
    avgDegree: graph.nodes.size > 0 ? edgeCount / graph.nodes.size : 0,
    isolatedNodes,
  };
}

/**
 * Simple priority queue implementation for Dijkstra's
 */
class PriorityQueue<T> {
  private items: { value: T; priority: number }[] = [];

  enqueue(value: T, priority: number): void {
    const item = { value, priority };
    let added = false;
    for (let i = 0; i < this.items.length; i++) {
      if (priority < this.items[i].priority) {
        this.items.splice(i, 0, item);
        added = true;
        break;
      }
    }
    if (!added) {
      this.items.push(item);
    }
  }

  dequeue(): T | undefined {
    return this.items.shift()?.value;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }
}

/**
 * Convert hex node ID to number
 */
function hexToNum(hexId: string): number {
  // Remove leading ! if present
  const clean = hexId.startsWith('!') ? hexId.slice(1) : hexId;
  return parseInt(clean, 16);
}

/**
 * Convert node number to hex ID
 */
function numToHex(num: number): string {
  return `!${num.toString(16).padStart(8, '0')}`;
}
