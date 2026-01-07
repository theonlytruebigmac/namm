/**
 * Internationalization (i18n) System
 *
 * Simple client-side translation system with support for multiple languages.
 * Stores user preference in localStorage.
 */

export type Language = "en" | "es" | "de" | "fr" | "pt" | "ja" | "zh";

export interface LanguageInfo {
  code: Language;
  name: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: "en", name: "English", nativeName: "English", flag: "🇺��" },
  { code: "es", name: "Spanish", nativeName: "Español", flag: "🇪🇸" },
  { code: "de", name: "German", nativeName: "Deutsch", flag: "🇩🇪" },
  { code: "fr", name: "French", nativeName: "Français", flag: "🇫🇷" },
  { code: "pt", name: "Portuguese", nativeName: "Português", flag: "🇧🇷" },
  { code: "ja", name: "Japanese", nativeName: "日本語", flag: "🇯🇵" },
  { code: "zh", name: "Chinese", nativeName: "中文", flag: "🇨🇳" },
];

const LANGUAGE_KEY = "namm-language";
const DEFAULT_LANGUAGE: Language = "en";

// All translation keys
export type TranslationKey =
  | "common.loading" | "common.error" | "common.save" | "common.cancel"
  | "common.delete" | "common.edit" | "common.search" | "common.filter"
  | "common.clear" | "common.close" | "common.refresh" | "common.export"
  | "common.import" | "common.download" | "common.upload" | "common.success"
  | "common.failed" | "common.enabled" | "common.disabled" | "common.online"
  | "common.offline" | "common.all" | "common.none"
  | "nav.dashboard" | "nav.network" | "nav.messages" | "nav.nodes"
  | "nav.map" | "nav.traceroutes" | "nav.mqtt" | "nav.telemetry"
  | "nav.captures" | "nav.alerts" | "nav.settings"
  | "dashboard.title" | "dashboard.totalNodes" | "dashboard.onlineNodes"
  | "dashboard.messagesTotal" | "dashboard.messagesLast24h" | "dashboard.networkHealth"
  | "messages.title" | "messages.send" | "messages.typeMessage"
  | "messages.noMessages" | "messages.channel" | "messages.reply" | "messages.reactions"
  | "nodes.title" | "nodes.description" | "nodes.searchPlaceholder"
  | "nodes.noNodes" | "nodes.lastHeard" | "nodes.battery" | "nodes.snr" | "nodes.hops"
  | "settings.title" | "settings.description" | "settings.connection"
  | "settings.notifications" | "settings.appearance" | "settings.privacy"
  | "settings.backup" | "settings.about" | "settings.language" | "settings.theme"
  | "alerts.title" | "alerts.description" | "alerts.active"
  | "alerts.history" | "alerts.thresholds" | "alerts.acknowledgeAll" | "alerts.noAlerts"
  | "captures.title" | "captures.description" | "captures.startCapture"
  | "captures.stopCapture" | "captures.recording" | "captures.noCaptures"
  | "map.title" | "map.layers" | "map.satellite" | "map.terrain" | "map.street"
  | "traceroutes.title" | "traceroutes.description" | "traceroutes.sendTrace"
  | "traceroutes.pathAnalysis" | "traceroutes.findPath" | "traceroutes.noTraceroutes";

// Simple translations object - built lazily
function buildTranslations(): Record<Language, Record<TranslationKey, string>> {
  const english: Record<TranslationKey, string> = {
    "common.loading": "Loading...", "common.error": "Error", "common.save": "Save",
    "common.cancel": "Cancel", "common.delete": "Delete", "common.edit": "Edit",
    "common.search": "Search", "common.filter": "Filter", "common.clear": "Clear",
    "common.close": "Close", "common.refresh": "Refresh", "common.export": "Export",
    "common.import": "Import", "common.download": "Download", "common.upload": "Upload",
    "common.success": "Success", "common.failed": "Failed", "common.enabled": "Enabled",
    "common.disabled": "Disabled", "common.online": "Online", "common.offline": "Offline",
    "common.all": "All", "common.none": "None",
    "nav.dashboard": "Dashboard", "nav.network": "Network", "nav.messages": "Messages",
    "nav.nodes": "Nodes", "nav.map": "Map", "nav.traceroutes": "Traceroutes",
    "nav.mqtt": "MQTT", "nav.telemetry": "Telemetry", "nav.captures": "Captures",
    "nav.alerts": "Alerts", "nav.settings": "Settings",
    "dashboard.title": "Dashboard", "dashboard.totalNodes": "Total Nodes",
    "dashboard.onlineNodes": "Online Nodes", "dashboard.messagesTotal": "Total Messages",
    "dashboard.messagesLast24h": "Messages (24h)", "dashboard.networkHealth": "Network Health",
    "messages.title": "Messages", "messages.send": "Send",
    "messages.typeMessage": "Type a message...", "messages.noMessages": "No messages yet",
    "messages.channel": "Channel", "messages.reply": "Reply", "messages.reactions": "Reactions",
    "nodes.title": "Nodes", "nodes.description": "View all nodes in the mesh network",
    "nodes.searchPlaceholder": "Search nodes...", "nodes.noNodes": "No nodes found",
    "nodes.lastHeard": "Last heard", "nodes.battery": "Battery",
    "nodes.snr": "SNR", "nodes.hops": "Hops",
    "settings.title": "Settings", "settings.description": "Manage your application preferences",
    "settings.connection": "Connection", "settings.notifications": "Notifications",
    "settings.appearance": "Appearance", "settings.privacy": "Privacy",
    "settings.backup": "Backup & Restore", "settings.about": "About",
    "settings.language": "Language", "settings.theme": "Theme",
    "alerts.title": "Alerts", "alerts.description": "Configure threshold-based alerts",
    "alerts.active": "Active Alerts", "alerts.history": "Alert History",
    "alerts.thresholds": "Alert Thresholds", "alerts.acknowledgeAll": "Acknowledge All",
    "alerts.noAlerts": "No alerts",
    "captures.title": "Packet Capture",
    "captures.description": "Capture mesh network traffic in PCAP format",
    "captures.startCapture": "Start Capture", "captures.stopCapture": "Stop Capture",
    "captures.recording": "Recording", "captures.noCaptures": "No captures yet",
    "map.title": "Map", "map.layers": "Layers", "map.satellite": "Satellite",
    "map.terrain": "Terrain", "map.street": "Street",
    "traceroutes.title": "Traceroutes",
    "traceroutes.description": "View mesh network routing paths",
    "traceroutes.sendTrace": "Trace Route", "traceroutes.pathAnalysis": "Path Analysis",
    "traceroutes.findPath": "Find Path", "traceroutes.noTraceroutes": "No traceroutes yet",
  };

  return {
    en: english,
    es: english, // Fallback
    de: english, // Fallback
    fr: english, // Fallback
    pt: english, // Fallback
    ja: english, // Fallback
    zh: english, // Fallback
  };
}

let cachedTranslations: Record<Language, Record<TranslationKey, string>> | null = null;

function getTranslations(): Record<Language, Record<TranslationKey, string>> {
  if (!cachedTranslations) {
    cachedTranslations = buildTranslations();
  }
  return cachedTranslations;
}

export function getLanguage(): Language {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  try {
    const stored = localStorage.getItem(LANGUAGE_KEY);
    if (stored && SUPPORTED_LANGUAGES.find((l) => l.code === stored)) {
      return stored as Language;
    }
    const browserLang = navigator.language.split("-")[0];
    if (SUPPORTED_LANGUAGES.find((l) => l.code === browserLang)) {
      return browserLang as Language;
    }
  } catch {
    // Ignore
  }
  return DEFAULT_LANGUAGE;
}

export function setLanguage(lang: Language): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LANGUAGE_KEY, lang);
    window.dispatchEvent(new CustomEvent("language-changed", { detail: lang }));
  } catch {
    // Ignore
  }
}

export function t(key: TranslationKey, lang?: Language): string {
  const language = lang || getLanguage();
  const translations = getTranslations();
  return translations[language]?.[key] || translations.en[key] || key;
}

export function getTranslationsForLanguage(lang?: Language): Record<TranslationKey, string> {
  const language = lang || getLanguage();
  const translations = getTranslations();
  return translations[language] || translations.en;
}
