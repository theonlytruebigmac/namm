"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, Network, MessageSquare, Radio, Map, FileAudio } from "lucide-react";

const navigation = [
  { name: "Home", href: "/", icon: Home },
  { name: "Network", href: "/network", icon: Network },
  { name: "Messages", href: "/messages", icon: MessageSquare },
  { name: "Nodes", href: "/nodes", icon: Radio },
  { name: "Captures", href: "/captures", icon: FileAudio },
  { name: "Map", href: "/map", icon: Map },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[hsl(var(--background))] border-t border-[hsl(var(--border))]">
      <div className="flex justify-around items-center h-16 px-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors",
                isActive
                  ? "text-[hsl(var(--primary))] bg-[hsl(var(--accent))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
