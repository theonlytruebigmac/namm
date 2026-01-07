import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success";
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          {
            "border-transparent bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]":
              variant === "default",
            "border-transparent bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]":
              variant === "secondary",
            "border-transparent bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]":
              variant === "destructive",
            "text-[hsl(var(--foreground))]": variant === "outline",
            "border-transparent bg-[hsl(var(--green))] text-[hsl(var(--base))]":
              variant === "success",
          },
          className
        )}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";

export { Badge };
