"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Trash2,
  Volume2,
  VolumeX,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Send,
  Eye,
  Music,
  MapPin,
  BarChart2,
  Smile,
} from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Input } from "../ui/Input";
import { StatusViewersDrawer } from "./StatusViewersDrawer";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { useAppSelector } from "../../hooks/useRedux";
import { useTranslation } from "../../hooks/useTranslation";
import { formatMessageTime } from "../../utils/dateUtils";
import { statusService } from "../../services/statusService";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
  loading: () => (
    <div className="w-[280px] h-[350px] bg-wa-modal flex items-center justify-center text-xs text-wa-muted">
      Loading Emojis...
    </div>
  ),
});

const FONT_STYLES = [
  { name: "sans", family: "system-ui, -apple-system, sans-serif" },
  { name: "serif", family: "Georgia, Cambria, serif" },
  { name: "mono", family: "Courier New, Courier, monospace" },
  { name: "handwriting", family: "'Caveat', cursive, sans-serif" },
];

// Sub-component for ticking countdown widget
function CountdownSticker({ targetDate, title }) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    mins: 0,
    secs: 0,
  });

  useEffect(() => {
    const updateTime = () => {
      const difference = new Date(targetDate) - new Date();
      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, mins: 0, secs: 0 });
        return;
      }
      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const mins = Math.floor((difference / 1000 / 60) % 60);
      const secs = Math.floor((difference / 1000) % 60);
      setTimeLeft({ days, hours, mins, secs });
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return (
    <div className="bg-[#233138]/90 border border-white/10 rounded-xl p-3.5 w-64 text-white shadow-2xl flex flex-col items-center select-none mt-4 mx-auto backdrop-blur-sm">
      <span className="text-xs font-bold text-white/70 mb-2 truncate max-w-full">
        {title}
      </span>
      <div className="flex gap-2">
        <div className="bg-white/5 border border-white/10 rounded p-1.5 text-center min-w-[45px]">
          <div className="text-sm font-extrabold">{timeLeft.days}</div>
          <div className="text-[8px] text-white/50 uppercase font-semibold">
            Days
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded p-1.5 text-center min-w-[45px]">
          <div className="text-sm font-extrabold">{timeLeft.hours}</div>
          <div className="text-[8px] text-white/50 uppercase font-semibold">
            Hrs
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded p-1.5 text-center min-w-[45px]">
          <div className="text-sm font-extrabold">{timeLeft.mins}</div>
          <div className="text-[8px] text-white/50 uppercase font-semibold">
            Mins
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded p-1.5 text-center min-w-[45px]">
          <div className="text-sm font-extrabold">{timeLeft.secs}</div>
          <div className="text-[8px] text-white/50 uppercase font-semibold">
            Secs
          </div>
        </div>
      </div>
    </div>
  );
}

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
  onVoteOnPoll,
  onAnswerQuestion,
  onMuteUser,
  onSeek,
  onJumpToStatus,
}) {
  const { t } = useTranslation();
  const [viewersListOpen, setViewersListOpen] = useState(false);
  const [showFullReactionPicker, setShowFullReactionPicker] = useState(false);

  // Question sticker answer field
  const [questionAnswerInput, setQuestionAnswerInput] = useState("");
  const [showQuickReactions, setShowQuickReactions] = useState(false);

  // Sync with global theme
  const theme = useAppSelector((state) => state.ui.theme);

  // Press / Touch timing refs
  const touchStartTimeRef = useRef(0);
  const wasLongPressRef = useRef(false);
  const longPressTimeoutRef = useRef(null);

  // Parse custom metadata (Stickers/Links)
  const decodedText = statusService.decodeMetadata(
    activeStatus?.textContent || "",
  );
  const decodedCaption = statusService.decodeMetadata(
    activeStatus?.caption || "",
  );
  const cleanTextDisplay =
    activeStatus?.type === "text"
      ? decodedText.content
      : activeStatus?.textContent;
  const cleanCaptionDisplay =
    activeStatus?.type === "image" || activeStatus?.type === "video"
      ? decodedCaption.content
      : activeStatus?.caption;
  const metadata =
    activeStatus?.type === "text"
      ? decodedText.metadata
      : decodedCaption.metadata;

  // Poll Vote calculations
  const totalVotes =
    activeStatus?.views?.filter((v) => v.voteOptionId).length || 0;
  const optionVotes = {};
  activeStatus?.views?.forEach((v) => {
    if (v.voteOptionId) {
      optionVotes[v.voteOptionId] = (optionVotes[v.voteOptionId] || 0) + 1;
    }
  });
  const currentViewerVote = activeStatus?.views?.find(
    (v) => v.viewerId === currentUser?.id,
  )?.voteOptionId;
  const isOwner = activeUserId === currentUser?.id;
  const showPollResults = isOwner || !!currentViewerVote;

  const wasManuallyPausedRef = useRef(false);
  const audioRef = useRef(null);

  // Reset manual pause on status transitions
  useEffect(() => {
    wasManuallyPausedRef.current = false;
  }, [activeStatus?.id]);

  // Sync video play/pause status
  useEffect(() => {
    if (videoRef.current) {
      if (isPaused) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [isPaused, activeStatus?.id]);

  // Sync background music play/pause status
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.5;
      if (isPaused) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(() => {});
      }
    }
  }, [isPaused, activeStatus?.id, decodedCaption.metadata?.music]);

  // Pause when drawer is open
  useEffect(() => {
    if (viewersListOpen) {
      onSetIsPaused(true);
    }
  }, [viewersListOpen]);

  const handleCloseDrawer = () => {
    setViewersListOpen(false);
    if (!wasManuallyPausedRef.current) {
      onSetIsPaused(false);
    }
  };

  const handlePauseToggle = (e) => {
    if (e) e.stopPropagation();
    if (isPaused) {
      wasManuallyPausedRef.current = false;
      onSetIsPaused(false);
    } else {
      wasManuallyPausedRef.current = true;
      onSetIsPaused(true);
    }
  };

  // Hold to pause logic (supports mouse and touch)
  const handleHoldStart = (e) => {
    if (
      e.type.startsWith("mouse") &&
      ("ontouchstart" in window || navigator.maxTouchPoints > 0)
    ) {
      return;
    }

    if (
      e.target.closest("button") ||
      e.target.closest("input") ||
      e.target.closest(".interactive-panel") ||
      e.target.closest(".sticker-widget") ||
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
    }, 200);
  };

  const handleHoldEnd = (e) => {
    if (
      e.type.startsWith("mouse") &&
      ("ontouchstart" in window || navigator.maxTouchPoints > 0)
    ) {
      return;
    }

    if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);

    if (wasLongPressRef.current) {
      if (
        !viewersListOpen &&
        !showFullReactionPicker &&
        !wasManuallyPausedRef.current
      ) {
        onSetIsPaused(false);
      }
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleCanvasClick = (e) => {
    if (wasLongPressRef.current || viewersListOpen || showFullReactionPicker) {
      return;
    }

    if (
      e.target.closest("button") ||
      e.target.closest("input") ||
      e.target.closest(".interactive-panel") ||
      e.target.closest(".sticker-widget")
    ) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;

    if (x < width * 0.3) {
      onPrev();
    } else if (x > width * 0.7) {
      onNext();
    } else {
      // Center click toggles pause/play
      handlePauseToggle(e);
    }
  };

  const handleAnswerSubmit = (e) => {
    e.preventDefault();
    if (!questionAnswerInput.trim()) return;
    onAnswerQuestion(questionAnswerInput.trim());
    setQuestionAnswerInput("");
    onSetIsPaused(false);
    if (videoRef.current) videoRef.current.play().catch(() => {});
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-45 flex flex-col bg-[#0a1014] select-none"
    >
      {/* Background Music Audio Player */}
      {metadata?.music && (
        <audio
          ref={audioRef}
          src={metadata.music.audioUrl}
          autoPlay
          loop
          muted={isMuted}
        />
      )}

      {/* Top progress bars */}
      <div className="absolute top-4 left-4 right-4 z-50 flex items-center gap-1.5 pointer-events-auto">
        {activeGroup?.statuses?.map((item, idx) => {
          let progressPct = 0;
          if (idx < activeStatusIndex) progressPct = 100;
          if (idx === activeStatusIndex) progressPct = viewerProgress;

          return (
            <div
              key={item.id || idx}
              onClick={(e) => {
                e.stopPropagation();
                if (idx === activeStatusIndex) {
                  // Seek current status
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const pct = Math.max(
                    0,
                    Math.min(100, (clickX / rect.width) * 100),
                  );
                  if (onSeek) onSeek(pct);
                } else {
                  // Jump to different status update
                  if (onJumpToStatus) onJumpToStatus(idx);
                }
              }}
              className="py-2 flex-1 cursor-pointer group"
            >
              <div className="h-[3px] bg-white/20 rounded-full w-full overflow-hidden transition-all group-hover:h-[5px]">
                <div
                  className="h-full bg-white transition-all duration-75"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
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
              {activeUserId === currentUser?.id
                ? t("status.my_status") || "My status"
                : activeGroup?.name}
            </span>
            <span className="text-xs text-white/70">
              {formatMessageTime(activeStatus?.createdAt)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-white">
          {/* Mute contact statuses (Contact only) */}
          {activeUserId !== currentUser?.id && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMuteUser(activeUserId);
              }}
              className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-red-400 cursor-pointer transition-all active:scale-95 text-xs font-semibold"
              title="Mute status updates from user"
            >
              <VolumeX className="h-5 w-5" />
            </button>
          )}

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

          {/* Mute/Unmute toggle for video / music status */}
          {(activeStatus?.type === "video" || metadata?.music) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSetIsMuted(!isMuted);
              }}
              className="p-2 rounded-full hover:bg-white/10 text-white cursor-pointer transition-all active:scale-95"
              title={isMuted ? "Unmute Audio" : "Mute Audio"}
            >
              {isMuted ? (
                <VolumeX className="h-5 w-5" />
              ) : (
                <Volume2 className="h-5 w-5" />
              )}
            </button>
          )}

          {/* Pause/Play Button */}
          <button
            onClick={handlePauseToggle}
            className="p-2 rounded-full hover:bg-white/10 text-white cursor-pointer transition-all active:scale-95"
            title={isPaused ? "Play" : "Pause"}
          >
            {isPaused ? (
              <Play className="h-5 w-5" />
            ) : (
              <Pause className="h-5 w-5" />
            )}
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

      {/* Desktop-only navigation side buttons */}
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
        onTouchStart={handleHoldStart}
        onTouchEnd={handleHoldEnd}
        className="flex-1 w-full h-full relative flex items-center justify-center cursor-pointer select-none overflow-hidden pt-20 pb-20"
      >
        {activeStatus?.type === "text" && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center text-center font-semibold leading-relaxed px-8 transition-colors select-text"
            style={{
              background: activeStatus?.bgColor || "#005c4b",
              fontFamily:
                FONT_STYLES.find((f) => f.name === activeStatus?.textStyle)
                  ?.family || "sans-serif",
              fontSize: "clamp(1.4rem, 4vw, 2.2rem)",
              textShadow: "0 2px 5px rgba(0,0,0,0.2)",
            }}
          >
            <span className="max-w-2xl px-4 break-words text-white select-text">
              {cleanTextDisplay}
            </span>

            {/* Sticker Widgets Overlaid inside Text Status */}
            {metadata && renderStickerOverlays()}
          </div>
        )}

        {/* Image status */}
        {activeStatus?.type === "image" && (
          <div className="w-full h-full flex items-center justify-center pointer-events-none select-none relative">
            <img
              src={activeStatus?.mediaUrl}
              alt="Status update"
              className="w-full h-full object-contain pointer-events-none"
            />

            {/* Render Stickers overlaying the image */}
            {metadata && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                {renderStickerOverlays()}
              </div>
            )}

            {/* Render Caption overlaid at the bottom */}
            {cleanCaptionDisplay && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm text-white px-5 py-2.5 rounded-xl max-w-[85%] sm:max-w-md text-center text-sm shadow-xl border border-white/10 break-words select-text z-20 pointer-events-auto">
                {cleanCaptionDisplay}
              </div>
            )}
          </div>
        )}

        {/* Video status */}
        {activeStatus?.type === "video" && (
          <div className="w-full h-full flex items-center justify-center overflow-hidden relative">
            <video
              ref={videoRef}
              src={activeStatus?.mediaUrl}
              className="w-full h-full object-contain pointer-events-none"
              autoPlay
              playsInline
              muted={isMuted}
            />

            {/* Render Stickers overlaying the video */}
            {metadata && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                {renderStickerOverlays()}
              </div>
            )}

            {/* Render Caption overlaid at the bottom */}
            {cleanCaptionDisplay && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm text-white px-5 py-2.5 rounded-xl max-w-[85%] sm:max-w-md text-center text-sm shadow-xl border border-white/10 break-words select-text z-20 pointer-events-auto">
                {cleanCaptionDisplay}
              </div>
            )}
          </div>
        )}
      </div>

      {/* BOTTOM CONTROLS OR REPLY AREA */}
      {!viewersListOpen && (
        <div className="absolute bottom-0 inset-x-0 bg-black/60 p-4 border-t border-white/5 z-40 select-none pb-safe">
          {activeUserId === currentUser?.id ? (
            /* View details trigger for status owner */
            <div className="flex items-center justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setViewersListOpen(true);
                }}
                className="flex items-center gap-1.5 hover:text-wa-primary text-white bg-[#202c33]/50 backdrop-blur-md hover:bg-[#202c33]/80 px-5 py-2 rounded-full text-xs font-bold cursor-pointer transition-all duration-200 active:scale-95 border border-white/10 shadow-lg"
              >
                <Eye className="h-4 w-4" />
                <span>
                  {activeStatus?.views?.length || 0}{" "}
                  {activeStatus?.views?.length === 1
                    ? t("status.view") || "view"
                    : t("status.views") || "views"}
                </span>
              </button>
            </div>
          ) : (
            /* Reply controls for contacts viewing status */
            <div className="flex flex-col gap-3.5 w-full max-w-xl mx-auto interactive-panel">
              {/* Quick Emojis reactions panel toggled by smile icon */}
              <AnimatePresence>
                {showQuickReactions && (
                  <motion.div
                    initial={{ opacity: 0, y: 12, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className="flex justify-between items-center px-4 py-2 bg-[#202c33] rounded-xl border border-white/10 shadow-2xl z-50 relative"
                  >
                    {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSendReaction(emoji);
                          setShowQuickReactions(false);
                        }}
                        className="text-2xl hover:scale-130 active:scale-90 transition-all duration-100 cursor-pointer p-1"
                        title={`React ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowQuickReactions(false);
                        onSetIsPaused(true);
                        if (videoRef.current) videoRef.current.pause();
                        setShowFullReactionPicker(true);
                      }}
                      className="text-[#00a884] hover:scale-125 transition-all cursor-pointer p-1 font-bold text-xl ml-1 leading-none"
                      title="More Emojis"
                    >
                      +
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Message text reply input */}
              <div className="flex items-center gap-2 bg-[#2a3942] rounded-lg px-3 py-1 border border-white/5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowQuickReactions(!showQuickReactions);
                  }}
                  className={`p-1.5 rounded-full hover:bg-white/5 transition-colors cursor-pointer ${
                    showQuickReactions
                      ? "text-[#00a884]"
                      : "text-white/70 hover:text-white"
                  }`}
                  title="Emoji Reactions"
                >
                  <Smile className="h-5 w-5" />
                </button>

                <Input
                  type="text"
                  placeholder={t("status.type_reply") || "Type a reply..."}
                  value={replyText}
                  onChange={(e) => onSetReplyText(e.target.value)}
                  onFocus={() => {
                    onSetIsPaused(true);
                    setShowQuickReactions(false);
                  }}
                  onBlur={() => {
                    if (
                      !viewersListOpen &&
                      !showFullReactionPicker &&
                      !questionAnswerInput &&
                      !wasManuallyPausedRef.current
                    ) {
                      onSetIsPaused(false);
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

      {/* Full Emoji reaction picker popover */}
      {showFullReactionPicker && (
        <div
          className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 select-none"
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

      {/* Slide-up views analytics list drawer */}
      <StatusViewersDrawer
        isOpen={viewersListOpen}
        onClose={handleCloseDrawer}
        views={activeStatus?.views || []}
        activeStatus={activeStatus}
      />
    </motion.div>
  );

  // Render Overlay Interactive Stickers
  function renderStickerOverlays() {
    if (!metadata) return null;

    return (
      <div className="mt-4 flex flex-col items-center gap-3.5 z-20 pointer-events-auto sticker-widget select-none">
        {/* MUSIC WIDGET STICKER */}
        {metadata.music && (
          <div className="bg-gradient-to-r from-[#f35369] to-[#ff7e5f] border border-white/20 rounded-xl p-3 w-60 text-white shadow-xl flex items-center gap-3">
            <div
              className={`h-9 w-9 rounded-full bg-black/30 flex items-center justify-center shrink-0 ${!isPaused ? "animate-spin" : ""}`}
              style={{ animationDuration: "6s" }}
            >
              <Music className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-extrabold truncate leading-tight">
                {metadata.music.title}
              </p>
              <p className="text-[10px] text-white/80 truncate leading-tight">
                {metadata.music.artist}
              </p>
            </div>
          </div>
        )}

        {/* POLL WIDGET STICKER */}
        {metadata.poll && (
          <div className="bg-[#2a3942]/95 border border-white/10 rounded-xl p-4 w-68 text-white shadow-2xl backdrop-blur-sm text-left">
            <div className="flex items-center gap-2 mb-3">
              <BarChart2 className="h-4 w-4 text-[#00a884]" />
              <span className="text-xs font-bold truncate">
                {metadata.poll.question}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {metadata.poll.options?.map((opt) => {
                const votesForOption = optionVotes[opt.id] || 0;
                const pct =
                  totalVotes > 0
                    ? Math.round((votesForOption / totalVotes) * 100)
                    : 0;
                const isSelected = String(currentViewerVote) === String(opt.id);

                return (
                  <button
                    key={opt.id}
                    disabled={showPollResults}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onVoteOnPoll) onVoteOnPoll(opt.id);
                    }}
                    className={`relative w-full rounded-lg overflow-hidden py-2 px-3 text-xs text-left border border-white/5 font-semibold transition-all flex items-center justify-between ${
                      showPollResults
                        ? "cursor-default"
                        : "bg-white/5 hover:bg-white/10 active:scale-98 cursor-pointer"
                    }`}
                  >
                    {/* Sliding progress fill background */}
                    {showPollResults && (
                      <div
                        className={`absolute left-0 top-0 bottom-0 transition-all duration-500 ${
                          isSelected ? "bg-[#00a884]/30" : "bg-white/10"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    )}
                    <span className="relative z-10 truncate pr-4">
                      {opt.text}
                    </span>
                    {showPollResults && (
                      <span className="relative z-10 text-[10px] text-white/60 shrink-0 font-bold">
                        {pct}% ({votesForOption})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* QUESTION WIDGET STICKER */}
        {metadata.question && (
          <div className="bg-[#7f66ff] border border-white/10 rounded-xl p-4 w-68 text-white shadow-2xl flex flex-col items-center text-center">
            <Smile className="h-6 w-6 mb-1.5" />
            <p className="text-xs font-extrabold max-w-full truncate mb-3">
              {metadata.question.prompt}
            </p>

            {isOwner ? (
              <div className="bg-black/20 rounded px-3 py-1.5 w-full text-[10px] select-none font-semibold">
                {activeStatus?.views?.filter((v) => v.questionAnswer).length ||
                  0}{" "}
                responses in viewers drawer
              </div>
            ) : (
              <form
                onSubmit={handleAnswerSubmit}
                className="w-full flex items-center gap-1.5 mt-1 bg-white/15 rounded px-2.5 py-1"
              >
                <input
                  type="text"
                  placeholder="Answer..."
                  value={questionAnswerInput}
                  onChange={(e) => setQuestionAnswerInput(e.target.value)}
                  onFocus={() => {
                    onSetIsPaused(true);
                    if (videoRef.current) videoRef.current.pause();
                  }}
                  className="bg-transparent border-none text-white text-[11px] placeholder-white/50 focus:outline-none focus:ring-0 flex-1 py-1"
                />
                <button
                  type="submit"
                  disabled={!questionAnswerInput.trim()}
                  className="p-1 text-white hover:scale-110 disabled:opacity-30 cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            )}
          </div>
        )}

        {/* COUNTDOWN WIDGET STICKER */}
        {metadata.countdown && (
          <CountdownSticker
            targetDate={metadata.countdown.targetDate}
            title={metadata.countdown.title}
          />
        )}

        {/* LOCATION WIDGET STICKER */}
        {metadata.location && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              window.open(
                `https://www.openstreetmap.org/?mlat=${metadata.location.lat}&mlon=${metadata.location.lng}&zoom=15`,
                "_blank",
              );
            }}
            className="bg-[#2a3942]/90 border border-white/10 rounded-full px-3.5 py-2 text-white shadow-xl flex items-center gap-1.5 text-xs font-semibold cursor-pointer hover:bg-[#32444f] transition-all backdrop-blur-sm"
          >
            <MapPin className="h-3.5 w-3.5 text-[#4f772d]" />
            <span className="truncate max-w-[150px]">
              {metadata.location.name}
            </span>
          </button>
        )}
      </div>
    );
  }

  // Touch and mouse long press mapping helpers
  function handleMouseDown(e) {
    handleHoldStart(e);
  }

  function handleMouseUp(e) {
    handleHoldEnd(e);
  }
}
