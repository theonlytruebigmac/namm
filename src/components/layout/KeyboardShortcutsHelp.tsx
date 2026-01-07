"use client";

import { useNavigationShortcuts, useShortcutsHelp } from "@/hooks/useKeyboardShortcuts";
import { X, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ShortcutRowProps {
  keys: string[];
  description: string;
}

function ShortcutRow({ keys, description }: ShortcutRowProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-[hsl(var(--foreground))]">{description}</span>
      <div className="flex items-center gap-1">
        {keys.map((key, idx) => (
          <span key={idx}>
            <kbd className="px-2 py-1 text-xs font-mono bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded">
              {key}
            </kbd>
            {idx < keys.length - 1 && (
              <span className="mx-1 text-[hsl(var(--muted-foreground))]">+</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

export function KeyboardShortcutsHelp() {
  const { isOpen, close } = useShortcutsHelp();

  // Initialize navigation shortcuts
  useNavigationShortcuts();

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={close}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--border))]">
            <div className="flex items-center gap-2">
              <Keyboard className="h-5 w-5 text-[hsl(var(--primary))]" />
              <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">
                Keyboard Shortcuts
              </h2>
            </div>
            <Button variant="ghost" size="icon" onClick={close}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-6 max-h-[60vh] overflow-y-auto">
            {/* Navigation */}
            <div>
              <h3 className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-3">
                Navigation
              </h3>
              <div className="divide-y divide-[hsl(var(--border))]">
                <ShortcutRow keys={["Ctrl", "D"]} description="Go to Dashboard" />
                <ShortcutRow keys={["Ctrl", "N"]} description="Go to Nodes" />
                <ShortcutRow keys={["Ctrl", "M"]} description="Go to Messages" />
                <ShortcutRow keys={["Ctrl", "T"]} description="Go to Telemetry" />
                <ShortcutRow keys={["Ctrl", "P"]} description="Go to Map" />
                <ShortcutRow keys={["Ctrl", "R"]} description="Go to Traceroutes" />
                <ShortcutRow keys={["Ctrl", ","]} description="Go to Settings" />
              </div>
            </div>

            {/* General */}
            <div>
              <h3 className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-3">
                General
              </h3>
              <div className="divide-y divide-[hsl(var(--border))]">
                <ShortcutRow keys={["?"]} description="Show keyboard shortcuts" />
                <ShortcutRow keys={["Esc"]} description="Close dialogs/modals" />
              </div>
            </div>

            {/* Messages */}
            <div>
              <h3 className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-3">
                Messages (when on Messages page)
              </h3>
              <div className="divide-y divide-[hsl(var(--border))]">
                <ShortcutRow keys={["/"]} description="Focus message input" />
                <ShortcutRow keys={["Enter"]} description="Send message" />
              </div>
            </div>

            {/* Nodes */}
            <div>
              <h3 className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-3">
                Nodes (when on Nodes page)
              </h3>
              <div className="divide-y divide-[hsl(var(--border))]">
                <ShortcutRow keys={["/"]} description="Focus search" />
                <ShortcutRow keys={["F"]} description="Toggle favorites filter" />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-[hsl(var(--border))] text-center">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Press <kbd className="px-1 py-0.5 text-xs font-mono bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded">?</kbd> anytime to show this help
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
