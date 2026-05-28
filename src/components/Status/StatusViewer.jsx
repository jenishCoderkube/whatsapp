"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Trash2, Volume2, VolumeX, Play, Pause, ChevronLeft, ChevronRight, Send, Eye } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Input } from "../ui/Input";
import { StatusViewersDrawer } from "./StatusViewersDrawer";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { useAppSelector } from "../../hooks/useRedux";
import { useTranslation } from "../../hooks/useTranslation";
import { formatMessageTime } from "../../utils/dateUtils";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
  loading: () => {
    const { t } = useTranslation();
    return (
      <div className="w-[280px] h-[350px] bg-wa-modal flex items-center justify-center text-xs text-wa-muted">
        {t("chat.loading_emojis") || "Loading Emojis..."}
      </div>
    );
  },
});

const FONT_STYLES = [
  { name: "sans", family: "system-ui, -apple-system, sans-serif" },
  { name: "serif", family: "Georgia, Cambria, serif" },
  { name: "mono", family: "Courier New, Courier, monospace" },
  { name: "handwriting", family: "'Outfit', 'Caveat', cursive, sans-serif" },
];

export function StatusViewer({
  activeUserId,
  activeGroup,
  activeStatusIndex,
  activeStatus,
  currentUser,
  viewerProgress,
  isPaused,
  isMuted,
  replyText,
  onSetReplyText,
  onSetIsPaused,
  onSetIsMuted,
  onClose,
  onNext,
  onPrev,
  onDelete,
  onSendReply,
  onSendReaction,
  videoRef,
}) {
  const { t } = useTranslation();
  const [viewersListOpen, setViewersListOpen] = useState(false);
  const [showFullReactionPicker, setShowFullReactionPicker] = useState(false);

  // Sync with global theme
  const theme = useAppSelector((state) => state.ui.theme);

  // Press / Touch timing refs
  const touchStartTimeRef = useRef(0);
  const wasLongPressRef = useRef(false);
  const longPressTimeoutRef = useRef(null);

  // Pause when drawer is open
  useEffect(() => {
    if (viewersListOpen) {
      onSetIsPaused(true);
      if (videoRef.current) videoRef.current.pause();
    }
  }, [viewersListOpen]);

  const handleCloseDrawer = () => {
    setViewersListOpen(false);
    onSetIsPaused(false);
    if (videoRef.current) videoRef.current.play().catch(() => {});
  };

  const handlePauseToggle = (e) => {
    e.stopPropagation();
    if (isPaused) {
      onSetIsPaused(false);
      if (videoRef.current) videoRef.current.play().catch(() => {});
    } else {
      onSetIsPaused(true);
      if (videoRef.current) videoRef.current.pause();
    }
  };

  // Hold to pause logic (supports mouse and touch)
  const handleHoldStart = (e) => {
    // Filter simulated mouse events on touch devices
    if (e.type.startsWith("mouse") && ("ontouchstart" in window || navigator.maxTouchPoints > 0)) {
      return;
    }

    // Avoid triggering pause on inputs, buttons, or pickers
    if (
      e.target.closest("button") ||
      e.target.closest("input") ||
      e.target.closest(".interactive-panel") ||
      showFullReactionPicker
    ) {
      return;
    }

    touchStartTimeRef.current = Date.now();
    wasLongPressRef.current = false;

    if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
    longPressTimeoutRef.current = setTimeout(() => {
      wasLongPressRef.current = true;
      onSetIsPaused(true);
      if (videoRef.current) videoRef.current.pause();
    }, 200); // 200ms hold starts pause
  };

  const handleHoldEnd = (e) => {
    // Filter simulated mouse events on touch devices
    if (e.type.startsWith("mouse") && ("ontouchstart" in window || navigator.maxTouchPoints > 0)) {
      return;
    }

    if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);

    if (wasLongPressRef.current) {
      // It was a long press. Resume play state.
      if (!viewersListOpen && !showFullReactionPicker) {
        onSetIsPaused(false);
        if (videoRef.current) videoRef.current.play().catch(() => {});
      }
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // Navigation click zones handler (Left 30% for Prev, Right 70% for Next)
  const handleCanvasClick = (e) => {
    // Skip if it was a long press, viewers list is open, or full picker is active
    if (wasLongPressRef.current || viewersListOpen || showFullReactionPicker) {
      return;
    }

    // Ignore interactive regions
    if (
      e.target.closest("button") ||
      e.target.closest("input") ||
      e.target.closest(".interactive-panel")
    ) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;

    if (x < width * 0.3) {
      onPrev();
    } else {
      onNext();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-40 flex flex-col bg-[#0a1014] select-none"
    >
      {/* Top progress bars */}
      <div className="absolute top-4 left-4 right-4 z-50 flex items-center gap-1.5 pointer-events-none">
        {activeGroup?.statuses?.map((item, idx) => {
          let progressPct = 0;
          if (idx < activeStatusIndex) progressPct = 100;
          if (idx === activeStatusIndex) progressPct = viewerProgress;

          return (
            <div
              key={item.id || idx}
              className="h-[3px] bg-white/20 rounded-full flex-1 overflow-hidden pointer-events-none"
            >
              <div
                className="h-full bg-white transition-all duration-75"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          );
        })}
      </div>

      {/* Top Header Overlay */}
      <div className="absolute top-7 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent pointer-events-auto">
        <div className="flex items-center gap-3">
          <Avatar
            src={activeGroup?.avatar}
            fallback={activeGroup?.name?.[0] || "?"}
            size="sm"
            uid={activeUserId}
          />
          <div className="flex flex-col text-left">
            <span className="text-sm font-semibold text-white">
              {activeUserId === currentUser?.id ? (t("status.my_status") || "My status") : activeGroup?.name}
            </span>
            <span className="text-xs text-white/70">
              {formatMessageTime(activeStatus?.createdAt)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-white">
          {/* Delete Action (Owner only) */}
          {activeUserId === currentUser?.id && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(activeStatus?.id);
              }}
              className="p-2 rounded-full hover:bg-white/10 text-white cursor-pointer transition-all active:scale-95"
              title={t("status.delete_status_update") || "Delete status update"}
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}

          {/* Mute/Unmute for video status */}
          {activeStatus?.type === "video" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSetIsMuted(!isMuted);
              }}
              className="p-2 rounded-full hover:bg-white/10 text-white cursor-pointer transition-all active:scale-95"
              title={isMuted ? (t("status.unmute") || "Unmute") : (t("status.mute") || "Mute")}
            >
              {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
          )}

          {/* Pause/Play Button */}
          <button
            onClick={handlePauseToggle}
            className="p-2 rounded-full hover:bg-white/10 text-white cursor-pointer transition-all active:scale-95"
            title={isPaused ? (t("status.play") || "Play") : (t("status.pause") || "Pause")}
          >
            {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
          </button>

          {/* Close Viewer */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-2 rounded-full hover:bg-white/10 text-white cursor-pointer transition-all active:scale-95"
            title={t("common.close") || "Close"}
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Desktop-only side buttons (Hidden on Mobile for cleaner tap zones) */}
      <div className="hidden md:flex absolute inset-y-0 left-0 w-20 z-40 items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200 bg-gradient-to-r from-black/40 to-transparent">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          className="p-3.5 bg-black/35 rounded-full hover:bg-black/55 hover:scale-105 active:scale-95 text-white cursor-pointer transition-all"
        >
          <ChevronLeft className="h-7 w-7" />
        </button>
      </div>
      <div className="hidden md:flex absolute inset-y-0 right-0 w-20 z-40 items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200 bg-gradient-to-l from-black/40 to-transparent">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className="p-3.5 bg-black/35 rounded-full hover:bg-black/55 hover:scale-105 active:scale-95 text-white cursor-pointer transition-all"
        >
          <ChevronRight className="h-7 w-7" />
        </button>
      </div>

      {/* MAIN STORY CANVAS DISPLAY */}
      <div
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleHoldEnd}
        className="flex-1 w-full h-full relative flex items-center justify-center cursor-pointer select-none overflow-hidden"
      >
        {activeStatus?.type === "text" && (
          <div
            className="absolute inset-0 flex items-center justify-center text-center font-semibold leading-relaxed px-8 transition-colors select-text"
            style={{
              backgroundColor: activeStatus?.bgColor || "#005c4b",
              fontFamily:
                FONT_STYLES.find((f) => f.name === activeStatus?.textStyle)?.family ||
                "sans-serif",
              fontSize: "clamp(1.5rem, 5vw, 2.5rem)",
              textShadow: "0 2px 4px rgba(0,0,0,0.15)",
            }}
          >
            <span className="max-w-2xl px-4 break-words text-white select-text">
              {activeStatus?.textContent}
            </span>
          </div>
        )}

        {/* Image status with caption rendered exactly below image */}
        {activeStatus?.type === "image" && (
          <div className="flex flex-col items-center justify-center gap-4 max-h-[62vh] sm:max-h-[66vh] max-w-full p-2">
            <img
              src={activeStatus?.mediaUrl}
              alt="Status update"
              className="max-h-[46vh] sm:max-h-[50vh] max-w-full object-contain rounded-lg shadow-2xl pointer-events-none select-none transition-all duration-300"
            />
            {activeStatus?.caption && (
              <div className="bg-[#111b21]/90 text-[#e9edef] px-5 py-2.5 rounded-lg max-w-lg text-center text-sm sm:text-base shadow-lg border border-white/5 break-words select-text">
                {activeStatus?.caption}
              </div>
            )}
          </div>
        )}

        {/* Video status with caption rendered exactly below video */}
        {activeStatus?.type === "video" && (
          <div className="flex flex-col items-center justify-center gap-4 max-h-[62vh] sm:max-h-[66vh] max-w-full p-2">
            <video
              ref={videoRef}
              src={activeStatus?.mediaUrl}
              className="max-h-[46vh] sm:max-h-[50vh] max-w-full object-contain rounded-lg shadow-2xl transition-all duration-300"
              autoPlay
              playsInline
              muted={isMuted}
            />
            {activeStatus?.caption && (
              <div className="bg-[#111b21]/90 text-[#e9edef] px-5 py-2.5 rounded-lg max-w-lg text-center text-sm sm:text-base shadow-lg border border-white/5 break-words select-text">
                {activeStatus?.caption}
              </div>
            )}
          </div>
        )}
      </div>

      {/* BOTTOM CONTROLS OR REPLY AREA */}
      {!viewersListOpen && (
        <div className="bg-black/50 p-4 border-t border-white/5 z-45 shrink-0 select-none pb-safe">
          {activeUserId === currentUser?.id ? (
            /* View details trigger for status owner */
            <div className="flex items-center justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setViewersListOpen(true);
                }}
                className="flex items-center gap-1.5 hover:text-wa-primary text-white/85 bg-[#202c33]/40 backdrop-blur-md hover:bg-[#202c33]/70 px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all duration-200 active:scale-95 border border-white/5"
              >
                <Eye className="h-4 w-4" />
                <span>
                  {activeStatus?.views?.length || 0} {activeStatus?.views?.length === 1 ? (t("status.view") || "view") : (t("status.views") || "views")}
                </span>
              </button>
            </div>
          ) : (
            /* Reply controls for contacts viewing status */
            <div className="flex flex-col gap-3.5 w-full max-w-xl mx-auto interactive-panel">
              {/* Quick Emojis strip (Using the exact list and adding picker trigger matching message reactions) */}
              <div className="flex justify-between items-center px-4 py-1.5 bg-[#202c33]/40 backdrop-blur-md rounded-xl border border-white/5">
                {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSendReaction(emoji);
                    }}
                    className="text-2xl hover:scale-130 active:scale-90 transition-all duration-100 cursor-pointer p-1"
                    title={t("status.react_emoji", { emoji }) || `React ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetIsPaused(true);
                    if (videoRef.current) videoRef.current.pause();
                    setShowFullReactionPicker(true);
                  }}
                  className="text-wa-primary hover:scale-130 active:scale-90 transition-all duration-100 cursor-pointer p-1 font-bold text-xl ml-1 leading-none"
                  title={t("status.react_any_emoji") || "React with any emoji"}
                >
                  +
                </button>
              </div>

              {/* Message text reply box */}
              <div className="flex items-center gap-3 bg-[#2a3942] rounded-lg px-4 py-1 border border-white/5">
                <Input
                  type="text"
                  placeholder={t("status.type_reply") || "Type a reply..."}
                  value={replyText}
                  onChange={(e) => onSetReplyText(e.target.value)}
                  onFocus={() => {
                    onSetIsPaused(true);
                    if (videoRef.current) videoRef.current.pause();
                  }}
                  onBlur={() => {
                    if (!viewersListOpen && !showFullReactionPicker) {
                      onSetIsPaused(false);
                      if (videoRef.current) videoRef.current.play().catch(() => {});
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.stopPropagation();
                      onSendReply();
                    }
                  }}
                  className="bg-transparent border-none text-white text-sm focus:ring-0 focus:outline-none flex-1 py-2.5"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSendReply();
                  }}
                  disabled={!replyText.trim()}
                  className="p-1 rounded-full text-wa-primary disabled:text-wa-muted/40 cursor-pointer hover:bg-white/5 transition-all"
                  title={t("status.send_reply") || "Send Reply"}
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Full Emoji Picker Popover Modal */}
      {showFullReactionPicker && (
        <div
          className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 select-none transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            setShowFullReactionPicker(false);
            onSetIsPaused(false);
            if (videoRef.current) videoRef.current.play().catch(() => {});
          }}
        >
          <div
            className="bg-wa-modal rounded-2xl border border-wa-border shadow-2xl overflow-hidden w-[300px] h-[380px] animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <EmojiPicker
              theme={theme === "dark" ? "dark" : "light"}
              onEmojiClick={(emojiData) => {
                onSendReaction(emojiData.emoji);
                setShowFullReactionPicker(false);
                onSetIsPaused(false);
                if (videoRef.current) videoRef.current.play().catch(() => {});
              }}
              width="100%"
              height="100%"
              skinTonesDisabled
              previewConfig={{ showPreview: false }}
            />
          </div>
        </div>
      )}

      {/* Slide-up viewers list */}
      <StatusViewersDrawer
        isOpen={viewersListOpen}
        onClose={handleCloseDrawer}
        views={activeStatus?.views || []}
      />
    </motion.div>
  );

  // Helpers for Desktop compatibility on touch-based pausing
  function handleMouseDown(e) {
    handleHoldStart(e);
  }

  function handleMouseUp(e) {
    handleHoldEnd(e);
  }

  function handleTouchStart(e) {
    handleHoldStart(e);
  }
}
