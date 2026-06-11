"use client";

import React, { useState } from "react";
import { useTranslation } from "../../hooks/useTranslation";

export function SecuritySection() {
  const { t } = useTranslation();
  const [securityNotif, setSecurityNotif] = useState(false);

  return (
    <div className="bg-wa-sidebar p-5 border border-wa-border/50 rounded-2xl space-y-6 animate-fade-in">
      <span className="text-[10px] text-wa-primary font-bold uppercase tracking-wider block">
        {t("settings.security_info") || "Security Settings"}
      </span>
      
      <div className="flex items-center justify-between py-2 border-b border-wa-border/20">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-wa-text">
            {t("settings.security_notifications") || "Show Security Notifications"}
          </span>
          <span className="text-xs text-wa-muted">
            {t("settings.security_notifications_desc") || "Get notifications when a contact's security code changes for an end-to-end encrypted chat."}
          </span>
        </div>
        <label className="relative inline-flex items-center cursor-pointer select-none">
          <input
            type="checkbox"
            checked={securityNotif}
            onChange={(e) => setSecurityNotif(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-wa-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-wa-muted peer-checked:after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-wa-primary"></div>
        </label>
      </div>

      <div className="p-4 rounded-xl bg-wa-header/20 border border-wa-border/30 space-y-2">
        <span className="text-xs font-semibold text-wa-text block">
          {t("settings.e2e_encryption") || "End-to-End Encryption"}
        </span>
        <p className="text-xs text-wa-muted leading-relaxed">
          {t("settings.e2e_encryption_desc") || "Your personal messages and calls are secured with end-to-end encryption. This means only you and the person you choose can read or listen to them, not even WhatsApp Web can view or access them."}
        </p>
      </div>
    </div>
  );
}

