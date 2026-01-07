"use client";

import { useState, useEffect, useCallback } from "react";

export interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  shortcut?: string;
  createdAt: number;
  usageCount: number;
}

const STORAGE_KEY = "namm-message-templates";

export function useMessageTemplates() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setTemplates(JSON.parse(stored));
      } catch {
        console.error("Failed to parse message templates");
      }
    }
    setIsLoaded(true);
  }, []);

  // Persist to localStorage
  useEffect(() => {
    if (!isLoaded || typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  }, [templates, isLoaded]);

  const createTemplate = useCallback((name: string, content: string, shortcut?: string) => {
    const template: MessageTemplate = {
      id: `template-${Date.now()}`,
      name,
      content,
      shortcut,
      createdAt: Date.now(),
      usageCount: 0,
    };
    setTemplates((prev) => [...prev, template]);
    return template;
  }, []);

  const updateTemplate = useCallback((id: string, updates: Partial<Omit<MessageTemplate, "id" | "createdAt">>) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  }, []);

  const deleteTemplate = useCallback((id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const useTemplate = useCallback((id: string): string | null => {
    const template = templates.find((t) => t.id === id);
    if (template) {
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, usageCount: t.usageCount + 1 } : t
        )
      );
      return template.content;
    }
    return null;
  }, [templates]);

  const getTemplateByShortcut = useCallback((shortcut: string): MessageTemplate | undefined => {
    return templates.find((t) => t.shortcut === shortcut);
  }, [templates]);

  const recentTemplates = templates
    .slice()
    .sort((a, b) => b.usageCount - a.usageCount)
    .slice(0, 5);

  return {
    templates,
    recentTemplates,
    isLoaded,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    useTemplate,
    getTemplateByShortcut,
  };
}
