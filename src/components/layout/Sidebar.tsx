"use client";

import { memo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ConnectionStatusBadge } from "@/components/layout/ConnectionStatus";
import type { LucideIcon } from "lucide-react";
import {
  Home,
  Network,
  MessageSquare,
  Radio,
  Map,
  Settings,
  Activity,
  Zap,
  Route,
  Keyboard,
  FileAudio,
  Bell,
  GitCompare,
  Cable,
  Usb,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Network", href: "/network", icon: Network },
  { name: "Messages", href: "/messages", icon: MessageSquare },
  { name: "Nodes", href: "/nodes", icon: Radio },
  { name: "Compare", href: "/compare", icon: GitCompare },
  { name: "Map", href: "/map", icon: Map },
  { name: "Traceroutes", href: "/traceroutes", icon: Route },
  { name: "MQTT", href: "/mqtt", icon: Zap },
  { name: "Serial", href: "/serial", icon: Usb },
  { name: "Telemetry", href: "/telemetry", icon: Activity },
  { name: "Captures", href: "/captures", icon: FileAudio },
  { name: "Alerts", href: "/alerts", icon: Bell },
  { name: "Connections", href: "/connections", icon: Cable },
  { name: "Settings", href: "/settings", icon: Settings },
];

interface NavItemProps {
  name: string;
  href: string;
  icon: LucideIcon;
  isActive: boolean;
}

const NavItem = memo(function NavItem({ name, href, icon: Icon, isActive }: NavItemProps) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          "group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold transition-colors",
          isActive
            ? "bg-[hsl(var(--accent))] text-[hsl(var(--primary))]"
            : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
        )}
      >
        <Icon
          className={cn(
            "h-6 w-6 shrink-0",
            isActive
              ? "text-[hsl(var(--primary))]"
              : "text-[hsl(var(--muted-foreground))] group-hover:text-[hsl(var(--foreground))]"
          )}
        />
        {name}
      </Link>
    </li>
  );
});

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
      <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-[hsl(var(--background))] border-r border-[hsl(var(--border))] px-6 pb-4">
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--green))] flex items-center justify-center">
              <Radio className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-[hsl(var(--foreground))]">
              NAMM
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col">
          <ul role="list" className="flex flex-1 flex-col gap-y-7">
            <li>
              <ul role="list" className="-mx-2 space-y-1">
                {navigation.map((item) => (
                  <NavItem
                    key={item.name}
                    name={item.name}
                    href={item.href}
                    icon={item.icon}
                    isActive={pathname === item.href}
                  />
                ))}
              </ul>
            </li>
          </ul>
        </nav>

        {/* Status indicator */}
        <div className="border-t border-[hsl(var(--border))] pt-4 space-y-3">
          {/* Keyboard shortcut hint */}
          <button
            className="w-full flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            onClick={() => {
              // Trigger the keyboard shortcuts help by dispatching a keydown event
              const event = new KeyboardEvent('keydown', { key: '?', shiftKey: true });
              window.dispatchEvent(event);
            }}
          >
            <Keyboard className="h-3 w-3" />
            <span>Press <kbd className="px-1 py-0.5 bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded text-[10px]">?</kbd> for shortcuts</span>
          </button>
          <div className="flex items-center justify-between">
            <ConnectionStatusBadge />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </aside>
  );
}
