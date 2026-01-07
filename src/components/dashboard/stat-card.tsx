import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { memo, ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  color?: "default" | "green" | "blue" | "yellow" | "red";
}

const colorClasses = {
  default: "text-[hsl(var(--primary))]",
  green: "text-[hsl(var(--green))]",
  blue: "text-[hsl(var(--blue))]",
  yellow: "text-[hsl(var(--yellow))]",
  red: "text-[hsl(var(--red))]",
};

export const StatCard = memo(function StatCard({ title, value, description, icon: Icon, trend, color = "default" }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${colorClasses[color]}`}>
          {value}
        </div>
        {description && (
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
            {description}
          </p>
        )}
        {trend && (
          <div className="flex items-center gap-1 text-xs mt-2">
            <span className={trend.value >= 0 ? "text-[hsl(var(--green))]" : "text-[hsl(var(--red))]"}>
              {trend.value >= 0 ? "+" : ""}{trend.value}%
            </span>
            <span className="text-[hsl(var(--muted-foreground))]">
              {trend.label}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
