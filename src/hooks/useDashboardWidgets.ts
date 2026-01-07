"use client";

import { useState, useEffect, useCallback } from "react";
import {
  type WidgetConfig,
  getWidgetConfig,
  saveWidgetConfig,
  toggleWidget,
  reorderWidgets,
  resetWidgetConfig,
  getEnabledWidgets,
} from "@/lib/dashboard-widgets";

/**
 * Hook for managing dashboard widgets
 */
export function useDashboardWidgets() {
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [loading, setLoading] = useState(true);

  // Load widgets on mount
  useEffect(() => {
    setWidgets(getWidgetConfig());
    setLoading(false);
  }, []);

  // Listen for changes from other tabs/components
  useEffect(() => {
    const handleChange = (e: Event) => {
      const customEvent = e as CustomEvent<WidgetConfig[]>;
      setWidgets(customEvent.detail);
    };

    window.addEventListener("widgets-changed", handleChange);
    return () => window.removeEventListener("widgets-changed", handleChange);
  }, []);

  // Toggle widget visibility
  const toggle = useCallback((widgetId: string) => {
    const updated = toggleWidget(widgetId);
    setWidgets(updated);
  }, []);

  // Reorder widgets
  const reorder = useCallback((fromIndex: number, toIndex: number) => {
    const updated = reorderWidgets(fromIndex, toIndex);
    setWidgets(updated);
  }, []);

  // Reset to defaults
  const reset = useCallback(() => {
    const defaults = resetWidgetConfig();
    setWidgets(defaults);
  }, []);

  // Update widget config
  const updateWidget = useCallback((widgetId: string, updates: Partial<WidgetConfig>) => {
    const current = getWidgetConfig();
    const updated = current.map((w) =>
      w.id === widgetId ? { ...w, ...updates } : w
    );
    saveWidgetConfig(updated);
    setWidgets(updated);
  }, []);

  // Check if a specific widget is enabled
  const isWidgetEnabled = useCallback(
    (widgetId: string): boolean => {
      const widget = widgets.find((w) => w.id === widgetId);
      return widget?.enabled ?? false;
    },
    [widgets]
  );

  // Get only enabled widgets
  const enabledWidgets = widgets
    .filter((w) => w.enabled)
    .sort((a, b) => a.order - b.order);

  return {
    widgets,
    enabledWidgets,
    loading,
    toggle,
    reorder,
    reset,
    updateWidget,
    isWidgetEnabled,
  };
}
