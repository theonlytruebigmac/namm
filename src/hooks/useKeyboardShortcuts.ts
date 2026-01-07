"use client";

import { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";

interface ShortcutAction {
  key: string;
  modifiers?: ("ctrl" | "meta" | "shift" | "alt")[];
  description: string;
  action: () => void;
  global?: boolean;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
}

/**
 * Global keyboard shortcuts hook
 */
export function useKeyboardShortcuts(
  shortcuts: ShortcutAction[],
  options: UseKeyboardShortcutsOptions = {}
) {
  const { enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        // Allow some global shortcuts even in input fields
        const matchingGlobalShortcut = shortcuts.find(
          (s) => s.global && matchesShortcut(event, s)
        );
        if (!matchingGlobalShortcut) return;
      }

      for (const shortcut of shortcuts) {
        if (matchesShortcut(event, shortcut)) {
          event.preventDefault();
          shortcut.action();
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts, enabled]);
}

function matchesShortcut(event: KeyboardEvent, shortcut: ShortcutAction): boolean {
  const key = shortcut.key.toLowerCase();
  const eventKey = event.key.toLowerCase();

  // Handle special keys
  if (key === "escape" && eventKey !== "escape") return false;
  if (key !== "escape" && eventKey !== key) return false;

  const modifiers = shortcut.modifiers || [];

  const needsCtrl = modifiers.includes("ctrl");
  const needsMeta = modifiers.includes("meta");
  const needsShift = modifiers.includes("shift");
  const needsAlt = modifiers.includes("alt");

  // Accept either Ctrl or Meta for cross-platform support
  const hasCtrlOrMeta = event.ctrlKey || event.metaKey;

  if ((needsCtrl || needsMeta) && !hasCtrlOrMeta) return false;
  if (needsShift && !event.shiftKey) return false;
  if (needsAlt && !event.altKey) return false;

  // Make sure we're not matching unintended modifier combinations
  if (!needsCtrl && !needsMeta && hasCtrlOrMeta) return false;
  if (!needsShift && event.shiftKey && key.length === 1) return false;
  if (!needsAlt && event.altKey) return false;

  return true;
}

/**
 * Default navigation shortcuts for the app
 */
export function useNavigationShortcuts() {
  const router = useRouter();

  const shortcuts: ShortcutAction[] = [
    {
      key: "d",
      modifiers: ["ctrl"],
      description: "Go to Dashboard",
      action: () => router.push("/"),
    },
    {
      key: "n",
      modifiers: ["ctrl"],
      description: "Go to Nodes",
      action: () => router.push("/nodes"),
    },
    {
      key: "m",
      modifiers: ["ctrl"],
      description: "Go to Messages",
      action: () => router.push("/messages"),
    },
    {
      key: "t",
      modifiers: ["ctrl"],
      description: "Go to Telemetry",
      action: () => router.push("/telemetry"),
    },
    {
      key: "p",
      modifiers: ["ctrl"],
      description: "Go to Map",
      action: () => router.push("/map"),
    },
    {
      key: "r",
      modifiers: ["ctrl"],
      description: "Go to Traceroutes",
      action: () => router.push("/traceroutes"),
    },
    {
      key: ",",
      modifiers: ["ctrl"],
      description: "Go to Settings",
      action: () => router.push("/settings"),
    },
  ];

  useKeyboardShortcuts(shortcuts);
  return shortcuts;
}

/**
 * Hook to show/hide keyboard shortcuts help
 */
export function useShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  // ? key to show help, Escape to close
  useKeyboardShortcuts([
    {
      key: "?",
      modifiers: ["shift"],
      description: "Show keyboard shortcuts",
      action: toggle,
      global: true,
    },
    {
      key: "Escape",
      description: "Close shortcuts help",
      action: close,
      global: true,
    },
  ]);

  return { isOpen, open, close, toggle };
}
