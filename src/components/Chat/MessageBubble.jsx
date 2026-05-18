"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
  loading: () => (
    <div className="w-[280px] h-[350px] bg-wa-modal flex items-center justify-center text-xs text-wa-muted">
      Loading Emojis...
    </div>
  ),
});
import {
  Check,
  CheckCheck,
  Clock,
  Play,
  Pause,
  FileText,
  Download,
  AlertCircle,
  Maximize2,
  MoreVertical,
  Smile,
  Reply,
  Trash2,
  Phone,
  Video,
  ArrowRight,
} from "lucide-react";
import { Modal } from "../ui/Modal";
import { Avatar } from "../ui/Avatar";
import { useAppSelector, useAppDispatch } from "../../hooks/useRedux";
import { messageService } from "../../services/messageService";
import { setReplyingMessage } from "../../redux/slices/uiSlice";
import { cn } from "../../utils/cn";
import { formatMessageTime } from "../../utils/dateUtils";

export const MessageBubble = React.memo(function MessageBubble({ message, isGroup }) {
  const {
    id,
    text,
    timestamp,
    status,
    type = "text",
    mediaUrl,
    fileName,
    fileSize,
    duration,
    reactions = {},
    rawText = "",
    createdAt,
  } = message;

  const displayTime = createdAt ? formatMessageTime(createdAt) : timestamp;

  if (type === "system") {
    return (
      <div className="flex justify-center my-3 select-none w-full px-4">
        <span className="bg-wa-encrypted/50 text-wa-muted text-[11px] sm:text-[12px] px-3 py-1 rounded-md text-center max-w-md shadow-xs backdrop-blur-sm uppercase tracking-tight font-medium">
          {text}
        </span>
      </div>
    );
  }

  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((state) => state.auth.user);
  const currentUserId = currentUser?.id;
  const theme = useAppSelector((state) => state.ui.theme);

  const [showFullReactionPicker, setShowFullReactionPicker] = useState(false);
  const [pickerDirection, setPickerDirection] = useState("up");

  const normalizedSenderId = message.sender_id || message.senderId;
  const isMsgOutgoing =
    normalizedSenderId && currentUserId
      ? String(normalizedSenderId).toLowerCase() ===
        String(currentUserId).toLowerCase()
      : !!message.isOutgoing;

  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [isDeletedForMe, setIsDeletedForMe] = useState(false);
  const [showReactionBar, setShowReactionBar] = useState(false);
  const [dropdownConfig, setDropdownConfig] = useState({
    isOpen: false,
    style: {},
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const audioRef = useRef(null);
  const playbackIntervalRef = useRef(null);

  const toggleVoicePlay = (e) => {
    e.stopPropagation();
    if (!mediaUrl) return;

    if (!audioRef.current) {
      const audio = new Audio(mediaUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
        setPlaybackProgress(0);
        if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
      };

      audio.onerror = () => {
        setIsPlaying(false);
        setPlaybackProgress(0);
        if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
      };
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
    } else {
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
          playbackIntervalRef.current = setInterval(() => {
            if (audioRef.current && audioRef.current.duration) {
              const pct = (audioRef.current.currentTime / audioRef.current.duration) * 100;
              setPlaybackProgress(pct);
            }
          }, 100);
        })
        .catch((err) => console.warn("Audio playback initialization failed:", err));
    }
  };

  useEffect(() => {
    return () => {
      if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  useEffect(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem("wa_deleted_for_me") || "[]",
      );
      if (stored.includes(id)) {
        setIsDeletedForMe(true);
      }
    } catch (e) {}
  }, [id]);

  useEffect(() => {
    const handleClickOutside = () => {
      if (dropdownConfig.isOpen) {
        setDropdownConfig((prev) => ({ ...prev, isOpen: false }));
      }
      if (showReactionBar) {
        setShowReactionBar(false);
      }
      if (showFullReactionPicker) {
        setShowFullReactionPicker(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [dropdownConfig.isOpen, showReactionBar, showFullReactionPicker]);

  if (isDeletedForMe) return null;

  const isDeleted = type === "deleted" || text === "This message was deleted";

  const handleOpenMenu = (e) => {
    e.stopPropagation();
    setShowReactionBar(false);

    const rect = e.currentTarget.getBoundingClientRect();
    const style = {};

    if (window.innerHeight - rect.bottom < 220) {
      style.bottom = "100%";
      style.marginBottom = "6px";
    } else {
      style.top = "100%";
      style.marginTop = "6px";
    }

    if (rect.right > window.innerWidth - 180 || isMsgOutgoing) {
      style.right = 0;
    } else {
      style.left = 0;
    }

    setDropdownConfig({ isOpen: true, style });
  };

  const handleDeleteForMe = (e) => {
    e.stopPropagation();
    try {
      const stored = JSON.parse(
        localStorage.getItem("wa_deleted_for_me") || "[]",
      );
      if (!stored.includes(id)) {
        stored.push(id);
        localStorage.setItem("wa_deleted_for_me", JSON.stringify(stored));
      }
      setIsDeletedForMe(true);
      setDropdownConfig((prev) => ({ ...prev, isOpen: false }));
    } catch (err) {}
  };

  const handleDeleteForEveryone = async (e) => {
    e.stopPropagation();
    if (!isMsgOutgoing) return;
    try {
      const targetConvId = message.conversation_id || message.conversationId;
      await messageService.deleteMessageForEveryone(id, targetConvId);
      setDropdownConfig((prev) => ({ ...prev, isOpen: false }));
    } catch (err) {}
  };

  const handleReplyAction = (e) => {
    e.stopPropagation();
    setDropdownConfig((prev) => ({ ...prev, isOpen: false }));
    dispatch(
      setReplyingMessage({
        id,
        text,
        senderName: message.senderName || (isMsgOutgoing ? "You" : "Peer"),
        type,
        mediaUrl,
      })
    );
  };

  const handleForwardAction = (e) => {
    e.stopPropagation();
    setDropdownConfig((prev) => ({ ...prev, isOpen: false }));
    const customEvent = new CustomEvent("wa_forward_trigger", {
      detail: { message },
    });
    window.dispatchEvent(customEvent);
  };

  const handleOpenReactions = (e) => {
    e.stopPropagation();
    setDropdownConfig((prev) => ({ ...prev, isOpen: false }));
    setShowReactionBar((prev) => !prev);
  };

  const handleToggleReaction = async (emoji) => {
    if (!currentUserId) return;
    try {
      await messageService.toggleReaction(
        id,
        currentUserId,
        emoji,
        text,
        reactions,
      );
      setShowReactionBar(false);
    } catch (err) {}
  };

  const renderStatusTicks = () => {
    if (!isMsgOutgoing || isDeleted) return null;
    if (status === "failed") {
      return (
        <span className="text-red-500 text-[10px] ml-1 font-medium inline-flex items-center gap-0.5">
          <AlertCircle className="h-3 w-3 inline" /> Failed
        </span>
      );
    }
    if (status === "pending") {
      return (
        <Clock className="h-3 w-3 text-wa-muted inline-block ml-1 shrink-0" />
      );
    }
    if (status === "read") {
      return (
        <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb] inline-block ml-1 shrink-0" />
      );
    }
    if (status === "delivered") {
      return (
        <CheckCheck className="h-3.5 w-3.5 text-wa-muted inline-block ml-1 shrink-0" />
      );
    }
    return (
      <Check className="h-3.5 w-3.5 text-wa-muted inline-block ml-1 shrink-0" />
    );
  };

  const handleDownload = (e) => {
    e.stopPropagation();
    if (mediaUrl) {
      window.open(mediaUrl, "_blank");
    }
  };

  const renderMediaContent = () => {
    if (isDeleted) {
      return (
        <div className="flex items-center gap-1.5 py-0.5 text-wa-muted italic text-xs sm:text-sm select-none">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-wa-muted/70" />
          <span>This message was deleted</span>
        </div>
      );
    }

    switch (type) {
      case "image":
        return (
          <div className="relative rounded-md overflow-hidden mb-1 max-w-sm sm:max-w-md select-none">
            <div
              onClick={() => setImageModalOpen(true)}
              className="relative group cursor-pointer block overflow-hidden rounded bg-black/10"
            >
              <img
                src={mediaUrl || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe"}
                alt="Attachment"
                className="w-full h-auto object-cover max-h-64 sm:max-h-80 transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Maximize2 className="h-6 w-6 text-white drop-shadow-md" />
              </div>
            </div>
            {text && <p className="mt-1.5 text-xs sm:text-sm text-wa-text select-text whitespace-pre-wrap">{text}</p>}
            <Modal isOpen={imageModalOpen} onClose={() => setImageModalOpen(false)} title={fileName || "Photo Preview"} className="max-w-4xl">
              <div className="flex flex-col items-center justify-center p-2 bg-black/5 dark:bg-white/5 rounded-lg">
                <img src={mediaUrl || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe"} alt="Fullscreen" className="max-h-[70vh] max-w-full object-contain rounded" />
                <div className="flex items-center justify-between w-full mt-4 pt-3 border-t border-wa-border">
                  <span className="text-xs text-wa-muted truncate max-w-xs">{fileName || "shared_image.png"}</span>
                  <button onClick={handleDownload} className="flex items-center gap-2 px-3 py-1.5 rounded bg-wa-primary text-white text-xs font-medium hover:bg-wa-primary-hover">
                    <Download className="h-3.5 w-3.5" /> Download Original
                  </button>
                </div>
              </div>
            </Modal>
          </div>
        );
      case "video":
        return (
          <div className="relative rounded-md overflow-hidden mb-1 max-w-sm sm:max-w-md">
            <video src={mediaUrl} controls controlsList="nodownload" className="w-full max-h-64 sm:max-h-80 object-cover rounded bg-black" />
            {text && <p className="mt-1.5 text-xs sm:text-sm text-wa-text select-text whitespace-pre-wrap">{text}</p>}
          </div>
        );
      case "voice":
        return (
          <div className="flex items-center gap-3 py-1 min-w-[200px] sm:min-w-[240px] select-none">
            <button onClick={toggleVoicePlay} className="p-2 rounded-full bg-wa-primary text-white hover:opacity-90 shrink-0 transition-colors">
              {isPlaying ? <Pause className="h-4 w-4 fill-white" /> : <Play className="h-4 w-4 fill-white" />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="h-1.5 w-full bg-wa-border rounded-full overflow-hidden relative">
                <div className="absolute left-0 top-0 bottom-0 bg-wa-primary rounded-full transition-all duration-100" style={{ width: `${playbackProgress || 0}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-wa-muted mt-1 font-mono">
                <span>{duration || "0:15"}</span>
                <span>Voice Note</span>
              </div>
            </div>
          </div>
        );
      case "file":
        return (
          <div onClick={handleDownload} className="flex items-center gap-3 p-2 rounded bg-wa-header hover:bg-wa-hover mb-1 cursor-pointer transition-colors group border border-wa-border">
            <div className="flex items-center justify-center h-10 w-10 rounded bg-wa-active text-wa-muted shrink-0 group-hover:text-wa-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-wa-text truncate">{fileName || text}</p>
              <span className="text-[10px] text-wa-muted block truncate">{fileSize || "Attachment"}</span>
            </div>
            <Download className="h-4 w-4 text-wa-muted group-hover:text-wa-primary" />
          </div>
        );
      case "voice_call":
        const isMissed = message.metadata?.callStatus === "missed" || message.metadata?.callStatus === "declined";
        const isVideo = message.metadata?.callType === "video" || message.text?.toLowerCase().includes("video");
        return (
          <div className="flex items-center gap-3 py-1.5 min-w-[200px] select-none">
            <div className={cn(
              "p-2.5 rounded-full shrink-0",
              isMissed ? "bg-red-500/10 text-red-500" : "bg-wa-primary/10 text-wa-primary"
            )}>
              {isVideo ? (
                <Video className="h-5 w-5" />
              ) : (
                <Phone className={cn("h-5 w-5", isMissed && "rotate-[135deg]")} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-sm font-medium",
                isMissed ? "text-red-500" : "text-wa-text"
              )}>
                {isMissed ? (isVideo ? "Missed video call" : "Missed voice call") : (isVideo ? "Video call" : "Voice call")}
              </p>
              <span className="text-[11px] text-wa-muted">
                {message.metadata?.duration ? `${message.metadata.duration}s` : ""}
                {!isMissed && " • Completed"}
              </span>
            </div>
          </div>
        );
      default:
        return <p className="text-sm sm:text-base text-wa-text leading-snug whitespace-pre-wrap break-words">{text}</p>;
    }
  };

  const reactionEmojis = Object.keys(reactions).filter(
    (k) => Array.isArray(reactions[k]) && reactions[k].length > 0,
  );

  const handleScrollToQuotedMessage = (e) => {
    e.stopPropagation();
    if (!message.replyTo?.id) return;
    const targetElement = document.getElementById(`msg-${message.replyTo.id}`);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
      targetElement.classList.add("bg-wa-primary/20", "scale-102");
      setTimeout(() => {
        targetElement.classList.remove("bg-wa-primary/20", "scale-102");
      }, 1500);
    }
  };

  return (
    <motion.div
      id={`msg-${id}`}
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className={cn(
        "flex w-full mb-1.5 sm:mb-2.5 px-2 sm:px-4 select-text relative transition-all duration-300 rounded-lg",
        isMsgOutgoing ? "justify-end" : "justify-start",
      )}
    >
      {isGroup && !isMsgOutgoing && (
        <div className="mr-1.5 sm:mr-2 shrink-0 self-start mt-0.5 select-none">
          <Avatar src={message.senderAvatar} fallback={message.senderName?.[0] || "U"} size="sm" className="ring-1 ring-wa-border shadow-xs" />
        </div>
      )}

      <div className="flex items-center gap-1 sm:gap-1.5 relative max-w-full flex-row">
        <div className={cn(
          "relative rounded-lg px-2.5 sm:px-3 py-1.5 shadow-xs transition-colors duration-200 shrink min-w-0 max-w-full",
          isMsgOutgoing ? "bg-wa-bubble-out text-wa-text rounded-tr-none" : "bg-wa-bubble-in text-wa-text rounded-tl-none",
          reactionEmojis.length > 0 && "mb-3",
        )}>
          <span className={cn(
            "absolute top-0 w-0 h-0 border-solid border-t-[10px] transition-colors duration-200",
            isMsgOutgoing ? "right-[-8px] border-r-[8px] border-t-wa-bubble-out border-r-transparent" : "left-[-8px] border-l-[8px] border-t-wa-bubble-in border-l-transparent",
          )} />

          {isGroup && !isMsgOutgoing && !isDeleted && (
            <div className="text-xs font-semibold text-wa-primary mb-0.5 truncate max-w-xs">{message.senderName || "Group Member"}</div>
          )}

          {message.isForwarded && (
            <div className="flex items-center gap-1 text-[10px] text-wa-muted/80 italic mb-1.5 select-none">
              <svg viewBox="0 0 24 24" width="12" height="12" className="fill-wa-muted/70 inline shrink-0 rotate-[-45deg]">
                <path d="M15 5l-1.41 1.41L18.17 11H2V13h16.17l-4.59 4.59L15 19l7-7-7-7z" />
              </svg>
              <span>Forwarded</span>
            </div>
          )}

          {message.replyTo && (
            <div 
              onClick={handleScrollToQuotedMessage}
              className="mb-1.5 p-1.5 rounded bg-black/5 dark:bg-white/5 border-l-4 border-wa-primary cursor-pointer select-none text-[11px] sm:text-xs flex flex-col gap-0.5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            >
              <span className="font-semibold text-wa-primary">
                {message.replyTo.senderName}
              </span>
              <span className="text-wa-muted truncate max-w-[240px] sm:max-w-md">
                {message.replyTo.text || (
                  message.replyTo.type === "image" ? "📷 Photo" :
                  message.replyTo.type === "video" ? "🎥 Video" :
                  message.replyTo.type === "voice" ? "🎤 Voice Note" :
                  message.replyTo.type === "file" ? "📎 Document" : "Attachment"
                )}
              </span>
            </div>
          )}

          {renderMediaContent()}

          <div className="flex items-center justify-end gap-1 mt-0.5 float-right clear-both ml-3 -mb-0.5 select-none">
            <span className="text-[10px] sm:text-[11px] text-wa-muted font-sans">{displayTime}</span>
            {renderStatusTicks()}
          </div>

          {showReactionBar && !isDeleted && (
            <div className={cn(
              "absolute -top-12 bg-wa-header border border-wa-border rounded-full px-2 py-1.5 flex items-center gap-2 shadow-2xl z-50 animate-scale-up",
              isMsgOutgoing ? "right-0" : "left-0",
            )} onClick={(e) => e.stopPropagation()}>
              {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
                <button key={emoji} onClick={() => handleToggleReaction(emoji)} className="text-base sm:text-lg hover:scale-130 transition-transform cursor-pointer block leading-tight px-0.5">{emoji}</button>
              ))}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const spaceAbove = rect.top;
                  const spaceBelow = window.innerHeight - rect.bottom;
                  // If space above is less than 390px (picker height + padding) and there's more space below, open down!
                  if (spaceAbove < 390 && spaceBelow > spaceAbove) {
                    setPickerDirection("down");
                  } else {
                    setPickerDirection("up");
                  }
                  setShowFullReactionPicker(true);
                }} 
                className="text-wa-primary hover:scale-130 transition-transform cursor-pointer block leading-tight px-1 font-bold text-sm sm:text-base hover:text-wa-primary-hover"
                title="React with any emoji"
              >
                +
              </button>
            </div>
          )}

          {showFullReactionPicker && !isDeleted && (
            <div className={cn(
              "fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 select-none transition-colors",
              "sm:absolute sm:inset-auto sm:bg-transparent sm:p-0 sm:shadow-2xl sm:rounded-2xl sm:border sm:border-wa-border sm:bg-wa-modal sm:overflow-hidden sm:animate-scale-up",
              isMsgOutgoing ? "sm:right-0" : "sm:left-0",
              pickerDirection === "down" ? "sm:top-8 sm:bottom-auto" : "sm:bottom-8 sm:top-auto",
            )} onClick={(e) => {
              e.stopPropagation();
              setShowFullReactionPicker(false);
              setShowReactionBar(false);
            }}>
              <div 
                className="bg-wa-modal rounded-2xl border border-wa-border shadow-2xl overflow-hidden w-[300px] sm:w-[280px] h-[380px] sm:h-[350px] animate-scale-up sm:animate-none"
                onClick={(e) => e.stopPropagation()}
              >
                <EmojiPicker
                  theme={theme === "dark" ? "dark" : "light"}
                  onEmojiClick={(emojiData) => {
                    handleToggleReaction(emojiData.emoji);
                    setShowFullReactionPicker(false);
                    setShowReactionBar(false);
                  }}
                  width="100%"
                  height="100%"
                  skinTonesDisabled
                  previewConfig={{ showPreview: false }}
                />
              </div>
            </div>
          )}

          {reactionEmojis.length > 0 && (
            <div className="absolute -bottom-2.5 right-2 bg-wa-sidebar border border-wa-border rounded-full px-1.5 py-0.5 flex items-center gap-1 shadow-xs z-10 scale-95 sm:scale-100">
              {reactionEmojis.map((emoji) => {
                const count = reactions[emoji].length;
                const hasReacted = reactions[emoji].includes(currentUserId);
                return (
                  <button key={emoji} onClick={() => handleToggleReaction(emoji)} className={cn("text-xs hover:scale-110 transition-transform cursor-pointer inline-flex items-center gap-0.5 leading-none", hasReacted && "bg-wa-primary/20 rounded-full px-1 py-0.5")}>
                    <span>{emoji}</span>
                    {count > 1 && <span className="text-[9px] text-wa-muted font-bold">{count}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {!isDeleted && (
          <div className={cn(
            "relative shrink-0 select-none",
            (type === "image" || type === "video" || type === "file") ? "self-start mt-1.5" : "self-center"
          )}>
            <button onClick={handleOpenMenu} className="p-1 text-wa-muted hover:text-wa-text hover:bg-wa-active rounded-full transition-colors">
              <MoreVertical className="h-4 w-4" />
            </button>
            <AnimatePresence>
              {dropdownConfig.isOpen && (
                <motion.div initial={{ opacity: 0, scale: 0.95, y: dropdownConfig.style.bottom ? 4 : -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.12 }} style={dropdownConfig.style} className="absolute bg-wa-modal border border-wa-border rounded-lg py-1 shadow-2xl z-50 min-w-[160px] text-xs overflow-hidden" onClick={(e) => e.stopPropagation()}>
                  <button onClick={handleReplyAction} className="w-full text-left px-3 py-2 hover:bg-wa-hover text-wa-text transition-colors flex items-center gap-2"><Reply className="h-3.5 w-3.5 text-wa-muted" /><span>Reply</span></button>
                  <button onClick={handleOpenReactions} className="w-full text-left px-3 py-2 hover:bg-wa-hover text-wa-text transition-colors flex items-center gap-2"><Smile className="h-3.5 w-3.5 text-wa-muted" /><span>React</span></button>
                  <button onClick={handleForwardAction} className="w-full text-left px-3 py-2 hover:bg-wa-hover text-wa-text transition-colors flex items-center gap-2"><ArrowRight className="h-3.5 w-3.5 text-wa-muted" /><span>Forward</span></button>
                  <div className="border-t border-wa-border my-1" />
                  <button onClick={handleDeleteForMe} className="w-full text-left px-3 py-2 hover:bg-wa-hover text-wa-text transition-colors flex items-center gap-2"><Trash2 className="h-3.5 w-3.5 text-wa-muted" /><span>Delete for me</span></button>
                  {isMsgOutgoing && <button onClick={handleDeleteForEveryone} className="w-full text-left px-3 py-2 hover:bg-wa-hover text-red-500 transition-colors font-medium flex items-center gap-2"><Trash2 className="h-3.5 w-3.5 text-red-500" /><span>Delete for everyone</span></button>}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}, (prevProps, nextProps) => {
  return prevProps.message.id === nextProps.message.id && 
         prevProps.message.status === nextProps.message.status &&
         prevProps.message.text === nextProps.message.text &&
         JSON.stringify(prevProps.message.reactions) === JSON.stringify(nextProps.message.reactions) &&
         prevProps.isGroup === nextProps.isGroup;
});
