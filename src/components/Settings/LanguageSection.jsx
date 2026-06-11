"use client";

import React from "react";
import { useTranslation } from "../../hooks/useTranslation";
import { cn } from "../../utils/cn";

export function LanguageSection() {
  const { t, locale, changeLanguage, availableLanguages, languageNames } = useTranslation();

  return (
    <div className="bg-wa-sidebar p-5 border border-wa-border/50 rounded-2xl space-y-4 animate-fade-in">
      <span className="text-[10px] text-wa-primary font-bold uppercase tracking-wider block">Language Settings</span>
      <p className="text-xs text-wa-muted">{t("sidebar.select_language")}</p>
      
      <div className="flex flex-col gap-2">
        {availableLanguages.map((langCode) => {
          const isSelected = locale === langCode;
          return (
            <button
              key={langCode}
              onClick={() => changeLanguage(langCode)}
              className={cn(
                "flex items-center justify-between p-3.5 rounded-xl border transition-all text-left w-full cursor-pointer",
                isSelected
                  ? "bg-wa-primary/10 border-wa-primary text-wa-primary font-semibold"
                  : "bg-wa-header/20 border-wa-border/40 text-wa-text hover:bg-wa-hover hover:border-wa-border/60"
              )}
            >
              <div className="flex flex-col">
                <span className="text-sm font-semibold">{languageNames[langCode] || langCode}</span>
                <span className="text-[10px] text-wa-muted uppercase mt-0.5">{langCode}</span>
              </div>
              <div className={cn(
                "flex items-center justify-center h-5 w-5 rounded-full border transition-all shrink-0",
                isSelected ? "border-wa-primary bg-wa-primary" : "border-wa-border"
              )}>
                {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
