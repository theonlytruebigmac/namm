import { getSettings } from "./settings";

/**
 * Browser notification system with settings integration
 */

// Request notification permission from user
export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    console.warn("This browser does not support notifications");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  return false;
}

// Check if notifications are supported and enabled in settings
export function canShowNotification(type: "message" | "nodeStatus" | "lowBattery"): boolean {
  if (!("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;

  const settings = getSettings();

  switch (type) {
    case "message":
      return settings.notifyNewMessages;
    case "nodeStatus":
      return settings.notifyNodeStatus;
    case "lowBattery":
      return settings.notifyLowBattery;
    default:
      return false;
  }
}

// Play notification sound if enabled
function playNotificationSound() {
  const settings = getSettings();
  if (!settings.notificationSound) return;

  try {
    // Simple beep sound using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = "sine";
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (error) {
    console.error("Failed to play notification sound:", error);
  }
}

// Show notification for new message
export function notifyNewMessage(from: string, message: string) {
  if (!canShowNotification("message")) return;

  const notification = new Notification("New Message", {
    body: `${from}: ${message.substring(0, 100)}${message.length > 100 ? "..." : ""}`,
    icon: "/icon-192.png",
    badge: "/icon-96.png",
    tag: "new-message",
  });

  playNotificationSound();

  notification.onclick = () => {
    window.focus();
    notification.close();
  };

  // Auto-close after 5 seconds
  setTimeout(() => notification.close(), 5000);
}

// Show notification for node status change
export function notifyNodeStatus(nodeName: string, status: "online" | "offline") {
  if (!canShowNotification("nodeStatus")) return;

  const notification = new Notification("Node Status Change", {
    body: `${nodeName} is now ${status}`,
    icon: "/icon-192.png",
    badge: "/icon-96.png",
    tag: `node-status-${nodeName}`,
  });

  playNotificationSound();

  notification.onclick = () => {
    window.focus();
    notification.close();
  };

  setTimeout(() => notification.close(), 5000);
}

// Show notification for low battery
export function notifyLowBattery(nodeName: string, batteryLevel: number) {
  if (!canShowNotification("lowBattery")) return;

  const notification = new Notification("Low Battery Alert", {
    body: `${nodeName} battery is at ${batteryLevel}%`,
    icon: "/icon-192.png",
    badge: "/icon-96.png",
    tag: `low-battery-${nodeName}`,
    requireInteraction: true, // Requires user to dismiss
  });

  playNotificationSound();

  notification.onclick = () => {
    window.focus();
    notification.close();
  };
}

// Check notification permission status
export function getNotificationPermission(): NotificationPermission {
  if (!("Notification" in window)) return "denied";
  return Notification.permission;
}

// Initialize notifications (call this once on app load)
export async function initializeNotifications() {
  const settings = getSettings();

  // Only request permission if any notifications are enabled
  const anyEnabled = settings.notifyNewMessages || settings.notifyNodeStatus || settings.notifyLowBattery;

  if (anyEnabled && Notification.permission === "default") {
    await requestNotificationPermission();
  }
}
