import { LucideIcon } from "lucide-react";
import { memo } from "react";
import { Button } from "./button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState = memo(function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="rounded-full bg-[hsl(var(--muted))] p-6 mb-4">
        <Icon className="h-12 w-12 text-[hsl(var(--muted-foreground))]" />
      </div>
      <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-2">
        {title}
      </h3>
      <p className="text-sm text-[hsl(var(--muted-foreground))] max-w-md mb-6">
        {description}
      </p>
      {action && (
        <Button onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
});
