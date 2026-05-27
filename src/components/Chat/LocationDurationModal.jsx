"use client";

import React, { useState } from "react";
import { X, Navigation, Info } from "lucide-react";
import { useTranslation } from "../../hooks/useTranslation";

export default function LocationDurationModal({ onClose, onShare }) {
  const { t } = useTranslation();
  const [selectedDuration, setSelectedDuration] = useState(1 * 60 * 60 * 1000); // Default to 1 hour (ms)

  const durations = [
    { label: t("chat.duration_15_minutes") || "15 Minutes", value: 15 * 60 * 1000 },
    { label: t("chat.duration_1_hour") || "1 Hour", value: 1 * 60 * 60 * 1000 },
    { label: t("chat.duration_8_hours") || "8 Hours", value: 8 * 60 * 60 * 1000 },
  ];

  const handleShareClick = () => {
    onShare(selectedDuration);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none">
      <div className="bg-wa-sidebar border border-wa-border rounded-2xl w-full max-w-sm flex flex-col overflow-hidden shadow-2xl animate-scale-up">
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-wa-border bg-wa-header">
          <span className="font-bold text-wa-text text-sm flex items-center gap-2">
            <Navigation className="h-4 w-4 text-[#00a884] fill-[#00a884] transform rotate-45 -translate-y-0.5" />
            {t("chat.share_live_location_title") || "Share Live Location"}
          </span>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-wa-active text-wa-muted hover:text-wa-text transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Content */}
        <div className="p-5 flex flex-col gap-4">
          <p className="text-xs text-wa-muted leading-relaxed">
            {t("chat.live_location_desc") || "Participants in this chat will see your location in real-time. This feature updates even when the app is in the background."}
          </p>

          <div className="flex items-start gap-2.5 p-3 bg-[#ffeecd]/20 dark:bg-[#182229]/65 rounded-xl border border-[#ffeecd]/30">
            <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-wa-text leading-normal">
              {t("chat.live_location_stop_desc") || "You can stop sharing your live location at any time directly from the message bubble or map."}
            </p>
          </div>

          <div className="flex flex-col gap-2 mt-2">
            <span className="text-xs font-semibold text-wa-text">{t("chat.select_sharing_duration") || "Select sharing duration"}</span>
            <div className="grid grid-cols-3 gap-2">
              {durations.map((d) => (
                <button
                   key={d.value}
                   onClick={() => setSelectedDuration(d.value)}
                   className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${
                     selectedDuration === d.value
                       ? "bg-wa-primary text-white border-wa-primary shadow-xs"
                       : "bg-wa-hover text-wa-text border-wa-border hover:bg-wa-active"
                   }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <footer className="px-5 py-3 border-t border-wa-border bg-wa-header flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-3.5 py-2 hover:bg-wa-hover rounded-xl text-xs font-bold text-wa-text transition-colors"
          >
            {t("common.cancel") || "Cancel"}
          </button>
          <button
            onClick={handleShareClick}
            className="px-5 py-2 bg-wa-primary hover:bg-wa-primary-hover text-white rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            {t("chat.share_live_location") || "Share Location"}
          </button>
        </footer>
      </div>
    </div>
  );
}
