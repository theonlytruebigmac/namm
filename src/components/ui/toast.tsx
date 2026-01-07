"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { X, Send, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface Toast {
  id: string;
  type: "message" | "info" | "success" | "warning" | "error";
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  quickReply?: {
    placeholder: string;
    onReply: (message: string) => void;
  };
  duration?: number; // milliseconds, 0 = persistent
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const [replyText, setReplyText] = useState("");
  const [showReply, setShowReply] = useState(false);
  const [sending, setSending] = useState(false);

  const handleReply = async () => {
    if (!replyText.trim() || !toast.quickReply) return;
    setSending(true);
    try {
      await toast.quickReply.onReply(replyText.trim());
      setReplyText("");
      setShowReply(false);
      onRemove();
    } catch (error) {
      console.error("Failed to send reply:", error);
    } finally {
      setSending(false);
    }
  };

  const bgColor = {
    message: "bg-[hsl(var(--green))]",
    info: "bg-[hsl(var(--blue))]",
    success: "bg-[hsl(var(--green))]",
    warning: "bg-[hsl(var(--yellow))]",
    error: "bg-[hsl(var(--red))]",
  }[toast.type];

  return (
    <div
      className={cn(
        "relative w-80 rounded-lg shadow-lg overflow-hidden",
        "bg-[hsl(var(--card))] border border-[hsl(var(--border))]",
        "animate-in slide-in-from-right-full duration-300"
      )}
    >
      {/* Colored accent bar */}
      <div className={cn("absolute top-0 left-0 w-1 h-full", bgColor)} />

      <div className="p-4 pl-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {toast.type === "message" && (
              <MessageSquare className="h-4 w-4 text-[hsl(var(--green))]" />
            )}
            <h4 className="font-semibold text-sm text-[hsl(var(--foreground))]">
              {toast.title}
            </h4>
          </div>
          <button
            onClick={onRemove}
            className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Description */}
        {toast.description && (
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))] line-clamp-2">
            {toast.description}
          </p>
        )}

        {/* Actions */}
        <div className="mt-3 flex items-center gap-2">
          {toast.action && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                toast.action?.onClick();
                onRemove();
              }}
            >
              {toast.action.label}
            </Button>
          )}

          {toast.quickReply && !showReply && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowReply(true)}
            >
              <Send className="h-3 w-3 mr-1" />
              Quick Reply
            </Button>
          )}
        </div>

        {/* Quick Reply Input */}
        {showReply && toast.quickReply && (
          <div className="mt-3 flex gap-2">
            <Input
              placeholder={toast.quickReply.placeholder}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleReply();
                }
                if (e.key === "Escape") {
                  setShowReply(false);
                }
              }}
              className="flex-1"
              autoFocus
            />
            <Button
              size="sm"
              onClick={handleReply}
              disabled={!replyText.trim() || sending}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast = { ...toast, id };

    setToasts((prev) => [...prev, newToast]);

    // Auto-remove after duration (default 5s, 0 = persistent)
    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, clearAll }}>
      {children}

      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onRemove={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// Convenience hooks for common toast types
export function useMessageToast() {
  const { addToast } = useToast();

  return useCallback((
    from: string,
    message: string,
    onReply?: (replyText: string) => void
  ) => {
    return addToast({
      type: "message",
      title: `New message from ${from}`,
      description: message,
      duration: onReply ? 0 : 5000, // Persistent if quick reply enabled
      quickReply: onReply ? {
        placeholder: "Type a reply...",
        onReply,
      } : undefined,
      action: {
        label: "View",
        onClick: () => {
          window.location.href = "/messages";
        },
      },
    });
  }, [addToast]);
}
