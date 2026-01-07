"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  Settings as SettingsIcon,
  Radio,
  Bell,
  Sun,
  Globe,
  Shield,
  Info,
  Github,
  Power,
  RotateCw,
  AlertTriangle,
  Download,
  Upload,
  Database,
  Languages,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { getSettings, saveSettings, clearAllData, exportBackup, importBackup, type AppSettings } from "@/lib/settings";
import { useDeviceControl } from "@/hooks/useDeviceControl";
import { useDeviceConnection } from "@/hooks/useDeviceConnection";
import { MQTTStatusIndicator } from "@/components/mqtt/MQTTStatusIndicator";
import { SerialConnectionSettings } from "@/components/serial/SerialConnectionSettings";
import { AuthSettingsCard } from "@/components/settings/AuthSettingsCard";
import { VirtualNodesCard } from "@/components/settings/VirtualNodesCard";
import { useI18n } from "@/hooks/useI18n";

export default function SettingsPage() {
  const [theme, setTheme] = useState("light");
  const [settings, setSettingsState] = useState<AppSettings>(getSettings());
  const [testingConnection, setTestingConnection] = useState(false);
  const { language, setLanguage, languages } = useI18n();
  const [connectionStatus, setConnectionStatus] = useState<"success" | "error" | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [saveIndicator, setSaveIndicator] = useState(false);

  const { reboot, shutdown } = useDeviceControl();
  const { data: deviceInfo } = useDeviceConnection();

  useEffect(() => {
    // Check initial theme
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");

    // Listen for settings changes from other tabs
    const handleSettingsChange = (e: Event) => {
      const customEvent = e as CustomEvent<AppSettings>;
      setSettingsState(customEvent.detail);
    };

    window.addEventListener("settings-changed", handleSettingsChange);
    return () => window.removeEventListener("settings-changed", handleSettingsChange);
  }, []);

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const updated = { ...settings, [key]: value };
    setSettingsState(updated);
    saveSettings({ [key]: value });

    // Show save indicator
    setSaveIndicator(true);
    setTimeout(() => setSaveIndicator(false), 2000);
  };

  const testConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);

    try {
      const response = await fetch(`${settings.apiEndpoint}/api/v1/nodes`);
      if (response.ok) {
        setConnectionStatus("success");
      } else {
        setConnectionStatus("error");
      }
    } catch (error) {
      setConnectionStatus("error");
    } finally {
      setTestingConnection(false);
    }
  };

  const handleReboot = async () => {
    if (!confirm("Are you sure you want to reboot the device? This will temporarily disconnect you.")) {
      return;
    }

    setActionMessage(null);
    try {
      await reboot.mutateAsync();
      setActionMessage({
        type: "success",
        message: "Device is rebooting. It will be available again shortly.",
      });
    } catch (error) {
      setActionMessage({
        type: "error",
        message: "Failed to reboot the device. Please try again.",
      });
    }
  };

  const handleShutdown = async () => {
    if (!confirm("Are you sure you want to shut down the device? You will need physical access to restart it.")) {
      return;
    }

    setActionMessage(null);
    try {
      await shutdown.mutateAsync();
      setActionMessage({
        type: "success",
        message: "Device is shutting down.",
      });
    } catch (error) {
      setActionMessage({
        type: "error",
        message: "Failed to shut down the device. Please try again.",
      });
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restoreMessage, setRestoreMessage] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleExportBackup = () => {
    exportBackup();
    setRestoreMessage({
      type: "success",
      message: "Backup exported successfully",
    });
    setTimeout(() => setRestoreMessage(null), 3000);
  };

  const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setRestoreMessage(null);
    const result = await importBackup(file);
    setRestoreMessage({
      type: result.success ? "success" : "error",
      message: result.message,
    });

    // Clear the input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    // Refresh settings if successful
    if (result.success) {
      setSettingsState(getSettings());
    }
  };

  return (
    <div className="flex-1 space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <SettingsIcon className="h-8 w-8" />
            Settings
          </h1>
          <p className="text-muted-foreground">
            Manage your application preferences and configuration
          </p>
        </div>
        {saveIndicator && (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 animate-in fade-in">
            <span className="h-2 w-2 rounded-full bg-green-600 dark:bg-green-400" />
            Settings saved
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Connection Settings - Moved to dedicated Connections page */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5" />
              Connections
            </CardTitle>
            <CardDescription>Manage MQTT brokers, HTTP endpoints, and serial devices</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Connection management has moved to a dedicated page where you can configure multiple
              MQTT brokers, HTTP endpoints, and serial connections.
            </p>
            <Button asChild>
              <a href="/connections" className="flex items-center gap-2">
                <Radio className="h-4 w-4" />
                Manage Connections
              </a>
            </Button>
          </CardContent>
        </Card>

        {/* Device Control */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Power className="h-5 w-5" />
              Device Control
            </CardTitle>
            <CardDescription>Manage your Meshtastic device</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Device Status</span>
                <Badge variant={deviceInfo?.connected ? "default" : "secondary"}>
                  {deviceInfo?.connected ? "Connected" : "Disconnected"}
                </Badge>
              </div>
              {deviceInfo?.connected && deviceInfo.connectionType && (
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Connection Type</span>
                  <Badge variant="outline" className="capitalize">
                    {deviceInfo.connectionType}
                  </Badge>
                </div>
              )}
              {deviceInfo?.device && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Device Name</span>
                    <span className="text-muted-foreground">{deviceInfo.device.longName}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Node ID</span>
                    <span className="text-muted-foreground font-mono">{deviceInfo.device.nodeId}</span>
                  </div>
                </>
              )}
            </div>

            <div className="border-t pt-4 space-y-2">
              {actionMessage && (
                <div
                  className={`p-3 rounded-lg text-sm mb-3 ${
                    actionMessage.type === "success"
                      ? "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300"
                      : "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300"
                  }`}
                >
                  {actionMessage.message}
                </div>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={handleReboot}
                disabled={!deviceInfo?.connected || reboot.isPending}
              >
                <RotateCw className="h-4 w-4 mr-2" />
                {reboot.isPending ? "Rebooting..." : "Reboot Device"}
              </Button>

              <Button
                variant="destructive"
                className="w-full"
                onClick={handleShutdown}
                disabled={!deviceInfo?.connected || shutdown.isPending}
              >
                <Power className="h-4 w-4 mr-2" />
                {shutdown.isPending ? "Shutting Down..." : "Shutdown Device"}
              </Button>

              <div className="flex items-start gap-2 text-xs text-muted-foreground mt-2">
                <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>Device control requires an active connection. Shutting down requires physical access to restart.</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>Control when and how you receive notifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">New Messages</div>
                <div className="text-sm text-muted-foreground">Get notified when new messages arrive</div>
              </div>
              <Switch
                checked={settings.notifyNewMessages}
                onCheckedChange={(checked) => updateSetting("notifyNewMessages", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Node Status Changes</div>
                <div className="text-sm text-muted-foreground">
                  Get notified when nodes go online/offline
                </div>
              </div>
              <Switch
                checked={settings.notifyNewMessages}
                onCheckedChange={(checked) => updateSetting("notifyNewMessages", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Low Battery Alerts</div>
                <div className="text-sm text-muted-foreground">Get notified when node batteries are low</div>
              </div>
              <Switch
                checked={settings.notifyLowBattery}
                onCheckedChange={(checked) => updateSetting("notifyLowBattery", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Sound</div>
                <div className="text-sm text-muted-foreground">Play sounds for notifications</div>
              </div>
              <Switch
                checked={settings.notificationSound}
                onCheckedChange={(checked) => updateSetting("notificationSound", checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Appearance Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sun className="h-5 w-5" />
              Appearance
            </CardTitle>
            <CardDescription>Customize how the application looks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Theme</div>
                <div className="text-sm text-muted-foreground">Switch between light and dark mode</div>
              </div>
              <ThemeToggle />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-sm font-medium flex items-center gap-2">
                  <Languages className="h-4 w-4" />
                  Language
                </div>
                <div className="text-sm text-muted-foreground">Select your preferred language</div>
              </div>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as typeof language)}
                className="h-9 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1 text-sm"
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.nativeName}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Current Theme</div>
                <div className="text-sm text-muted-foreground">Active color scheme</div>
              </div>
              <Badge variant="outline" className="capitalize">
                {theme}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Primary Color</div>
                <div className="text-sm text-muted-foreground">Main accent color</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-primary" />
                <Badge variant="outline">Green</Badge>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Compact Mode</div>
                <div className="text-sm text-muted-foreground">Use compact layout for tables and lists</div>
              </div>
              <Switch
                checked={settings.compactMode}
                onCheckedChange={(checked) => updateSetting("compactMode", checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Map Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Map Settings
            </CardTitle>
            <CardDescription>Configure map display preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Default Map Layer</label>
              <div className="flex gap-2">
                <Badge
                  variant={settings.defaultMapLayer === "street" ? "default" : "secondary"}
                  className="cursor-pointer"
                  onClick={() => updateSetting("defaultMapLayer", "street")}
                >
                  Street
                </Badge>
                <Badge
                  variant={settings.defaultMapLayer === "satellite" ? "default" : "secondary"}
                  className="cursor-pointer"
                  onClick={() => updateSetting("defaultMapLayer", "satellite")}
                >
                  Satellite
                </Badge>
                <Badge
                  variant={settings.defaultMapLayer === "terrain" ? "default" : "secondary"}
                  className="cursor-pointer"
                  onClick={() => updateSetting("defaultMapLayer", "terrain")}
                >
                  Terrain
                </Badge>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Show Node Labels</div>
                <div className="text-sm text-muted-foreground">Display node names on the map</div>
              </div>
              <Switch
                checked={settings.showNodeLabels}
                onCheckedChange={(checked) => updateSetting("showNodeLabels", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Cluster Markers</div>
                <div className="text-sm text-muted-foreground">Group nearby nodes together</div>
              </div>
              <Switch
                checked={settings.clusterMarkers}
                onCheckedChange={(checked) => updateSetting("clusterMarkers", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Auto Center</div>
                <div className="text-sm text-muted-foreground">Automatically center map on new nodes</div>
              </div>
              <Switch
                checked={settings.autoCenter}
                onCheckedChange={(checked) => updateSetting("autoCenter", checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Privacy Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Privacy
            </CardTitle>
            <CardDescription>Manage your data and privacy preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Store Messages</div>
                <div className="text-sm text-muted-foreground">Keep message history locally</div>
              </div>
              <Switch
                checked={settings.storeMessages}
                onCheckedChange={(checked) => updateSetting("storeMessages", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Anonymous Analytics</div>
                <div className="text-sm text-muted-foreground">Help improve the app with usage data</div>
              </div>
              <Switch
                checked={settings.analytics}
                onCheckedChange={(checked) => updateSetting("analytics", checked)}
              />
            </div>

            <div className="pt-4">
              <Button variant="destructive" className="w-full" onClick={clearAllData}>
                Clear All Data
              </Button>
              <p className="mt-2 text-sm text-muted-foreground">
                This will remove all settings and cached data
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Authentication */}
        <AuthSettingsCard />

        {/* Virtual Nodes */}
        <VirtualNodesCard />

        {/* Backup & Restore */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Backup & Restore
            </CardTitle>
            <CardDescription>Export or import your settings and preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Button variant="outline" className="w-full" onClick={handleExportBackup}>
                <Download className="h-4 w-4 mr-2" />
                Export Backup
              </Button>
              <p className="text-sm text-muted-foreground">
                Download a JSON file with all your settings and alert configurations
              </p>
            </div>

            <div className="space-y-3 pt-4 border-t">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImportBackup}
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Import Backup
              </Button>
              <p className="text-sm text-muted-foreground">
                Restore settings from a previously exported backup file
              </p>
            </div>

            {restoreMessage && (
              <div className={`p-3 rounded-lg text-sm ${
                restoreMessage.type === "success"
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                  : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
              }`}>
                {restoreMessage.message}
              </div>
            )}
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              About
            </CardTitle>
            <CardDescription>Application information and resources</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Version</span>
                <Badge variant="outline">1.0.0-alpha</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Built with</span>
                <Badge variant="outline">Next.js 16 + React 19</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">License</span>
                <Badge variant="outline">MIT</Badge>
              </div>
            </div>

            <div className="pt-4">
              <Button variant="outline" className="w-full" asChild>
                <a
                  href="https://github.com/yourusername/namm"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <Github className="h-4 w-4" />
                  View on GitHub
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
