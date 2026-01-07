import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onSearch?: (value: string) => void;
}

export function SearchInput({ className, onSearch, ...props }: SearchInputProps) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
      <input
        type="text"
        className={cn(
          "w-full pl-10 pr-4 py-2 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg",
          "text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]",
          "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:border-transparent",
          "transition-all",
          className
        )}
        onChange={(e) => onSearch?.(e.target.value)}
        {...props}
      />
    </div>
  );
}
