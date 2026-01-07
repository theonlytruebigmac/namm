"use client";

import { useState, useEffect, useCallback } from "react";
import {
  type Language,
  type TranslationKey,
  getLanguage,
  setLanguage as setLanguagePersistent,
  t as translate,
  SUPPORTED_LANGUAGES,
} from "@/lib/i18n";

/**
 * Hook for internationalization
 */
export function useI18n() {
  const [language, setLanguageState] = useState<Language>("en");
  const [mounted, setMounted] = useState(false);

  // Load language on mount
  useEffect(() => {
    setLanguageState(getLanguage());
    setMounted(true);
  }, []);

  // Listen for language changes
  useEffect(() => {
    const handleLanguageChange = (e: Event) => {
      const customEvent = e as CustomEvent<Language>;
      setLanguageState(customEvent.detail);
    };

    window.addEventListener("language-changed", handleLanguageChange);
    return () => window.removeEventListener("language-changed", handleLanguageChange);
  }, []);

  // Set language
  const setLanguage = useCallback((lang: Language) => {
    setLanguagePersistent(lang);
    setLanguageState(lang);
  }, []);

  // Translation function
  const t = useCallback(
    (key: TranslationKey): string => {
      return translate(key, language);
    },
    [language]
  );

  return {
    language,
    setLanguage,
    t,
    languages: SUPPORTED_LANGUAGES,
    mounted,
  };
}

/**
 * Hook for just the translation function (lighter weight)
 */
export function useTranslation() {
  const { t, language } = useI18n();
  return { t, language };
}
