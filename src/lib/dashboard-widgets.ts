/**
 * Dashboard Widget Configuration
 *
 * Allows users to customize which widgets appear on the dashboard
 * and in what order. Persisted to localStorage.
 */

export type WidgetType =
  | "stats"
  | "nodeStatus"
  | "activityFeed"
  | "deviceStats"
  | "networkHealth"
  | "recentMessages"
  | "alertsSummary"
  | "quickActions"
  | "networkOverview";

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  description: string;
  enabled: boolean;
  order: number;
  size: "small" | "medium" | "large" | "full";
}

const WIDGETS_KEY = "namm-dashboard-widgets";

// Default widget configuration
const defaultWidgets: WidgetConfig[] = [
  {
    id: "stats-1",
    type: "stats",
    title: "Network Statistics",
    description: "Key metrics about your mesh network",
    enabled: true,
    order: 0,
    size: "full",
  },
  {
    id: "nodeStatus-1",
    type: "nodeStatus",
    title: "Node Status",
    description: "List of recently active nodes",
    enabled: true,
    order: 1,
    size: "large",
  },
  {
    id: "activityFeed-1",
    type: "activityFeed",
    title: "Live Activity",
    description: "Real-time network activity feed",
    enabled: true,
    order: 2,
    size: "medium",
  },
  {
    id: "deviceStats-1",
    type: "deviceStats",
    title: "Device Stats",
    description: "Connected device information",
    enabled: true,
    order: 3,
    size: "medium",
  },
  {
    id: "networkHealth-1",
    type: "networkHealth",
    title: "Network Health",
    description: "Overall mesh health indicators",
    enabled: true,
    order: 4,
    size: "medium",
  },
  {
    id: "recentMessages-1",
    type: "recentMessages",
    title: "Recent Messages",
    description: "Latest messages from the network",
    enabled: true,
    order: 5,
    size: "medium",
  },
  {
    id: "alertsSummary-1",
    type: "alertsSummary",
    title: "Alerts Summary",
    description: "Unacknowledged alerts overview",
    enabled: true,
    order: 6,
    size: "small",
  },
  {
    id: "quickActions-1",
    type: "quickActions",
    title: "Quick Actions",
    description: "Shortcuts to common actions",
    enabled: false,
    order: 7,
    size: "small",
  },
  {
    id: "networkOverview-1",
    type: "networkOverview",
    title: "Network Overview",
    description: "All nodes in the mesh network",
    enabled: true,
    order: 8,
    size: "full",
  },
];

/**
 * Get widget configuration
 */
export function getWidgetConfig(): WidgetConfig[] {
  if (typeof window === "undefined") return defaultWidgets;

  try {
    const stored = localStorage.getItem(WIDGETS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as WidgetConfig[];
      // Merge with defaults to handle new widgets
      const storedIds = new Set(parsed.map((w) => w.type));
      const newWidgets = defaultWidgets.filter((w) => !storedIds.has(w.type));
      return [...parsed, ...newWidgets].sort((a, b) => a.order - b.order);
    }
  } catch (error) {
    console.error("Failed to load widget config:", error);
  }

  return defaultWidgets;
}

/**
 * Save widget configuration
 */
export function saveWidgetConfig(widgets: WidgetConfig[]): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(WIDGETS_KEY, JSON.stringify(widgets));
    window.dispatchEvent(
      new CustomEvent("widgets-changed", { detail: widgets })
    );
  } catch (error) {
    console.error("Failed to save widget config:", error);
  }
}

/**
 * Toggle widget enabled state
 */
export function toggleWidget(widgetId: string): WidgetConfig[] {
  const widgets = getWidgetConfig();
  const updated = widgets.map((w) =>
    w.id === widgetId ? { ...w, enabled: !w.enabled } : w
  );
  saveWidgetConfig(updated);
  return updated;
}

/**
 * Reorder widgets
 */
export function reorderWidgets(fromIndex: number, toIndex: number): WidgetConfig[] {
  const widgets = getWidgetConfig().filter((w) => w.enabled);
  const [removed] = widgets.splice(fromIndex, 1);
  widgets.splice(toIndex, 0, removed);

  // Update order values
  const allWidgets = getWidgetConfig();
  const enabledOrder = new Map(widgets.map((w, i) => [w.id, i]));

  const updated = allWidgets.map((w) => ({
    ...w,
    order: enabledOrder.get(w.id) ?? w.order + 100, // Disabled widgets go to end
  }));

  saveWidgetConfig(updated.sort((a, b) => a.order - b.order));
  return updated;
}

/**
 * Reset widgets to defaults
 */
export function resetWidgetConfig(): WidgetConfig[] {
  if (typeof window === "undefined") return defaultWidgets;

  localStorage.removeItem(WIDGETS_KEY);
  window.dispatchEvent(
    new CustomEvent("widgets-changed", { detail: defaultWidgets })
  );
  return defaultWidgets;
}

/**
 * Get enabled widgets sorted by order
 */
export function getEnabledWidgets(): WidgetConfig[] {
  return getWidgetConfig()
    .filter((w) => w.enabled)
    .sort((a, b) => a.order - b.order);
}
