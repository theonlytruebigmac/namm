/**
 * Alert Thresholds System
 *
 * Allows users to set threshold-based alerts for network monitoring.
 * Alerts can trigger browser notifications and are logged for review.
 */

// Alert threshold types
export type AlertType =
  | "battery_low"
  | "battery_critical"
  | "signal_weak"
  | "node_offline"
  | "message_rate_high"
  | "hops_exceeded"
  | "custom";

export type AlertSeverity = "info" | "warning" | "critical";

export interface AlertThreshold {
  id: string;
  type: AlertType;
  name: string;
  description: string;
  enabled: boolean;
  severity: AlertSeverity;
  // Threshold values - interpretation depends on type
  threshold: number;
  // Optional secondary threshold (e.g., for ranges)
  thresholdMax?: number;
  // Cool-down period before re-triggering (ms)
  cooldownMs: number;
  // Only apply to specific nodes (empty = all)
  nodeIds: string[];
  // Last triggered timestamp
  lastTriggered?: number;
  // Trigger count
  triggerCount: number;
}

export interface AlertEvent {
  id: string;
  thresholdId: string;
  thresholdName: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  nodeId?: string;
  nodeName?: string;
  value: number;
  threshold: number;
  timestamp: number;
  acknowledged: boolean;
}

// Storage keys
const THRESHOLDS_KEY = "namm-alert-thresholds";
const ALERTS_KEY = "namm-alert-events";
const MAX_ALERTS = 100;

// Default thresholds
const defaultThresholds: Omit<AlertThreshold, "id">[] = [
  {
    type: "battery_low",
    name: "Low Battery",
    description: "Node battery level drops below threshold",
    enabled: true,
    severity: "warning",
    threshold: 20,
    cooldownMs: 1800000, // 30 minutes
    nodeIds: [],
    triggerCount: 0,
  },
  {
    type: "battery_critical",
    name: "Critical Battery",
    description: "Node battery level is critically low",
    enabled: true,
    severity: "critical",
    threshold: 10,
    cooldownMs: 600000, // 10 minutes
    nodeIds: [],
    triggerCount: 0,
  },
  {
    type: "signal_weak",
    name: "Weak Signal",
    description: "RSSI signal strength is weak",
    enabled: true,
    severity: "warning",
    threshold: -120, // dBm
    cooldownMs: 300000, // 5 minutes
    nodeIds: [],
    triggerCount: 0,
  },
  {
    type: "node_offline",
    name: "Node Offline",
    description: "Node has not been seen for a period",
    enabled: true,
    severity: "warning",
    threshold: 3600000, // 1 hour in ms
    cooldownMs: 3600000, // 1 hour
    nodeIds: [],
    triggerCount: 0,
  },
  {
    type: "hops_exceeded",
    name: "High Hop Count",
    description: "Message hop count exceeds threshold",
    enabled: false,
    severity: "info",
    threshold: 5,
    cooldownMs: 300000, // 5 minutes
    nodeIds: [],
    triggerCount: 0,
  },
  {
    type: "message_rate_high",
    name: "High Message Rate",
    description: "Node is sending too many messages per minute",
    enabled: false,
    severity: "warning",
    threshold: 60, // messages per minute
    cooldownMs: 60000, // 1 minute
    nodeIds: [],
    triggerCount: 0,
  },
];

// Generate unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Get all thresholds
export function getAlertThresholds(): AlertThreshold[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(THRESHOLDS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Failed to load alert thresholds:", error);
  }

  // Initialize with defaults
  const thresholds = defaultThresholds.map((t) => ({
    ...t,
    id: generateId(),
  }));
  saveAlertThresholds(thresholds);
  return thresholds;
}

// Save thresholds
export function saveAlertThresholds(thresholds: AlertThreshold[]): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(THRESHOLDS_KEY, JSON.stringify(thresholds));
    // Dispatch event for cross-tab sync
    window.dispatchEvent(new StorageEvent("storage", {
      key: THRESHOLDS_KEY,
      newValue: JSON.stringify(thresholds),
    }));
  } catch (error) {
    console.error("Failed to save alert thresholds:", error);
  }
}

// Update a single threshold
export function updateAlertThreshold(id: string, updates: Partial<AlertThreshold>): AlertThreshold | null {
  const thresholds = getAlertThresholds();
  const index = thresholds.findIndex((t) => t.id === id);

  if (index === -1) return null;

  thresholds[index] = { ...thresholds[index], ...updates };
  saveAlertThresholds(thresholds);
  return thresholds[index];
}

// Delete a threshold
export function deleteAlertThreshold(id: string): boolean {
  const thresholds = getAlertThresholds();
  const filtered = thresholds.filter((t) => t.id !== id);

  if (filtered.length === thresholds.length) return false;

  saveAlertThresholds(filtered);
  return true;
}

// Add a new threshold
export function addAlertThreshold(threshold: Omit<AlertThreshold, "id" | "triggerCount">): AlertThreshold {
  const thresholds = getAlertThresholds();
  const newThreshold: AlertThreshold = {
    ...threshold,
    id: generateId(),
    triggerCount: 0,
  };
  thresholds.push(newThreshold);
  saveAlertThresholds(thresholds);
  return newThreshold;
}

// Get alert events
export function getAlertEvents(): AlertEvent[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(ALERTS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Failed to load alert events:", error);
  }

  return [];
}

// Save alert events
export function saveAlertEvents(events: AlertEvent[]): void {
  if (typeof window === "undefined") return;

  try {
    // Keep only the most recent alerts
    const trimmed = events.slice(-MAX_ALERTS);
    localStorage.setItem(ALERTS_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error("Failed to save alert events:", error);
  }
}

// Add an alert event
export function addAlertEvent(event: Omit<AlertEvent, "id">): AlertEvent {
  const events = getAlertEvents();
  const newEvent: AlertEvent = {
    ...event,
    id: generateId(),
  };
  events.push(newEvent);
  saveAlertEvents(events);

  // Update threshold trigger count and time
  updateAlertThreshold(event.thresholdId, {
    lastTriggered: Date.now(),
    triggerCount: (getAlertThresholds().find((t) => t.id === event.thresholdId)?.triggerCount || 0) + 1,
  });

  return newEvent;
}

// Acknowledge an alert
export function acknowledgeAlert(alertId: string): boolean {
  const events = getAlertEvents();
  const index = events.findIndex((e) => e.id === alertId);

  if (index === -1) return false;

  events[index].acknowledged = true;
  saveAlertEvents(events);
  return true;
}

// Acknowledge all alerts
export function acknowledgeAllAlerts(): void {
  const events = getAlertEvents();
  events.forEach((e) => (e.acknowledged = true));
  saveAlertEvents(events);
}

// Clear all alerts
export function clearAllAlerts(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ALERTS_KEY);
}

// Get unacknowledged alert count
export function getUnacknowledgedAlertCount(): number {
  return getAlertEvents().filter((e) => !e.acknowledged).length;
}

// Check if a threshold should trigger (respects cooldown)
export function shouldTriggerThreshold(threshold: AlertThreshold): boolean {
  if (!threshold.enabled) return false;

  if (threshold.lastTriggered) {
    const elapsed = Date.now() - threshold.lastTriggered;
    if (elapsed < threshold.cooldownMs) return false;
  }

  return true;
}

// Evaluate battery threshold
export function evaluateBatteryThreshold(
  batteryLevel: number,
  nodeId: string,
  nodeName?: string
): AlertEvent | null {
  const thresholds = getAlertThresholds().filter(
    (t) => (t.type === "battery_low" || t.type === "battery_critical") &&
           shouldTriggerThreshold(t) &&
           (t.nodeIds.length === 0 || t.nodeIds.includes(nodeId))
  );

  // Check critical first, then low
  const critical = thresholds.find((t) => t.type === "battery_critical" && batteryLevel <= t.threshold);
  const low = thresholds.find((t) => t.type === "battery_low" && batteryLevel <= t.threshold);

  const threshold = critical || low;
  if (!threshold) return null;

  return addAlertEvent({
    thresholdId: threshold.id,
    thresholdName: threshold.name,
    type: threshold.type,
    severity: threshold.severity,
    message: `${nodeName || nodeId}: Battery at ${batteryLevel}%`,
    nodeId,
    nodeName,
    value: batteryLevel,
    threshold: threshold.threshold,
    timestamp: Date.now(),
    acknowledged: false,
  });
}

// Evaluate signal strength threshold
export function evaluateSignalThreshold(
  rssi: number,
  nodeId: string,
  nodeName?: string
): AlertEvent | null {
  const threshold = getAlertThresholds().find(
    (t) => t.type === "signal_weak" &&
           shouldTriggerThreshold(t) &&
           (t.nodeIds.length === 0 || t.nodeIds.includes(nodeId)) &&
           rssi < t.threshold
  );

  if (!threshold) return null;

  return addAlertEvent({
    thresholdId: threshold.id,
    thresholdName: threshold.name,
    type: "signal_weak",
    severity: threshold.severity,
    message: `${nodeName || nodeId}: Weak signal at ${rssi} dBm`,
    nodeId,
    nodeName,
    value: rssi,
    threshold: threshold.threshold,
    timestamp: Date.now(),
    acknowledged: false,
  });
}

// Evaluate hop count threshold
export function evaluateHopsThreshold(
  hops: number,
  nodeId: string,
  nodeName?: string
): AlertEvent | null {
  const threshold = getAlertThresholds().find(
    (t) => t.type === "hops_exceeded" &&
           shouldTriggerThreshold(t) &&
           (t.nodeIds.length === 0 || t.nodeIds.includes(nodeId)) &&
           hops > t.threshold
  );

  if (!threshold) return null;

  return addAlertEvent({
    thresholdId: threshold.id,
    thresholdName: threshold.name,
    type: "hops_exceeded",
    severity: threshold.severity,
    message: `${nodeName || nodeId}: Message hop count ${hops} exceeds limit`,
    nodeId,
    nodeName,
    value: hops,
    threshold: threshold.threshold,
    timestamp: Date.now(),
    acknowledged: false,
  });
}

// Evaluate node offline threshold (takes lastSeen timestamp)
export function evaluateNodeOfflineThreshold(
  lastSeen: number,
  nodeId: string,
  nodeName?: string
): AlertEvent | null {
  const now = Date.now();
  const timeSinceLastSeen = now - lastSeen;

  const threshold = getAlertThresholds().find(
    (t) => t.type === "node_offline" &&
           shouldTriggerThreshold(t) &&
           (t.nodeIds.length === 0 || t.nodeIds.includes(nodeId)) &&
           timeSinceLastSeen > t.threshold
  );

  if (!threshold) return null;

  const offlineMinutes = Math.round(timeSinceLastSeen / 60000);
  return addAlertEvent({
    thresholdId: threshold.id,
    thresholdName: threshold.name,
    type: "node_offline",
    severity: threshold.severity,
    message: `${nodeName || nodeId}: Offline for ${offlineMinutes} minutes`,
    nodeId,
    nodeName,
    value: timeSinceLastSeen,
    threshold: threshold.threshold,
    timestamp: Date.now(),
    acknowledged: false,
  });
}

// Reset a threshold to defaults
export function resetAlertThreshold(id: string): AlertThreshold | null {
  const thresholds = getAlertThresholds();
  const threshold = thresholds.find((t) => t.id === id);

  if (!threshold) return null;

  const defaultForType = defaultThresholds.find((d) => d.type === threshold.type);
  if (!defaultForType) return null;

  const reset: AlertThreshold = {
    ...defaultForType,
    id: threshold.id,
    triggerCount: 0,
  };

  return updateAlertThreshold(id, reset);
}

// Reset all thresholds to defaults
export function resetAllAlertThresholds(): AlertThreshold[] {
  const thresholds = defaultThresholds.map((t) => ({
    ...t,
    id: generateId(),
  }));
  saveAlertThresholds(thresholds);
  return thresholds;
}

// Export types
export type { AlertThreshold as Threshold, AlertEvent as Alert };
