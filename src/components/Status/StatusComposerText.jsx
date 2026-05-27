"use client";

import React, { useState } from "react";
import { X, Send, Palette } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "../../hooks/useTranslation";

const TEXT_BG_COLORS = [
  "#005c4b", // WhatsApp Green
  "#7f66ff", // Purple
  "#f35369", // Coral/Red
  "#128c7e", // Teal
  "#34b7f1", // Blue
  "#4f772d", // Forest Green
  "#1b263b", // Navy Dark
  "#6f1d1b", // Maroon
  "#43281c", // Brown
  "#2a9d8f", // Greenish Teal
];

const FONT_STYLES = [
  { name: "sans", family: "system-ui, -apple-system, sans-serif" },
  { name: "serif", family: "Georgia, Cambria, serif" },
  { name: "mono", family: "Courier New, Courier, monospace" },
  { name: "handwriting", family: "'Outfit', 'Caveat', cursive, sans-serif" },
];

export function StatusComposerText({ onCancel, onSubmit, uploading, uploadProgress }) {
  const { t } = useTranslation();
  const [textContent, setTextContent] = useState("");
  const [textBgColor, setTextBgColor] = useState(TEXT_BG_COLORS[0]);
  const [textStyleIndex, setTextStyleIndex] = useState(0);

  const handleCycleBgColor = () => {
    const currentIndex = TEXT_BG_COLORS.indexOf(textBgColor);
    const nextIndex = (currentIndex + 1) % TEXT_BG_COLORS.length;
    setTextBgColor(TEXT_BG_COLORS[nextIndex]);
  };

  const handleCycleTextStyle = () => {
    setTextStyleIndex((prev) => (prev + 1) % FONT_STYLES.length);
  };

  const handleSend = () => {
    if (!textContent.trim()) return;
    onSubmit({
      textContent: textContent.trim(),
      bgColor: textBgColor,
      textStyle: FONT_STYLES[textStyleIndex].name,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="absolute inset-0 z-20 flex flex-col"
      style={{ backgroundColor: textBgColor }}
    >
      {/* Header controls */}
      <div className="flex items-center justify-between p-4 bg-black/10 shrink-0">
        <button
          onClick={onCancel}
          className="p-2 rounded-full hover:bg-black/10 text-white cursor-pointer"
          title={t("common.cancel") || "Cancel"}
        >
          <X className="h-6 w-6" />
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCycleTextStyle}
            className="p-2.5 rounded-full hover:bg-black/10 text-white cursor-pointer flex items-center justify-center font-bold text-sm h-10 w-10 border border-white/20"
            title={t("status.font_style") || "Font style"}
            style={{ fontFamily: FONT_STYLES[textStyleIndex].family }}
          >
            T
          </button>
          <button
            onClick={handleCycleBgColor}
            className="p-2.5 rounded-full hover:bg-black/10 text-white cursor-pointer flex items-center justify-center h-10 w-10 border border-white/20"
            title={t("status.bg_color") || "Background color"}
          >
            <Palette className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Input composition canvas */}
      <div className="flex-1 flex items-center justify-center px-6 sm:px-12 py-4">
        <textarea
          className="w-full max-w-2xl bg-transparent border-none text-white text-center font-medium focus:ring-0 focus:outline-none resize-none overflow-hidden placeholder-white/40"
          placeholder={t("status.type_status_update") || "Type a status update"}
          value={textContent}
          onChange={(e) => {
            setTextContent(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = e.target.scrollHeight + "px";
          }}
          rows={2}
          maxLength={500}
          style={{
            fontFamily: FONT_STYLES[textStyleIndex].family,
            fontSize: "clamp(1.5rem, 5vw, 2.5rem)",
            lineHeight: "1.4",
          }}
          autoFocus
        />
      </div>

      {/* Footer Send */}
      <div className="p-6 flex justify-end bg-black/10 shrink-0">
        {uploading ? (
          <div className="flex items-center gap-3 bg-[#00a884] text-white px-5 py-2.5 rounded-full shadow-md font-medium text-sm animate-pulse">
            <span>{t("status.uploading_percentage", { progress: uploadProgress }) || `Uploading... (${uploadProgress}%)`}</span>
          </div>
        ) : (
          <button
            onClick={handleSend}
            disabled={!textContent.trim()}
            className="h-14 w-14 rounded-full bg-[#00a884] text-white shadow-lg flex items-center justify-center cursor-pointer hover:bg-[#008f72] disabled:bg-[#00a884]/40 disabled:text-white/40 disabled:cursor-not-allowed transition-all"
            title={t("status.send_status_update") || "Send status update"}
          >
            <Send className="h-6 w-6 translate-x-0.5" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
