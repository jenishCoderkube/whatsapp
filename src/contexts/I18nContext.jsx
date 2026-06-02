"use client";

import React, { createContext, useState, useEffect, useContext, useCallback, useMemo } from "react";
import enTranslations from "../locales/en.json";
import hiTranslations from "../locales/hi.json";
import guTranslations from "../locales/gu.json";

const translations = {
  en: enTranslations,
  hi: hiTranslations,
  gu: guTranslations,
};

export const languageNames = {
  en: "English",
  hi: "हिन्दी (Hindi)",
  gu: "ગુજરાતી (Gujarati)",
};

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [locale, setLocale] = useState("en");

  // Load language preference from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedLocale = localStorage.getItem("language_preference");
      if (savedLocale && translations[savedLocale]) {
        setLocale(savedLocale);
      }
    }
  }, []);

  // Update HTML dir and lang attributes dynamically for RTL / language support
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const changeLanguage = useCallback((langCode) => {
    if (translations[langCode]) {
      setLocale(langCode);
      if (typeof window !== "undefined") {
        localStorage.setItem("language_preference", langCode);
      }
    } else {
      console.warn(`Translation for language code "${langCode}" is not available.`);
    }
  }, []);

  const t = useCallback((key, variables = {}) => {
    const keys = key.split(".");
    let value = translations[locale];

    for (const k of keys) {
      if (value && typeof value === "object") {
        value = value[k];
      } else {
        value = undefined;
        break;
      }
    }

    // Fallback to English if not found in current locale
    if (value === undefined && locale !== "en") {
      value = translations["en"];
      for (const k of keys) {
        if (value && typeof value === "object") {
          value = value[k];
        } else {
          value = undefined;
          break;
        }
      }
    }

    // If still not found, return the key itself
    if (value === undefined) {
      return key;
    }

    // If translation is a string, replace variables in format {varName}
    if (typeof value === "string") {
      let result = value;
      Object.keys(variables).forEach((k) => {
        result = result.replace(new RegExp(`{${k}}`, "g"), variables[k]);
      });
      return result;
    }

    return value;
  }, [locale]);

  const value = useMemo(() => ({
    locale,
    t,
    changeLanguage,
    availableLanguages: Object.keys(translations),
    languageNames,
  }), [locale, t, changeLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useTranslation must be used within an I18nProvider");
  }
  return context;
}
