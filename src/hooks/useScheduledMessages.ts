"use client";

import { useState, useEffect, useCallback } from "react";

export interface ScheduledMessage {
  id: string;
  text: string;
  channel: number;
  scheduledTime: number; // Unix timestamp
  status: "pending" | "sent" | "failed" | "cancelled";
  createdAt: number;
  sentAt?: number;
  error?: string;
}

const STORAGE_KEY = "namm-scheduled-messages";

function loadScheduledMessages(): ScheduledMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveScheduledMessages(messages: ScheduledMessage[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch (error) {
    console.error("Failed to save scheduled messages:", error);
  }
}

export function useScheduledMessages() {
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from storage on mount
  useEffect(() => {
    setMessages(loadScheduledMessages());
    setIsLoaded(true);
  }, []);

  // Save whenever messages change
  useEffect(() => {
    if (isLoaded) {
      saveScheduledMessages(messages);
    }
  }, [messages, isLoaded]);

  const scheduleMessage = useCallback(
    (text: string, channel: number, scheduledTime: Date | number): string => {
      const id = `sched-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = scheduledTime instanceof Date ? scheduledTime.getTime() : scheduledTime;

      const newMessage: ScheduledMessage = {
        id,
        text,
        channel,
        scheduledTime: timestamp,
        status: "pending",
        createdAt: Date.now(),
      };

      setMessages((prev) => [...prev, newMessage]);
      return id;
    },
    []
  );

  const cancelMessage = useCallback((id: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id && m.status === "pending" ? { ...m, status: "cancelled" as const } : m))
    );
  }, []);

  const markAsSent = useCallback((id: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: "sent" as const, sentAt: Date.now() } : m))
    );
  }, []);

  const markAsFailed = useCallback((id: string, error: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status: "failed" as const, error } : m)));
  }, []);

  const deleteMessage = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setMessages((prev) => prev.filter((m) => m.status === "pending"));
  }, []);

  const pendingMessages = messages.filter((m) => m.status === "pending");
  const completedMessages = messages.filter((m) => m.status !== "pending");

  return {
    messages,
    pendingMessages,
    completedMessages,
    scheduleMessage,
    cancelMessage,
    markAsSent,
    markAsFailed,
    deleteMessage,
    clearCompleted,
  };
}

// Hook to process scheduled messages
export function useScheduledMessageProcessor(sendMessage: (text: string, channel: number) => Promise<void>) {
  const { pendingMessages, markAsSent, markAsFailed } = useScheduledMessages();

  useEffect(() => {
    const interval = setInterval(async () => {
      const now = Date.now();

      for (const message of pendingMessages) {
        if (message.scheduledTime <= now) {
          try {
            await sendMessage(message.text, message.channel);
            markAsSent(message.id);
          } catch (error) {
            markAsFailed(message.id, error instanceof Error ? error.message : "Unknown error");
          }
        }
      }
    }, 1000); // Check every second

    return () => clearInterval(interval);
  }, [pendingMessages, sendMessage, markAsSent, markAsFailed]);
}
