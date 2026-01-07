"use client";

import { useState, useEffect, useCallback } from "react";
import {
  type AlertThreshold,
  type AlertEvent,
  getAlertThresholds,
  saveAlertThresholds,
  updateAlertThreshold,
  deleteAlertThreshold,
  addAlertThreshold,
  getAlertEvents,
  acknowledgeAlert,
  acknowledgeAllAlerts,
  clearAllAlerts,
  getUnacknowledgedAlertCount,
  resetAllAlertThresholds,
} from "@/lib/alerts";

const THRESHOLDS_KEY = "namm-alert-thresholds";
const ALERTS_KEY = "namm-alert-events";

export function useAlertThresholds() {
  const [thresholds, setThresholds] = useState<AlertThreshold[]>([]);
  const [loading, setLoading] = useState(true);

  // Load thresholds on mount
  useEffect(() => {
    setThresholds(getAlertThresholds());
    setLoading(false);
  }, []);

  // Sync across tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === THRESHOLDS_KEY && e.newValue) {
        try {
          setThresholds(JSON.parse(e.newValue));
        } catch {
          // Ignore parse errors
        }
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const update = useCallback((id: string, updates: Partial<AlertThreshold>) => {
    const result = updateAlertThreshold(id, updates);
    if (result) {
      setThresholds((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
      );
    }
    return result;
  }, []);

  const remove = useCallback((id: string) => {
    const success = deleteAlertThreshold(id);
    if (success) {
      setThresholds((prev) => prev.filter((t) => t.id !== id));
    }
    return success;
  }, []);

  const add = useCallback((threshold: Omit<AlertThreshold, "id" | "triggerCount">) => {
    const newThreshold = addAlertThreshold(threshold);
    setThresholds((prev) => [...prev, newThreshold]);
    return newThreshold;
  }, []);

  const reset = useCallback(() => {
    const defaults = resetAllAlertThresholds();
    setThresholds(defaults);
    return defaults;
  }, []);

  const toggleEnabled = useCallback((id: string) => {
    const threshold = thresholds.find((t) => t.id === id);
    if (threshold) {
      return update(id, { enabled: !threshold.enabled });
    }
    return null;
  }, [thresholds, update]);

  return {
    thresholds,
    loading,
    update,
    remove,
    add,
    reset,
    toggleEnabled,
  };
}

export function useAlertEvents() {
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [unacknowledgedCount, setUnacknowledgedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Load events on mount
  useEffect(() => {
    setEvents(getAlertEvents());
    setUnacknowledgedCount(getUnacknowledgedAlertCount());
    setLoading(false);
  }, []);

  // Poll for new events (since they can be created by different components)
  useEffect(() => {
    const interval = setInterval(() => {
      const current = getAlertEvents();
      setEvents(current);
      setUnacknowledgedCount(current.filter((e) => !e.acknowledged).length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Sync across tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === ALERTS_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setEvents(parsed);
          setUnacknowledgedCount(parsed.filter((e: AlertEvent) => !e.acknowledged).length);
        } catch {
          // Ignore parse errors
        }
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const acknowledge = useCallback((id: string) => {
    const success = acknowledgeAlert(id);
    if (success) {
      setEvents((prev) =>
        prev.map((e) => (e.id === id ? { ...e, acknowledged: true } : e))
      );
      setUnacknowledgedCount((prev) => Math.max(0, prev - 1));
    }
    return success;
  }, []);

  const acknowledgeAll = useCallback(() => {
    acknowledgeAllAlerts();
    setEvents((prev) => prev.map((e) => ({ ...e, acknowledged: true })));
    setUnacknowledgedCount(0);
  }, []);

  const clearAll = useCallback(() => {
    clearAllAlerts();
    setEvents([]);
    setUnacknowledgedCount(0);
  }, []);

  const refresh = useCallback(() => {
    const current = getAlertEvents();
    setEvents(current);
    setUnacknowledgedCount(current.filter((e) => !e.acknowledged).length);
  }, []);

  return {
    events,
    unacknowledgedCount,
    loading,
    acknowledge,
    acknowledgeAll,
    clearAll,
    refresh,
  };
}
