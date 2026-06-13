import React from "react";
import { useTranslation } from "../../../hooks/useTranslation";
import { cn } from "../../../utils/cn";

export function WallpaperPreview({
  selectedType,
  currentVal,
  dimVal,
  chatName,
  chatAvatar,
  className,
}) {
  const { t } = useTranslation();

  const getPreviewBackgroundStyle = () => {
    if (!currentVal) return { backgroundColor: "var(--wa-bg)" };

    if (selectedType === "color") {
      return { backgroundColor: currentVal };
    }
    if (selectedType === "gradient") {
      return { backgroundImage: currentVal };
    }
    if (selectedType === "gallery" || selectedType === "upload") {
      return {
        backgroundImage: `url(${currentVal})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      };
    }
    return { backgroundColor: "var(--wa-bg)" };
  };

  const getPreviewOverlayStyle = () => {
    const style = { backgroundColor: "transparent" };
    if (selectedType === "gallery" || selectedType === "upload") {
      style.backgroundImage = "none";
    }
    return style;
  };

  return (
    <div className={cn("flex flex-col border border-wa-border rounded-2xl overflow-hidden shadow-md bg-wa-sidebar min-h-[480px]", className)}>
      {/* Header Preview */}
      <div className="bg-wa-header px-4 py-3 border-b border-wa-border flex items-center gap-3 shrink-0">
        <div className="h-8 w-8 rounded-full bg-wa-primary flex items-center justify-center text-white text-xs font-bold shadow-sm">
          {chatAvatar || (chatName ? chatName[0] : "P")}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-semibold text-wa-text truncate">
            {chatName || "Preview Chat"}
          </span>
          <span className="text-[9px] text-wa-muted truncate">
            {t("chat.online") || "Online"}
          </span>
        </div>
      </div>

      {/* Message Area Preview */}
      <div
        className="flex-1 relative overflow-hidden transition-all duration-300 min-h-[350px]"
        style={getPreviewBackgroundStyle()}
      >
        {/* Dimming Layer */}
        <div
          className="absolute inset-0 bg-black transition-opacity duration-300 pointer-events-none z-10"
          style={{ opacity: dimVal / 100 }}
        />

        {/* Pattern Overlay & Message Bubble Content */}
        <div
          className="absolute inset-0 p-4 flex flex-col justify-end gap-3 wa-chat-bg z-20"
          style={getPreviewOverlayStyle()}
        >
          {/* Encrypted Info Bubble */}
          <div className="flex justify-center mb-1">
            <span className="bg-[#ffeecd]/85 dark:bg-wa-sidebar/90 backdrop-blur-xs text-wa-muted text-[8px] px-2.5 py-0.75 rounded-md shadow-sm text-center border border-wa-border/30">
              🔒 {t("common.encrypted") || "Messages are end-to-end encrypted"}
            </span>
          </div>

          {/* Bubble 1: Incoming */}
          <div className="flex justify-start z-10 max-w-[85%]">
            <div className="bg-wa-bubble-in text-wa-text text-[11px] px-3 py-2 rounded-2xl rounded-tl-none shadow-xs border border-wa-border/10 relative wa-bubble-shadow">
              <p className="leading-relaxed">
                {t("chat.preview_incoming") ||
                  "Hey! How does this wallpaper look in real chat bubbles?"}
              </p>
              <span className="text-[8px] text-wa-muted float-right mt-1 ml-2 font-medium">
                10:04 AM
              </span>
            </div>
          </div>

          {/* Bubble 2: Outgoing */}
          <div className="flex justify-end z-10 max-w-[85%] self-end">
            <div className="bg-wa-bubble-out text-wa-text text-[11px] px-3 py-2 rounded-2xl rounded-tr-none shadow-xs border border-wa-border/10 relative wa-bubble-shadow">
              <p className="leading-relaxed">
                {t("chat.preview_outgoing") ||
                  "Looks amazing! Contrast and readability are perfect. 🔥"}
              </p>
              <div className="float-right mt-1 ml-2 flex items-center gap-0.5">
                <span className="text-[8px] text-wa-muted font-medium">
                  10:05 AM
                </span>
                <span className="text-blue-500 text-[10px] font-bold">✓✓</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Bar Preview */}
      <div className="bg-wa-header px-4 py-3 border-t border-wa-border flex items-center gap-2 shrink-0">
        <div className="flex-1 bg-wa-input h-8 rounded-lg border border-wa-border px-3 text-[10px] text-wa-muted flex items-center">
          {t("chat.type_message") || "Type a message"}
        </div>
      </div>
    </div>
  );
}
