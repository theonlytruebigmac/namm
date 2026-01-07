import { useState, useEffect } from "react";
import { getSettings, type AppSettings } from "@/lib/settings";

/**
 * React hook to access application settings with live updates
 * Automatically syncs with localStorage changes across tabs
 */
export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(getSettings());

  useEffect(() => {
    // Listen for settings changes from other components/tabs
    const handleSettingsChange = (e: Event) => {
      const customEvent = e as CustomEvent<AppSettings>;
      setSettings(customEvent.detail);
    };

    window.addEventListener("settings-changed", handleSettingsChange);
    return () => window.removeEventListener("settings-changed", handleSettingsChange);
  }, []);

  return settings;
}
