/**
 * Additional MQTT Packet Type Interfaces
 *
 * Structures for neighborinfo, mapreport, traceroute, and other packet types
 */

// Neighbor Info - Shows mesh topology/connections
export interface ProcessedNeighborInfo {
  nodeId: string;
  nodeNum: number;
  timestamp: number;
  neighbors: Array<{
    nodeId: number;
    snr: number;
  }>;
  neighborCount: number;
}

// Map Report - Position reports for multiple nodes
export interface ProcessedMapReport {
  nodeId: string;
  nodeNum: number;
  timestamp: number;
  reportedNodes: Array<{
    nodeNum: number;
    latitude?: number;
    longitude?: number;
    altitude?: number;
  }>;
}

// Traceroute - Path a message took through the mesh
export interface ProcessedTraceroute {
  fromId: string;
  toId: string;
  timestamp: number;
  route: number[]; // Array of node numbers in the route
  routeBack?: number[];
  snrTowards?: number[];
  snrBack?: number[];
  hops: number;
  success: boolean;
  latencyMs?: number;
}

// Range Test - Signal strength testing between nodes
export interface ProcessedRangeTest {
  id: number;
  from: string;
  to: string;
  timestamp: number;
  sequence: number;
  snr?: number;
  rssi?: number;
  hopsAway?: number;
}

// PAX Counter - People counter sensor data
export interface ProcessedPaxCounter {
  nodeId: string;
  timestamp: number;
  wifi: number;
  ble: number;
  uptime: number;
}

// Detection Sensor - Motion/presence detection
export interface ProcessedDetectionSensor {
  nodeId: string;
  timestamp: number;
  detected: boolean;
}

// Routing - Mesh routing protocol packets
export interface ProcessedRouting {
  nodeId: string;
  timestamp: number;
  routingData: any; // Complex routing protocol data
}
