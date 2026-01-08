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

  const spanish: Record<TranslationKey, string> = {
    "common.loading": "Cargando...", "common.error": "Error", "common.save": "Guardar",
    "common.cancel": "Cancelar", "common.delete": "Eliminar", "common.edit": "Editar",
    "common.search": "Buscar", "common.filter": "Filtrar", "common.clear": "Limpiar",
    "common.close": "Cerrar", "common.refresh": "Actualizar", "common.export": "Exportar",
    "common.import": "Importar", "common.download": "Descargar", "common.upload": "Subir",
    "common.success": "Éxito", "common.failed": "Fallido", "common.enabled": "Habilitado",
    "common.disabled": "Deshabilitado", "common.online": "En línea", "common.offline": "Desconectado",
    "common.all": "Todo", "common.none": "Ninguno",
    "nav.dashboard": "Panel", "nav.network": "Red", "nav.messages": "Mensajes",
    "nav.nodes": "Nodos", "nav.map": "Mapa", "nav.traceroutes": "Rutas",
    "nav.mqtt": "MQTT", "nav.telemetry": "Telemetría", "nav.captures": "Capturas",
    "nav.alerts": "Alertas", "nav.settings": "Ajustes",
    "dashboard.title": "Panel", "dashboard.totalNodes": "Total de Nodos",
    "dashboard.onlineNodes": "Nodos en Línea", "dashboard.messagesTotal": "Mensajes Totales",
    "dashboard.messagesLast24h": "Mensajes (24h)", "dashboard.networkHealth": "Estado de Red",
    "messages.title": "Mensajes", "messages.send": "Enviar",
    "messages.typeMessage": "Escribe un mensaje...", "messages.noMessages": "Sin mensajes aún",
    "messages.channel": "Canal", "messages.reply": "Responder", "messages.reactions": "Reacciones",
    "nodes.title": "Nodos", "nodes.description": "Ver todos los nodos de la red mesh",
    "nodes.searchPlaceholder": "Buscar nodos...", "nodes.noNodes": "No se encontraron nodos",
    "nodes.lastHeard": "Último contacto", "nodes.battery": "Batería",
    "nodes.snr": "SNR", "nodes.hops": "Saltos",
    "settings.title": "Ajustes", "settings.description": "Gestiona tus preferencias",
    "settings.connection": "Conexión", "settings.notifications": "Notificaciones",
    "settings.appearance": "Apariencia", "settings.privacy": "Privacidad",
    "settings.backup": "Respaldo", "settings.about": "Acerca de",
    "settings.language": "Idioma", "settings.theme": "Tema",
    "alerts.title": "Alertas", "alerts.description": "Configura alertas por umbral",
    "alerts.active": "Alertas Activas", "alerts.history": "Historial",
    "alerts.thresholds": "Umbrales", "alerts.acknowledgeAll": "Reconocer Todo",
    "alerts.noAlerts": "Sin alertas",
    "captures.title": "Captura de Paquetes",
    "captures.description": "Captura tráfico de red mesh en formato PCAP",
    "captures.startCapture": "Iniciar", "captures.stopCapture": "Detener",
    "captures.recording": "Grabando", "captures.noCaptures": "Sin capturas aún",
    "map.title": "Mapa", "map.layers": "Capas", "map.satellite": "Satélite",
    "map.terrain": "Terreno", "map.street": "Calle",
    "traceroutes.title": "Rutas",
    "traceroutes.description": "Ver rutas de la red mesh",
    "traceroutes.sendTrace": "Trazar Ruta", "traceroutes.pathAnalysis": "Análisis de Ruta",
    "traceroutes.findPath": "Buscar Ruta", "traceroutes.noTraceroutes": "Sin rutas aún",
  };

  const german: Record<TranslationKey, string> = {
    "common.loading": "Laden...", "common.error": "Fehler", "common.save": "Speichern",
    "common.cancel": "Abbrechen", "common.delete": "Löschen", "common.edit": "Bearbeiten",
    "common.search": "Suchen", "common.filter": "Filtern", "common.clear": "Löschen",
    "common.close": "Schließen", "common.refresh": "Aktualisieren", "common.export": "Exportieren",
    "common.import": "Importieren", "common.download": "Herunterladen", "common.upload": "Hochladen",
    "common.success": "Erfolg", "common.failed": "Fehlgeschlagen", "common.enabled": "Aktiviert",
    "common.disabled": "Deaktiviert", "common.online": "Online", "common.offline": "Offline",
    "common.all": "Alle", "common.none": "Keine",
    "nav.dashboard": "Dashboard", "nav.network": "Netzwerk", "nav.messages": "Nachrichten",
    "nav.nodes": "Knoten", "nav.map": "Karte", "nav.traceroutes": "Traceroutes",
    "nav.mqtt": "MQTT", "nav.telemetry": "Telemetrie", "nav.captures": "Aufnahmen",
    "nav.alerts": "Warnungen", "nav.settings": "Einstellungen",
    "dashboard.title": "Dashboard", "dashboard.totalNodes": "Gesamt Knoten",
    "dashboard.onlineNodes": "Online Knoten", "dashboard.messagesTotal": "Nachrichten Gesamt",
    "dashboard.messagesLast24h": "Nachrichten (24h)", "dashboard.networkHealth": "Netzwerkstatus",
    "messages.title": "Nachrichten", "messages.send": "Senden",
    "messages.typeMessage": "Nachricht eingeben...", "messages.noMessages": "Noch keine Nachrichten",
    "messages.channel": "Kanal", "messages.reply": "Antworten", "messages.reactions": "Reaktionen",
    "nodes.title": "Knoten", "nodes.description": "Alle Mesh-Netzwerk Knoten anzeigen",
    "nodes.searchPlaceholder": "Knoten suchen...", "nodes.noNodes": "Keine Knoten gefunden",
    "nodes.lastHeard": "Zuletzt gehört", "nodes.battery": "Akku",
    "nodes.snr": "SNR", "nodes.hops": "Hops",
    "settings.title": "Einstellungen", "settings.description": "Anwendungseinstellungen verwalten",
    "settings.connection": "Verbindung", "settings.notifications": "Benachrichtigungen",
    "settings.appearance": "Aussehen", "settings.privacy": "Datenschutz",
    "settings.backup": "Sicherung", "settings.about": "Über",
    "settings.language": "Sprache", "settings.theme": "Design",
    "alerts.title": "Warnungen", "alerts.description": "Schwellenwert-Warnungen konfigurieren",
    "alerts.active": "Aktive Warnungen", "alerts.history": "Verlauf",
    "alerts.thresholds": "Schwellenwerte", "alerts.acknowledgeAll": "Alle Bestätigen",
    "alerts.noAlerts": "Keine Warnungen",
    "captures.title": "Paketaufnahme",
    "captures.description": "Mesh-Netzwerk Traffic im PCAP-Format aufnehmen",
    "captures.startCapture": "Starten", "captures.stopCapture": "Stoppen",
    "captures.recording": "Aufnahme", "captures.noCaptures": "Noch keine Aufnahmen",
    "map.title": "Karte", "map.layers": "Ebenen", "map.satellite": "Satellit",
    "map.terrain": "Gelände", "map.street": "Straße",
    "traceroutes.title": "Traceroutes",
    "traceroutes.description": "Mesh-Netzwerk Routenpfade anzeigen",
    "traceroutes.sendTrace": "Route Tracen", "traceroutes.pathAnalysis": "Pfadanalyse",
    "traceroutes.findPath": "Pfad Finden", "traceroutes.noTraceroutes": "Noch keine Traceroutes",
  };

  const french: Record<TranslationKey, string> = {
    "common.loading": "Chargement...", "common.error": "Erreur", "common.save": "Enregistrer",
    "common.cancel": "Annuler", "common.delete": "Supprimer", "common.edit": "Modifier",
    "common.search": "Rechercher", "common.filter": "Filtrer", "common.clear": "Effacer",
    "common.close": "Fermer", "common.refresh": "Actualiser", "common.export": "Exporter",
    "common.import": "Importer", "common.download": "Télécharger", "common.upload": "Envoyer",
    "common.success": "Succès", "common.failed": "Échec", "common.enabled": "Activé",
    "common.disabled": "Désactivé", "common.online": "En ligne", "common.offline": "Hors ligne",
    "common.all": "Tout", "common.none": "Aucun",
    "nav.dashboard": "Tableau de Bord", "nav.network": "Réseau", "nav.messages": "Messages",
    "nav.nodes": "Nœuds", "nav.map": "Carte", "nav.traceroutes": "Traceroutes",
    "nav.mqtt": "MQTT", "nav.telemetry": "Télémétrie", "nav.captures": "Captures",
    "nav.alerts": "Alertes", "nav.settings": "Paramètres",
    "dashboard.title": "Tableau de Bord", "dashboard.totalNodes": "Total des Nœuds",
    "dashboard.onlineNodes": "Nœuds en Ligne", "dashboard.messagesTotal": "Messages Totaux",
    "dashboard.messagesLast24h": "Messages (24h)", "dashboard.networkHealth": "État du Réseau",
    "messages.title": "Messages", "messages.send": "Envoyer",
    "messages.typeMessage": "Tapez un message...", "messages.noMessages": "Pas encore de messages",
    "messages.channel": "Canal", "messages.reply": "Répondre", "messages.reactions": "Réactions",
    "nodes.title": "Nœuds", "nodes.description": "Voir tous les nœuds du réseau mesh",
    "nodes.searchPlaceholder": "Rechercher des nœuds...", "nodes.noNodes": "Aucun nœud trouvé",
    "nodes.lastHeard": "Dernier contact", "nodes.battery": "Batterie",
    "nodes.snr": "SNR", "nodes.hops": "Sauts",
    "settings.title": "Paramètres", "settings.description": "Gérer vos préférences",
    "settings.connection": "Connexion", "settings.notifications": "Notifications",
    "settings.appearance": "Apparence", "settings.privacy": "Confidentialité",
    "settings.backup": "Sauvegarde", "settings.about": "À propos",
    "settings.language": "Langue", "settings.theme": "Thème",
    "alerts.title": "Alertes", "alerts.description": "Configurer les alertes de seuil",
    "alerts.active": "Alertes Actives", "alerts.history": "Historique",
    "alerts.thresholds": "Seuils", "alerts.acknowledgeAll": "Tout Confirmer",
    "alerts.noAlerts": "Aucune alerte",
    "captures.title": "Capture de Paquets",
    "captures.description": "Capturer le trafic réseau mesh au format PCAP",
    "captures.startCapture": "Démarrer", "captures.stopCapture": "Arrêter",
    "captures.recording": "Enregistrement", "captures.noCaptures": "Pas encore de captures",
    "map.title": "Carte", "map.layers": "Couches", "map.satellite": "Satellite",
    "map.terrain": "Terrain", "map.street": "Rue",
    "traceroutes.title": "Traceroutes",
    "traceroutes.description": "Voir les chemins de routage du réseau mesh",
    "traceroutes.sendTrace": "Tracer Route", "traceroutes.pathAnalysis": "Analyse de Chemin",
    "traceroutes.findPath": "Trouver Chemin", "traceroutes.noTraceroutes": "Pas encore de traceroutes",
  };

  return {
    en: english,
    es: spanish,
    de: german,
    fr: french,
    pt: english, // Fallback to English
    ja: english, // Fallback to English
    zh: english, // Fallback to English
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
