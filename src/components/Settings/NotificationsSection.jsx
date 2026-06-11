"use client";

import React, { useState } from "react";
import { useTranslation } from "../../hooks/useTranslation";

export function NotificationsSection() {
  const { t } = useTranslation();
  const [notifSound, setNotifSound] = useState(true);
  const [notifDesktop, setNotifDesktop] = useState(true);
  const [notifPreviews, setNotifPreviews] = useState(true);
  const [notifMute, setNotifMute] = useState("none");

  return (
    <div className="bg-wa-sidebar p-5 border border-wa-border/50 rounded-2xl space-y-6 animate-fade-in">
      <span className="text-[10px] text-wa-primary font-bold uppercase tracking-wider block">
        {t("settings.notifications_settings") || "Notification Preferences"}
      </span>
      
      {/* Sound Alerts */}
      <div className="flex items-center justify-between py-2 border-b border-wa-border/20">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-wa-text">{t("settings.message_sounds") || "Sound Alerts"}</span>
          <span className="text-xs text-wa-muted">
            {t("settings.message_sounds_desc") || "Play sound notifications for incoming messages."}
          </span>
        </div>
        <label className="relative inline-flex items-center cursor-pointer select-none">
          <input
            type="checkbox"
            checked={notifSound}
            onChange={(e) => setNotifSound(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-wa-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-wa-muted peer-checked:after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-wa-primary"></div>
        </label>
      </div>

      {/* Desktop Alerts */}
      <div className="flex items-center justify-between py-2 border-b border-wa-border/20">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-wa-text">{t("settings.desktop_alerts") || "Desktop Notifications"}</span>
          <span className="text-xs text-wa-muted">
            {t("settings.desktop_alerts_desc") || "Show notification cards on your desktop."}
          </span>
        </div>
        <label className="relative inline-flex items-center cursor-pointer select-none">
          <input
            type="checkbox"
            checked={notifDesktop}
            onChange={(e) => setNotifDesktop(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-wa-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-wa-muted peer-checked:after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-wa-primary"></div>
        </label>
      </div>

      {/* Previews */}
      <div className="flex items-center justify-between py-2 border-b border-wa-border/20">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-wa-text">{t("settings.message_previews") || "Show Previews"}</span>
          <span className="text-xs text-wa-muted">
            {t("settings.message_previews_desc") || "Display message text in notification cards."}
          </span>
        </div>
        <label className="relative inline-flex items-center cursor-pointer select-none">
          <input
            type="checkbox"
            checked={notifPreviews}
            onChange={(e) => setNotifPreviews(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-wa-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-wa-muted peer-checked:after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-wa-primary"></div>
        </label>
      </div>

      {/* Mute select */}
      <div className="flex items-center justify-between py-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-wa-text">{t("settings.mute_notifications") || "Mute Alerts"}</span>
          <span className="text-xs text-wa-muted">
            {t("settings.mute_notifications_desc") || "Temporarily mute sounds and alert alerts."}
          </span>
        </div>
        <select
          value={notifMute}
          onChange={(e) => setNotifMute(e.target.value)}
          className="h-9 px-3 bg-wa-header border border-wa-border text-wa-text rounded-xl text-xs focus:outline-none font-semibold cursor-pointer"
        >
          <option value="none">{t("chat.off") || "Always On"}</option>
          <option value="8h">{t("settings.eight_hours") || "Mute for 8 Hours"}</option>
          <option value="1w">{t("settings.one_week") || "Mute for 1 Week"}</option>
          <option value="always">{t("settings.always") || "Muted Always"}</option>
        </select>
      </div>
    </div>
  );
}

