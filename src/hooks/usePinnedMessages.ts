"use client";

import { useState, useEffect, useCallback } from "react";
import type { Message } from "@/types";

export interface PinnedMessage {
  messageId: string;
  channel: number;
  pinnedAt: number;
  pinnedBy?: string;
}

const STORAGE_KEY = "namm-pinned-messages";

function loadPinnedMessages(): PinnedMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function savePinnedMessages(messages: PinnedMessage[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    window.dispatchEvent(new CustomEvent("pinned-messages-changed", { detail: messages }));
  } catch (error) {
    console.error("Failed to save pinned messages:", error);
  }
}

export function usePinnedMessages(channel?: number) {
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from storage on mount
  useEffect(() => {
    setPinnedMessages(loadPinnedMessages());
    setIsLoaded(true);

    const handleChange = (e: CustomEvent<PinnedMessage[]>) => {
      setPinnedMessages(e.detail);
    };

    window.addEventListener("pinned-messages-changed", handleChange as EventListener);
    return () => {
      window.removeEventListener("pinned-messages-changed", handleChange as EventListener);
    };
  }, []);

  // Save whenever pinned messages change
  useEffect(() => {
    if (isLoaded) {
      savePinnedMessages(pinnedMessages);
    }
  }, [pinnedMessages, isLoaded]);

  const pinMessage = useCallback((messageId: string, messageChannel: number, pinnedBy?: string) => {
    setPinnedMessages((prev) => {
      if (prev.some((p) => p.messageId === messageId)) {
        return prev; // Already pinned
      }
      return [
        ...prev,
        {
          messageId,
          channel: messageChannel,
          pinnedAt: Date.now(),
          pinnedBy,
        },
      ];
    });
  }, []);

  const unpinMessage = useCallback((messageId: string) => {
    setPinnedMessages((prev) => prev.filter((p) => p.messageId !== messageId));
  }, []);

  const isPinned = useCallback(
    (messageId: string): boolean => {
      return pinnedMessages.some((p) => p.messageId === messageId);
    },
    [pinnedMessages]
  );

  const togglePin = useCallback(
    (messageId: string, messageChannel: number, pinnedBy?: string) => {
      if (isPinned(messageId)) {
        unpinMessage(messageId);
      } else {
        pinMessage(messageId, messageChannel, pinnedBy);
      }
    },
    [isPinned, pinMessage, unpinMessage]
  );

  // Filter by channel if provided
  const channelPinnedMessages = channel !== undefined
    ? pinnedMessages.filter((p) => p.channel === channel)
    : pinnedMessages;

  return {
    pinnedMessages: channelPinnedMessages,
    allPinnedMessages: pinnedMessages,
    pinMessage,
    unpinMessage,
    isPinned,
    togglePin,
  };
}
