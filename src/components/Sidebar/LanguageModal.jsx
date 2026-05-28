"use client";

import React from "react";
import { Modal } from "../ui/Modal";
import { cn } from "../../utils/cn";
import { useTranslation } from "../../hooks/useTranslation";

export function LanguageModal({
  isOpen,
  onClose,
  availableLanguages = [],
  locale,
  languageNames = {},
  changeLanguage,
}) {
  const { t } = useTranslation();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("sidebar.language_settings")}
    >
      <div className="flex flex-col py-2 max-h-[75vh] overflow-y-auto px-4 select-none">
        <p className="text-xs text-wa-muted mb-4">
          {t("sidebar.select_language")}
        </p>
        <div className="flex flex-col gap-2">
          {availableLanguages.map((langCode) => {
            const isSelected = locale === langCode;
            return (
              <button
                key={langCode}
                onClick={() => {
                  changeLanguage(langCode);
                }}
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl border transition-all text-left w-full outline-none cursor-pointer",
                  isSelected
                    ? "bg-wa-primary/10 border-wa-primary text-wa-primary font-semibold"
                    : "bg-wa-header border-wa-border/40 text-wa-text hover:bg-wa-hover hover:border-wa-border/60"
                )}
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {languageNames[langCode] || langCode}
                  </span>
                  <span className="text-[10px] text-wa-muted uppercase mt-0.5">
                    {langCode}
                  </span>
                </div>
                <div
                  className={cn(
                    "flex items-center justify-center h-5 w-5 rounded-full border transition-all shrink-0",
                    isSelected
                      ? "border-wa-primary bg-wa-primary"
                      : "border-wa-border"
                  )}
                >
                  {isSelected && (
                    <div className="h-2 w-2 rounded-full bg-white" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
