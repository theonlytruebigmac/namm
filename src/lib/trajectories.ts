/**
 * Node Trajectory System
 * Track and display historical movement paths of nodes
 */

export interface TrajectoryPoint {
  lat: number;
  lng: number;
  timestamp: number;
  altitude?: number;
}

export interface NodeTrajectory {
  nodeId: string;
  shortName: string;
  points: TrajectoryPoint[];
  color?: string;
  visible: boolean;
}

export interface TrajectoryConfig {
  enabled: boolean;
  maxPoints: number;        // Max points per trajectory
  maxAge: number;           // Max age in hours
  animatePaths: boolean;
  showTimestamps: boolean;
  fadeOlderPoints: boolean;
}

const STORAGE_KEY = "namm-trajectories";
const CONFIG_KEY = "namm-trajectory-config";

const DEFAULT_CONFIG: TrajectoryConfig = {
  enabled: false,
  maxPoints: 100,
  maxAge: 24,
  animatePaths: true,
  showTimestamps: false,
  fadeOlderPoints: true,
};

// Predefined colors for trajectories
const TRAJECTORY_COLORS = [
  "#ef4444", // Red
  "#f97316", // Orange
  "#eab308", // Yellow
  "#22c55e", // Green
  "#14b8a6", // Teal
  "#3b82f6", // Blue
  "#8b5cf6", // Violet
  "#d946ef", // Fuchsia
  "#ec4899", // Pink
  "#6366f1", // Indigo
];

/**
 * Get trajectory config from localStorage
 */
export function getTrajectoryConfig(): TrajectoryConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;

  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (stored) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error("[Trajectory] Failed to load config:", error);
  }
  return DEFAULT_CONFIG;
}

/**
 * Save trajectory config to localStorage
 */
export function saveTrajectoryConfig(config: TrajectoryConfig): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch (error) {
    console.error("[Trajectory] Failed to save config:", error);
  }
}

/**
 * Get all stored trajectories
 */
export function getTrajectories(): NodeTrajectory[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const trajectories: NodeTrajectory[] = JSON.parse(stored);
      // Clean up old points based on config
      const config = getTrajectoryConfig();
      const cutoff = Date.now() - config.maxAge * 3600000;

      return trajectories.map((t) => ({
        ...t,
        points: t.points
          .filter((p) => p.timestamp > cutoff)
          .slice(-config.maxPoints),
      }));
    }
  } catch (error) {
    console.error("[Trajectory] Failed to load trajectories:", error);
  }
  return [];
}

/**
 * Save trajectories to localStorage
 */
export function saveTrajectories(trajectories: NodeTrajectory[]): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trajectories));
    window.dispatchEvent(new CustomEvent("trajectories-changed"));
  } catch (error) {
    console.error("[Trajectory] Failed to save trajectories:", error);
  }
}

/**
 * Add a point to a node's trajectory
 */
export function addTrajectoryPoint(
  nodeId: string,
  shortName: string,
  point: Omit<TrajectoryPoint, "timestamp">
): void {
  const trajectories = getTrajectories();
  const config = getTrajectoryConfig();

  let trajectory = trajectories.find((t) => t.nodeId === nodeId);

  if (!trajectory) {
    // Create new trajectory with a unique color
    const colorIndex = trajectories.length % TRAJECTORY_COLORS.length;
    trajectory = {
      nodeId,
      shortName,
      points: [],
      color: TRAJECTORY_COLORS[colorIndex],
      visible: true,
    };
    trajectories.push(trajectory);
  }

  // Add new point
  trajectory.points.push({
    ...point,
    timestamp: Date.now(),
  });

  // Limit points
  if (trajectory.points.length > config.maxPoints) {
    trajectory.points = trajectory.points.slice(-config.maxPoints);
  }

  saveTrajectories(trajectories);
}

/**
 * Clear all trajectories
 */
export function clearTrajectories(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("trajectories-changed"));
}

/**
 * Clear trajectory for a specific node
 */
export function clearNodeTrajectory(nodeId: string): void {
  const trajectories = getTrajectories().filter((t) => t.nodeId !== nodeId);
  saveTrajectories(trajectories);
}

/**
 * Toggle visibility of a trajectory
 */
export function toggleTrajectoryVisibility(nodeId: string): void {
  const trajectories = getTrajectories();
  const trajectory = trajectories.find((t) => t.nodeId === nodeId);
  if (trajectory) {
    trajectory.visible = !trajectory.visible;
    saveTrajectories(trajectories);
  }
}

/**
 * Set trajectory color
 */
export function setTrajectoryColor(nodeId: string, color: string): void {
  const trajectories = getTrajectories();
  const trajectory = trajectories.find((t) => t.nodeId === nodeId);
  if (trajectory) {
    trajectory.color = color;
    saveTrajectories(trajectories);
  }
}

/**
 * Calculate distance between two points in meters
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate total distance traveled in a trajectory
 */
export function calculateTotalDistance(trajectory: NodeTrajectory): number {
  let total = 0;
  for (let i = 1; i < trajectory.points.length; i++) {
    const p1 = trajectory.points[i - 1];
    const p2 = trajectory.points[i];
    total += calculateDistance(p1.lat, p1.lng, p2.lat, p2.lng);
  }
  return total;
}

/**
 * Get average speed in km/h
 */
export function calculateAverageSpeed(trajectory: NodeTrajectory): number {
  if (trajectory.points.length < 2) return 0;

  const first = trajectory.points[0];
  const last = trajectory.points[trajectory.points.length - 1];
  const distance = calculateTotalDistance(trajectory);
  const timeHours = (last.timestamp - first.timestamp) / 3600000;

  if (timeHours === 0) return 0;
  return (distance / 1000) / timeHours;
}

export default {
  getTrajectoryConfig,
  saveTrajectoryConfig,
  getTrajectories,
  saveTrajectories,
  addTrajectoryPoint,
  clearTrajectories,
  clearNodeTrajectory,
  toggleTrajectoryVisibility,
  setTrajectoryColor,
  calculateDistance,
  calculateTotalDistance,
  calculateAverageSpeed,
};
