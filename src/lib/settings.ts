// Settings store using localStorage
const SETTINGS_KEY = "namm-settings";
const NODE_ALIASES_KEY = "namm-node-aliases";

// Node Aliases - custom names for nodes
export interface NodeAliases {
  [nodeId: string]: string;
}

export function getNodeAliases(): NodeAliases {
  if (typeof window === "undefined") return {};

  try {
    const stored = localStorage.getItem(NODE_ALIASES_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Failed to load node aliases:", error);
  }

  return {};
}

export function getNodeAlias(nodeId: string): string | undefined {
  const aliases = getNodeAliases();
  return aliases[nodeId];
}

export function setNodeAlias(nodeId: string, alias: string): void {
  if (typeof window === "undefined") return;

  try {
    const aliases = getNodeAliases();
    if (alias.trim()) {
      aliases[nodeId] = alias.trim();
    } else {
      delete aliases[nodeId];
    }
    localStorage.setItem(NODE_ALIASES_KEY, JSON.stringify(aliases));

    // Dispatch event for components to update
    window.dispatchEvent(new CustomEvent("node-aliases-changed", { detail: aliases }));
  } catch (error) {
    console.error("Failed to save node alias:", error);
  }
}

export function removeNodeAlias(nodeId: string): void {
  setNodeAlias(nodeId, "");
}

export interface AppSettings {
  // Connection
  connectionType: "http" | "mqtt" | "serial" | "ble";
  apiEndpoint: string;
  autoReconnect: boolean;

  // MQTT Settings
  mqttBroker?: string;
  mqttUsername?: string;
  mqttPassword?: string;
  mqttTopic?: string; // Direct topic pattern like "msh/US/KY/#"
  mqttUseTLS?: boolean;

  // Notifications
  notifyNewMessages: boolean;
  notifyNodeStatus: boolean;
  notifyLowBattery: boolean;
  notificationSound: boolean;

  // Appearance
  compactMode: boolean;

  // Map
  defaultMapLayer: "street" | "satellite" | "terrain";
  showNodeLabels: boolean;
  clusterMarkers: boolean;
  autoCenter: boolean;

  // Privacy
  storeMessages: boolean;
  analytics: boolean;
}

const defaultSettings: AppSettings = {
  connectionType: "http",
  apiEndpoint: "",
  autoReconnect: true,
  mqttBroker: "",
  mqttUsername: "",
  mqttPassword: "",
  mqttTopic: "",
  mqttUseTLS: false,
  notifyNewMessages: true,
  notifyNodeStatus: false,
  notifyLowBattery: true,
  notificationSound: true,
  compactMode: false,
  defaultMapLayer: "street",
  showNodeLabels: true,
  clusterMarkers: true,
  autoCenter: false,
  storeMessages: true,
  analytics: false,
};

export function getSettings(): AppSettings {
  if (typeof window === "undefined") return defaultSettings;

  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error("Failed to load settings:", error);
  }

  return defaultSettings;
}

export function saveSettings(settings: Partial<AppSettings>) {
  if (typeof window === "undefined") return;

  try {
    const current = getSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));

    // Dispatch event for other components to listen
    window.dispatchEvent(new CustomEvent("settings-changed", { detail: updated }));
  } catch (error) {
    console.error("Failed to save settings:", error);
  }
}

export function clearAllData() {
  if (typeof window === "undefined") return;

  const confirmed = window.confirm(
    "Are you sure you want to clear all data? This will remove all settings and cached data."
  );

  if (confirmed) {
    try {
      localStorage.clear();
      window.location.reload();
    } catch (error) {
      console.error("Failed to clear data:", error);
    }
  }
}

// Backup/Restore functionality
export interface BackupData {
  version: string;
  timestamp: number;
  settings: AppSettings;
  alertThresholds?: unknown;
  alertEvents?: unknown;
  nodeAliases?: NodeAliases;
}

export function createBackup(): BackupData {
  const backup: BackupData = {
    version: "1.0.0",
    timestamp: Date.now(),
    settings: getSettings(),
    nodeAliases: getNodeAliases(),
  };

  // Include alert thresholds if present
  if (typeof window !== "undefined") {
    const alertThresholds = localStorage.getItem("namm-alert-thresholds");
    const alertEvents = localStorage.getItem("namm-alert-events");
    if (alertThresholds) backup.alertThresholds = JSON.parse(alertThresholds);
    if (alertEvents) backup.alertEvents = JSON.parse(alertEvents);
  }

  return backup;
}

export function exportBackup(): void {
  if (typeof window === "undefined") return;

  const backup = createBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `namm-backup-${new Date().toISOString().split("T")[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function validateBackup(data: unknown): data is BackupData {
  if (!data || typeof data !== "object") return false;
  const backup = data as Record<string, unknown>;

  if (typeof backup.version !== "string") return false;
  if (typeof backup.timestamp !== "number") return false;
  if (!backup.settings || typeof backup.settings !== "object") return false;

  return true;
}

export function restoreBackup(backup: BackupData): { success: boolean; message: string } {
  if (typeof window === "undefined") {
    return { success: false, message: "Cannot restore in server environment" };
  }

  try {
    // Validate version compatibility
    if (!backup.version) {
      return { success: false, message: "Invalid backup: missing version" };
    }

    // Restore settings
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(backup.settings));

    // Restore node aliases if present
    if (backup.nodeAliases) {
      localStorage.setItem(NODE_ALIASES_KEY, JSON.stringify(backup.nodeAliases));
    }

    // Restore alert thresholds if present
    if (backup.alertThresholds) {
      localStorage.setItem("namm-alert-thresholds", JSON.stringify(backup.alertThresholds));
    }

    // Restore alert events if present
    if (backup.alertEvents) {
      localStorage.setItem("namm-alert-events", JSON.stringify(backup.alertEvents));
    }

    // Dispatch settings change event
    window.dispatchEvent(new CustomEvent("settings-changed", { detail: backup.settings }));

    return {
      success: true,
      message: `Backup restored successfully from ${new Date(backup.timestamp).toLocaleString()}`
    };
  } catch (error) {
    console.error("Failed to restore backup:", error);
    return { success: false, message: "Failed to restore backup" };
  }
}

export async function importBackup(file: File): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result;
        if (typeof content !== "string") {
          resolve({ success: false, message: "Failed to read file" });
          return;
        }

        const data = JSON.parse(content);

        if (!validateBackup(data)) {
          resolve({ success: false, message: "Invalid backup file format" });
          return;
        }

        resolve(restoreBackup(data));
      } catch (error) {
        resolve({ success: false, message: "Failed to parse backup file" });
      }
    };

    reader.onerror = () => {
      resolve({ success: false, message: "Failed to read file" });
    };

    reader.readAsText(file);
  });
}

