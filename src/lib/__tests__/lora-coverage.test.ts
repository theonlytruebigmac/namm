import { describe, it, expect } from "vitest";
import {
  estimateCoverage,
  estimateEnhancedCoverage,
  buildConnectivityGraph,
  getEnvironmentDescription,
  getExpectedRange,
  ENVIRONMENT_RANGES,
  type TracerouteData,
  type MessageRoutingData,
} from "../lora-coverage";
import type { Node } from "@/types/node";

const createNode = (
  id: string,
  lat: number,
  lon: number,
  options: Partial<Node> = {}
): Node => ({
  id,
  nodeNum: parseInt(id, 16),
  shortName: id.slice(0, 4),
  longName: `Node ${id}`,
  hwModel: "TBEAM",
  role: "CLIENT",
  lastHeard: Date.now(),
  position: { latitude: lat, longitude: lon },
  ...options,
});

describe("LoRa Coverage Estimation", () => {
  describe("estimateCoverage", () => {
    it("returns default values for empty nodes", () => {
      const coverage = estimateCoverage([]);

      expect(coverage.totalCoverageKm2).toBe(0);
      expect(coverage.networkSpanKm).toBe(0);
      expect(coverage.environment).toBe("suburban"); // Default
    });

    it("calculates coverage for single node", () => {
      const nodes = [createNode("1", 40.7128, -74.0060)];
      const coverage = estimateCoverage(nodes);

      expect(coverage.totalCoverageKm2).toBeGreaterThan(0);
      expect(coverage.effectiveRadiusKm).toBeGreaterThan(0);
      expect(coverage.networkSpanKm).toBe(0); // Single node has no span
    });

    it("detects dense urban from tight node spacing", () => {
      // Nodes 500m apart in NYC
      const nodes = [
        createNode("1", 40.7128, -74.0060),
        createNode("2", 40.7133, -74.0055),
        createNode("3", 40.7123, -74.0065),
        createNode("4", 40.7138, -74.0060),
      ];

      const coverage = estimateCoverage(nodes);

      // Should infer urban or dense-urban from tight spacing
      expect(["dense-urban", "urban"]).toContain(coverage.environment);
      expect(coverage.analysis.avgNodeSpacingKm).toBeLessThan(1);
    });

    it("detects rural from wide node spacing", () => {
      // Nodes 10+ km apart
      const nodes = [
        createNode("1", 40.7128, -74.0060),
        createNode("2", 40.8128, -74.0060), // ~11km north
        createNode("3", 40.7128, -73.9000), // ~8km east
      ];

      const coverage = estimateCoverage(nodes);

      expect(["rural", "open"]).toContain(coverage.environment);
      expect(coverage.analysis.avgNodeSpacingKm).toBeGreaterThan(5);
    });

    it("adjusts for routers having better range", () => {
      const clientNodes = [
        createNode("1", 40.7128, -74.0060, { role: "CLIENT" }),
        createNode("2", 40.7228, -74.0060, { role: "CLIENT" }),
      ];

      const routerNodes = [
        createNode("1", 40.7128, -74.0060, { role: "ROUTER" }),
        createNode("2", 40.7228, -74.0060, { role: "ROUTER" }),
      ];

      const clientCoverage = estimateCoverage(clientNodes);
      const routerCoverage = estimateCoverage(routerNodes);

      // Routers should have more coverage due to range multiplier
      expect(routerCoverage.effectiveRadiusKm).toBeGreaterThan(clientCoverage.effectiveRadiusKm);
    });

    it("factors in SNR for signal quality", () => {
      const lowSnrNodes = [
        createNode("1", 40.7128, -74.0060, { snr: -10 }),
        createNode("2", 40.7228, -74.0060, { snr: -8 }),
      ];

      const highSnrNodes = [
        createNode("1", 40.7128, -74.0060, { snr: 8 }),
        createNode("2", 40.7228, -74.0060, { snr: 10 }),
      ];

      const lowCoverage = estimateCoverage(lowSnrNodes);
      const highCoverage = estimateCoverage(highSnrNodes);

      // High SNR = better signal = likely rural/open environment
      // And higher per-node range
      expect(highCoverage.effectiveRadiusKm).toBeGreaterThan(lowCoverage.effectiveRadiusKm);
    });

    it("calculates network span correctly", () => {
      // Two nodes ~11km apart (0.1 degree latitude ≈ 11km)
      const nodes = [
        createNode("1", 40.0, -74.0),
        createNode("2", 40.1, -74.0),
      ];

      const coverage = estimateCoverage(nodes);

      // Should be approximately 11km
      expect(coverage.networkSpanKm).toBeGreaterThan(10);
      expect(coverage.networkSpanKm).toBeLessThan(13);
    });

    it("provides recommendations for gaps", () => {
      // Nodes with very wide spacing (>15km apart, larger than typical range)
      const nodes = [
        createNode("1", 40.0, -74.0),
        createNode("2", 40.2, -74.0), // ~22km away
      ];

      const coverage = estimateCoverage(nodes);

      // Should recommend adding nodes
      expect(coverage.recommendations.some(r => r.toLowerCase().includes("add") || r.toLowerCase().includes("gap"))).toBe(true);
    });
  });

  describe("helper functions", () => {
    it("getEnvironmentDescription returns correct strings", () => {
      expect(getEnvironmentDescription("dense-urban")).toContain("Dense Urban");
      expect(getEnvironmentDescription("suburban")).toContain("Suburban");
      expect(getEnvironmentDescription("open")).toContain("line-of-sight");
    });

    it("getExpectedRange returns valid range strings", () => {
      const range = getExpectedRange("suburban");
      expect(range).toMatch(/\d+-\d+ km/);
    });

    it("ENVIRONMENT_RANGES has increasing values", () => {
      expect(ENVIRONMENT_RANGES["dense-urban"].typical).toBeLessThan(ENVIRONMENT_RANGES["urban"].typical);
      expect(ENVIRONMENT_RANGES["urban"].typical).toBeLessThan(ENVIRONMENT_RANGES["suburban"].typical);
      expect(ENVIRONMENT_RANGES["suburban"].typical).toBeLessThan(ENVIRONMENT_RANGES["rural"].typical);
      expect(ENVIRONMENT_RANGES["rural"].typical).toBeLessThan(ENVIRONMENT_RANGES["open"].typical);
    });
  });

  describe("buildConnectivityGraph", () => {
    it("builds graph from traceroute data", () => {
      const nodes = [
        createNode("!00000001", 40.7128, -74.006),
        createNode("!00000002", 40.713, -74.005),
        createNode("!00000003", 40.714, -74.004),
      ];

      const traceroutes: TracerouteData[] = [
        {
          fromId: "!00000001",
          toId: "!00000003",
          route: [1, 2, 3], // Node 1 -> Node 2 -> Node 3
          snrTowards: [5, 3],
          timestamp: Date.now(),
          success: true,
        },
      ];

      const graph = buildConnectivityGraph(nodes, traceroutes);

      expect(graph.links.length).toBe(2); // 1-2 and 2-3
      expect(graph.nodeConnections.get("!00000001")).toContain("!00000002");
      expect(graph.nodeConnections.get("!00000002")).toContain("!00000001");
      expect(graph.nodeConnections.get("!00000002")).toContain("!00000003");
    });

    it("identifies hub nodes with many connections", () => {
      const nodes = [
        createNode("!00000001", 40.71, -74.01),
        createNode("!00000002", 40.72, -74.01),
        createNode("!00000003", 40.73, -74.01),
        createNode("!00000004", 40.74, -74.01),
        createNode("!00000005", 40.75, -74.01),
      ];

      // Node 2 is connected to everyone else (hub)
      const traceroutes: TracerouteData[] = [
        { fromId: "!00000001", toId: "!00000002", route: [1, 2], timestamp: Date.now(), success: true },
        { fromId: "!00000003", toId: "!00000002", route: [3, 2], timestamp: Date.now(), success: true },
        { fromId: "!00000004", toId: "!00000002", route: [4, 2], timestamp: Date.now(), success: true },
        { fromId: "!00000005", toId: "!00000002", route: [5, 2], timestamp: Date.now(), success: true },
      ];

      const graph = buildConnectivityGraph(nodes, traceroutes);

      // Node 2 should be identified as a hub (4 connections)
      expect(graph.hubNodes).toContain("!00000002");
    });

    it("identifies isolated nodes", () => {
      const nodes = [
        createNode("!00000001", 40.71, -74.01),
        createNode("!00000002", 40.72, -74.01),
        createNode("!00000003", 40.73, -74.01), // No connections
      ];

      const traceroutes: TracerouteData[] = [
        { fromId: "!00000001", toId: "!00000002", route: [1, 2], timestamp: Date.now(), success: true },
      ];

      const graph = buildConnectivityGraph(nodes, traceroutes);

      expect(graph.isolatedNodes).toContain("!00000003");
      expect(graph.isolatedNodes).not.toContain("!00000001");
    });

    it("finds overlapping coverage pairs", () => {
      const nodes = [
        createNode("!00000001", 40.71, -74.01),
        createNode("!00000002", 40.72, -74.01), // Shared neighbor
        createNode("!00000003", 40.73, -74.01),
        createNode("!00000004", 40.74, -74.01),
      ];

      // Both node 1 and node 3 connect to node 2
      const traceroutes: TracerouteData[] = [
        { fromId: "!00000001", toId: "!00000002", route: [1, 2], timestamp: Date.now(), success: true },
        { fromId: "!00000003", toId: "!00000002", route: [3, 2], timestamp: Date.now(), success: true },
      ];

      const graph = buildConnectivityGraph(nodes, traceroutes);

      // Nodes 1 and 3 share node 2 as a neighbor
      const pair = graph.overlappingPairs.find(
        (p) =>
          (p.nodeA === "!00000001" && p.nodeB === "!00000003") ||
          (p.nodeA === "!00000003" && p.nodeB === "!00000001")
      );
      expect(pair).toBeDefined();
      expect(pair?.sharedNeighbors).toContain("!00000002");
    });

    it("calculates link distances when positions available", () => {
      const nodes = [
        createNode("!00000001", 40.0, -74.0),
        createNode("!00000002", 40.1, -74.0), // ~11km apart
      ];

      const traceroutes: TracerouteData[] = [
        { fromId: "!00000001", toId: "!00000002", route: [1, 2], timestamp: Date.now(), success: true },
      ];

      const graph = buildConnectivityGraph(nodes, traceroutes);

      expect(graph.links[0].distance).toBeGreaterThan(10);
      expect(graph.links[0].distance).toBeLessThan(13);
    });
  });

  describe("estimateEnhancedCoverage", () => {
    it("includes connectivity metrics", () => {
      const nodes = [
        createNode("!00000001", 40.71, -74.01),
        createNode("!00000002", 40.72, -74.01),
        createNode("!00000003", 40.73, -74.01),
      ];

      const traceroutes: TracerouteData[] = [
        { fromId: "!00000001", toId: "!00000002", route: [1, 2], timestamp: Date.now(), success: true },
        { fromId: "!00000002", toId: "!00000003", route: [2, 3], timestamp: Date.now(), success: true },
      ];

      const coverage = estimateEnhancedCoverage(nodes, traceroutes);

      expect(coverage.connectivity).toBeDefined();
      expect(coverage.connectivity.confirmedLinks).toBe(2);
      expect(coverage.connectivity.networkConnectivity).toBeGreaterThan(0);
    });

    it("includes link distance stats", () => {
      const nodes = [
        createNode("!00000001", 40.0, -74.0),
        createNode("!00000002", 40.05, -74.0), // ~5.5km
        createNode("!00000003", 40.1, -74.0), // ~11km from node 1
      ];

      const traceroutes: TracerouteData[] = [
        { fromId: "!00000001", toId: "!00000002", route: [1, 2], timestamp: Date.now(), success: true },
        { fromId: "!00000002", toId: "!00000003", route: [2, 3], timestamp: Date.now(), success: true },
      ];

      const coverage = estimateEnhancedCoverage(nodes, traceroutes);

      expect(coverage.linkDistances.measuredLinks).toBe(2);
      expect(coverage.linkDistances.avg).toBeGreaterThan(5);
      expect(coverage.linkDistances.avg).toBeLessThan(7);
    });

    it("adds recommendations for isolated nodes", () => {
      const nodes = [
        createNode("!00000001", 40.71, -74.01),
        createNode("!00000002", 40.72, -74.01),
        createNode("!00000003", 40.73, -74.01), // Isolated
      ];

      const traceroutes: TracerouteData[] = [
        { fromId: "!00000001", toId: "!00000002", route: [1, 2], timestamp: Date.now(), success: true },
      ];

      const coverage = estimateEnhancedCoverage(nodes, traceroutes);

      expect(
        coverage.recommendations.some((r) => r.toLowerCase().includes("no confirmed connections"))
      ).toBe(true);
    });
  });
});
