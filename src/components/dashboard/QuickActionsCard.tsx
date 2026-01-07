"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Zap,
  MessageSquare,
  Map,
  Radio,
  Route,
  FileAudio,
  Settings,
  Activity,
} from "lucide-react";
import Link from "next/link";

interface QuickAction {
  label: string;
  href: string;
  icon: typeof Zap;
  color: string;
}

const quickActions: QuickAction[] = [
  { label: "Messages", href: "/messages", icon: MessageSquare, color: "text-[hsl(var(--mauve))]" },
  { label: "Map", href: "/map", icon: Map, color: "text-[hsl(var(--green))]" },
  { label: "Nodes", href: "/nodes", icon: Radio, color: "text-[hsl(var(--blue))]" },
  { label: "Traceroutes", href: "/traceroutes", icon: Route, color: "text-[hsl(var(--yellow))]" },
  { label: "Captures", href: "/captures", icon: FileAudio, color: "text-[hsl(var(--peach))]" },
  { label: "Telemetry", href: "/telemetry", icon: Activity, color: "text-[hsl(var(--teal))]" },
];

export function QuickActionsCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="h-4 w-4" />
          Quick Actions
        </CardTitle>
        <CardDescription>Shortcuts to common tasks</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href}>
              <Button
                variant="outline"
                className="w-full h-auto py-3 flex-col gap-1"
              >
                <action.icon className={`h-5 w-5 ${action.color}`} />
                <span className="text-xs">{action.label}</span>
              </Button>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
