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
import { setReplyingMessage, setEditingMessage } from "../../redux/slices/uiSlice";
import { updateMessage } from "../../redux/slices/messageSlice";
import {
  setStatusViewOpen,
  setStatuses,
  setActiveUser,
  setActiveStatusIndex,
} from "../../redux/slices/statusSlice";
import { statusService } from "../../services/statusService";
import { cn } from "../../utils/cn";
import { formatMessageTime } from "../../utils/dateUtils";

const FONT_STYLES = [
  { name: "sans", family: "system-ui, -apple-system, sans-serif" },
  { name: "serif", family: "Georgia, Cambria, serif" },
  { name: "mono", family: "Courier New, Courier, monospace" },
  { name: "handwriting", family: "'Outfit', 'Caveat', cursive, sans-serif" },
];

// Simple client-side cache for link previews
const linkPreviewCache = {};

function LinkPreviewCard({ url }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!url) return;

    if (linkPreviewCache[url]) {
      setPreview(linkPreviewCache[url]);
      return;
    }

    setLoading(true);
    setError(false);

    const fetchPreview = async () => {
      try {
        const cleanUrl = url.trim();
        const res = await fetch(`/api/link-preview?url=${encodeURIComponent(cleanUrl)}`);
        if (!res.ok) throw new Error("Failed to load preview");
        
        const data = await res.json();
        if (data && !data.error) {
          linkPreviewCache[url] = data;
          setPreview(data);
        } else {
          setError(true);
        }
      } catch (err) {
        console.warn("Fetch link preview failed:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [url]);

  if (loading || error || !preview) return null;

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-2 p-1.5 bg-black/5 dark:bg-white/5 border border-wa-border/50 rounded-lg mt-2 mb-1 hover:bg-black/10 dark:hover:bg-white/10 transition-colors select-none max-w-[170px] min-[375px]:max-w-[200px] sm:max-w-[240px] md:max-w-[280px] cursor-pointer decoration-none"
      onClick={(e) => e.stopPropagation()}
    >
      {preview.image && (
        <img
          src={preview.image}
          alt={preview.title}
          className="w-10 sm:w-14 h-10 sm:h-14 object-cover rounded-md bg-black/10 shrink-0 self-center"
        />
      )}
      <div className="flex-1 min-w-0 flex flex-col justify-center py-0.5">
        <span className="text-[9px] sm:text-[10px] text-wa-muted font-sans font-medium uppercase tracking-wider block truncate">
          {preview.siteName || preview.domain}
        </span>
        <h4 className="text-[11px] sm:text-xs font-semibold text-wa-primary truncate mt-0.5">
          {preview.title}
        </h4>
        {preview.description && (
          <p className="text-[10px] sm:text-[11px] text-wa-muted line-clamp-2 mt-0.5 leading-snug">
            {preview.description}
          </p>
        )}
      </div>
    </a>
  );
}

const parseFormattedText = (text, groupMembers = [], onMentionClick) => {
  if (!text) return "";

  const sortedMembers = [...groupMembers].sort((a, b) => b.name.length - a.name.length);
  const urlPattern = /https?:\/\/[^\s\n]+|www\.[^\s\n]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,5}(?:\/[^\s\n]*)?/gi;
  const escapeRegex = (string) => string.replace(/[/\-\\^$*+?.()|[\]{}]/g, "\\$&");

  const matches = [];

  let match;
  while ((match = urlPattern.exec(text)) !== null) {
    matches.push({
      type: "url",
      text: match[0],
      index: match.index,
      length: match[0].length
    });
  }

  sortedMembers.forEach(member => {
    const nameEscaped = escapeRegex(member.name);
    const mentionPattern = new RegExp(`@${nameEscaped}\\b`, "gi");
    let mMatch;
    while ((mMatch = mentionPattern.exec(text)) !== null) {
      const isOverlapping = matches.some(existing => 
        (mMatch.index >= existing.index && mMatch.index < existing.index + existing.length) ||
        (mMatch.index + mMatch[0].length > existing.index && mMatch.index + mMatch[0].length <= existing.index + existing.length)
      );
      
      if (!isOverlapping) {
        matches.push({
          type: "mention",
          text: mMatch[0],
          member,
          index: mMatch.index,
          length: mMatch[0].length
        });
      }
    }
  });

  matches.sort((a, b) => a.index - b.index);

  const tokens = [];
  let cursor = 0;

  matches.forEach((m) => {
    if (m.index > cursor) {
      tokens.push({ type: "text", text: text.slice(cursor, m.index) });
    }
    tokens.push(m);
    cursor = m.index + m.length;
  });

  if (cursor < text.length) {
    tokens.push({ type: "text", text: text.slice(cursor) });
  }

  const formatMarkdown = (txt) => {
    const parts = txt.split(/(\*[^\*\s][^\*]*[^\*\s]\*|\*[^\*\s]\*|_[^\_\s][^\_]*[^\_\s]_|_[^\_\s]_|~[^~\s][^~]*[^~\s]~|~[^~\s]~)/g);
    
    return parts.map((part, i) => {
      if (i % 2 === 0) return part;
      
      const char = part[0];
      const innerText = part.slice(1, -1);
      
      if (char === "*") {
        return <strong key={i} className="font-bold">{innerText}</strong>;
      }
      if (char === "_") {
        return <em key={i} className="italic">{innerText}</em>;
      }
      if (char === "~") {
        return <span key={i} className="line-through opacity-80">{innerText}</span>;
      }
      return part;
    });
  };

  return tokens.map((token, idx) => {
    if (token.type === "text") {
      return <React.Fragment key={idx}>{formatMarkdown(token.text)}</React.Fragment>;
    }
    if (token.type === "url") {
      let href = token.text;
      if (!/^https?:\/\//i.test(href)) {
        href = "https://" + href;
      }
      return (
        <a
          key={idx}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 dark:text-blue-400 hover:underline break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {token.text}
        </a>
      );
    }
    if (token.type === "mention") {
      return (
        <span
          key={idx}
          onClick={(e) => {
            e.stopPropagation();
            if (onMentionClick) onMentionClick(token.member);
          }}
          className="text-wa-primary font-semibold hover:underline cursor-pointer bg-wa-primary/10 px-1 py-0.5 rounded animate-pulse-subtle"
        >
          {token.text}
        </span>
      );
    }
    return null;
  });
};

const CHARACTER_LIMIT = 500;
const LINE_LIMIT = 8;

function ExpandableText({ text, groupMembers, onMentionClick, isCaption = false, noPreview = false }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!text) return null;

  const lines = text.split("\n");
  const isTooLong = text.length > CHARACTER_LIMIT || lines.length > LINE_LIMIT;

  const handleToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const formattedText = parseFormattedText(text, groupMembers, onMentionClick);

  if (!isTooLong) {
    return (
      <div className="flex flex-col">
        <p className={cn("text-wa-text leading-snug whitespace-pre-wrap break-words", isCaption ? "text-xs sm:text-sm mt-1.5" : "text-sm sm:text-base")}>
          {formattedText}
        </p>
        {!isCaption && !noPreview && <LinkPreviewFinder text={text} />}
      </div>
    );
  }

  let displayText;
  if (!isExpanded) {
    if (text.length > CHARACTER_LIMIT) {
      displayText = text.slice(0, CHARACTER_LIMIT) + "...";
    } else {
      displayText = lines.slice(0, LINE_LIMIT).join("\n") + "\n...";
    }
  } else {
    displayText = text;
  }

  const renderedText = parseFormattedText(displayText, groupMembers, onMentionClick);

  return (
    <div className="flex flex-col">
      <p className={cn("text-wa-text leading-snug whitespace-pre-wrap break-words", isCaption ? "text-xs sm:text-sm mt-1.5" : "text-sm sm:text-base")}>
        {renderedText}
      </p>
      <button
        onClick={handleToggle}
        className="text-xs font-semibold text-wa-primary hover:underline self-start mt-1 focus:outline-none"
      >
        {isExpanded ? "Read less" : "Read more"}
      </button>
      {!isCaption && !noPreview && !isExpanded && <LinkPreviewFinder text={displayText} />}
      {!isCaption && !noPreview && isExpanded && <LinkPreviewFinder text={text} />}
    </div>
  );
}

function LinkPreviewFinder({ text }) {
  const firstUrlMatch = text.match(/(https?:\/\/[^\s\n]+|www\.[^\s\n]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,5}(?:\/[^\s\n]*)?)/i);
  const firstUrl = firstUrlMatch ? firstUrlMatch[0] : null;

  if (!firstUrl) return null;
  return <LinkPreviewCard url={firstUrl} />;
}

export const MessageBubble = React.memo(function MessageBubble({ message, isGroup, groupMembers = [] }) {
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
    noPreview = false,
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
  const storeStatuses = useAppSelector((state) => state.status.statuses);

  const [showFullReactionPicker, setShowFullReactionPicker] = useState(false);
  const [pickerDirection, setPickerDirection] = useState("up");

  const handleStatusReplyClick = async (e) => {
    e.stopPropagation();
    const statusId = message.replyTo?.statusId || message.replyTo?.messageId?.replace("status-", "");
    if (!statusId) return;

    try {
      let list = storeStatuses;
      if (!list || list.length === 0) {
        list = await statusService.fetchStatuses(currentUserId);
        dispatch(setStatuses(list));
      }

      const group = list.find((g) =>
        g.statuses.some((s) => s.id === statusId)
      );

      if (group) {
        const index = group.statuses.findIndex((s) => s.id === statusId);
        dispatch(setStatusViewOpen(true));
        dispatch(setActiveUser(group.userId));
        dispatch(setActiveStatusIndex(index >= 0 ? index : 0));
      } else {
        alert("This status update is no longer available.");
      }
    } catch (err) {
      console.warn("Failed to open status viewer from bubble:", err);
    }
  };

  const handleMentionClick = (member) => {
    const customEvent = new CustomEvent("wa_open_direct_chat", {
      detail: { user: member },
    });
    window.dispatchEvent(customEvent);
  };

  const handleClearReplyContext = async (e) => {
    e.stopPropagation();
    try {
      const updatedMessage = {
        ...message,
        replyTo: null
      };
      dispatch(
        updateMessage({
          chatId: message.conversationId,
          message: updatedMessage
        })
      );
      await messageService.removeMessageReplyContext(id);
    } catch (err) {
      console.warn("Failed to clear quote context:", err);
    }
  };

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
  const [showHistoryTooltip, setShowHistoryTooltip] = useState(false);

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

  const EDIT_TIME_LIMIT_MS = 15 * 60 * 1000;
  const messageAge = createdAt ? (Date.now() - new Date(createdAt).getTime()) : 0;
  const canEdit = isMsgOutgoing && !isDeleted && messageAge < EDIT_TIME_LIMIT_MS && (type === "text" || type === "image" || type === "video" || type === "file");

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

  const handleEditAction = (e) => {
    e.stopPropagation();
    setDropdownConfig((prev) => ({ ...prev, isOpen: false }));
    dispatch(setEditingMessage(message));
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
          <div className="relative rounded-md overflow-hidden mb-1 max-w-[150px] min-[375px]:max-w-[180px] sm:max-w-[240px] md:max-w-xs select-none">
            <div
              onClick={() => setImageModalOpen(true)}
              className="relative group cursor-pointer block overflow-hidden rounded bg-black/10"
            >
              <img
                src={mediaUrl || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe"}
                alt="Attachment"
                className="w-full h-auto object-cover max-h-32 min-[375px]:max-h-36 sm:max-h-48 md:max-h-56 transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Maximize2 className="h-6 w-6 text-white drop-shadow-md" />
              </div>
            </div>
            {text && (
              <ExpandableText
                text={text}
                groupMembers={groupMembers}
                onMentionClick={handleMentionClick}
                isCaption={true}
              />
            )}
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
          <div className="relative rounded-md overflow-hidden mb-1 max-w-[150px] min-[375px]:max-w-[180px] sm:max-w-[240px] md:max-w-xs">
            <video src={mediaUrl} controls controlsList="nodownload" className="w-full max-h-32 min-[375px]:max-h-36 sm:max-h-48 md:max-h-56 object-cover rounded bg-black" />
            {text && (
              <ExpandableText
                text={text}
                groupMembers={groupMembers}
                onMentionClick={handleMentionClick}
                isCaption={true}
              />
            )}
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
        return (
          <ExpandableText
            text={text}
            groupMembers={groupMembers}
            onMentionClick={handleMentionClick}
            noPreview={noPreview}
          />
        );
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
              onClick={
                message.replyTo.isStatus || message.replyTo.messageId?.startsWith("status-")
                  ? handleStatusReplyClick
                  : handleScrollToQuotedMessage
              }
              className={cn(
                "mb-1.5 p-1.5 rounded bg-black/5 dark:bg-white/5 border-l-4 cursor-pointer select-none text-[11px] sm:text-xs flex items-center justify-between gap-2 hover:bg-black/10 dark:hover:bg-white/10 transition-colors relative group/quote",
                (message.replyTo.isStatus || message.replyTo.messageId?.startsWith("status-"))
                  ? "border-[#00a884] bg-emerald-500/5"
                  : "border-wa-primary"
              )}
            >
              <div className="flex-1 min-w-0 flex flex-col gap-0.5 text-left">
                <span className="font-semibold text-wa-primary flex items-center gap-1.5">
                  {(message.replyTo.isStatus || message.replyTo.messageId?.startsWith("status-")) ? (
                    <>
                      <span className="text-[10px] uppercase font-extrabold tracking-wider px-1 bg-[#00a884]/20 text-[#00a884] rounded">Status</span>
                      <span className="truncate">{message.replyTo.senderName}</span>
                    </>
                  ) : (
                    message.replyTo.senderName
                  )}
                </span>
                <span className="text-wa-muted truncate max-w-[160px] sm:max-w-xs pr-5">
                  {message.replyTo.text || (
                    message.replyTo.type === "image" ? "📷 Photo" :
                    message.replyTo.type === "video" ? "🎥 Video" :
                    message.replyTo.type === "voice" ? "🎤 Voice Note" :
                    message.replyTo.type === "file" ? "📎 Document" : "Attachment"
                  )}
                </span>
              </div>

              {/* Status Thumbnail preview on the right side of the bubble */}
              {(message.replyTo.isStatus || message.replyTo.messageId?.startsWith("status-")) && (
                <div className="shrink-0 flex items-center justify-center pointer-events-none select-none">
                  {message.replyTo.type === "text" ? (
                    <div 
                      className="w-8 h-8 rounded flex items-center justify-center text-[7px] font-bold text-white overflow-hidden text-ellipsis line-clamp-2 leading-none p-0.5" 
                      style={{ 
                        backgroundColor: message.replyTo.statusBgColor || "#005c4b",
                        fontFamily: FONT_STYLES.find(f => f.name === message.replyTo.statusTextStyle)?.family || "sans-serif"
                      }}
                    >
                      {message.replyTo.statusTextContent}
                    </div>
                  ) : (
                    <img 
                      src={message.replyTo.mediaUrl || message.replyTo.statusMediaUrl} 
                      alt="Status preview" 
                      className="w-8 h-8 rounded object-cover border border-white/10"
                    />
                  )}
                </div>
              )}

              {isMsgOutgoing && !(message.replyTo.isStatus || message.replyTo.messageId?.startsWith("status-")) && (
                <button
                  onClick={handleClearReplyContext}
                  className="absolute top-1 right-1 h-4.5 w-4.5 rounded-full bg-wa-modal border border-wa-border text-wa-muted hover:text-red-500 hover:bg-wa-hover opacity-0 group-hover/quote:opacity-100 transition-opacity flex items-center justify-center shadow-sm cursor-pointer z-20"
                  title="Remove quote preview"
                >
                  <svg viewBox="0 0 24 24" width="10" height="10" className="fill-current">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {renderMediaContent()}

          <div className="flex items-center justify-end gap-1 mt-0.5 float-right clear-both ml-3 -mb-0.5 select-none">
            <span className="text-[10px] sm:text-[11px] text-wa-muted font-sans inline-flex items-center">
              {message.editedAt && (
                <span 
                  className="relative mr-1.5 text-[9px] italic opacity-85 cursor-help select-none font-semibold hover:underline text-wa-muted/95"
                  onMouseEnter={() => setShowHistoryTooltip(true)}
                  onMouseLeave={() => setShowHistoryTooltip(false)}
                >
                  edited
                  {showHistoryTooltip && message.editHistory && message.editHistory.length > 0 && (
                    <span className="absolute bottom-full right-0 mb-2.5 bg-wa-modal border border-wa-border p-2.5 rounded-lg shadow-2xl text-[10px] min-w-[180px] z-[99] text-left normal-case not-italic text-wa-text select-text pointer-events-auto leading-relaxed animate-scale-up">
                      <span className="font-semibold block border-b border-wa-border pb-1.5 mb-1.5 text-wa-primary text-[11px]">Edit History</span>
                      <span className="block max-h-36 overflow-y-auto space-y-1.5">
                        {message.editHistory.map((hist, idx) => (
                          <span key={idx} className="block border-b border-wa-border/30 pb-1.5 last:border-0 last:pb-0">
                            <span className="text-wa-muted font-mono block text-[9px]">
                              {new Date(hist.editedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </span>
                            <span className="block mt-0.5 break-words text-wa-text">"{hist.text}"</span>
                          </span>
                        ))}
                      </span>
                    </span>
                  )}
                </span>
              )}
              <span>{displayTime}</span>
            </span>
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
                  {canEdit && (
                    <button onClick={handleEditAction} className="w-full text-left px-3 py-2 hover:bg-wa-hover text-wa-text transition-colors flex items-center gap-2">
                      <svg viewBox="0 0 24 24" width="14" height="14" className="stroke-wa-muted stroke-2 fill-none inline shrink-0">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z" />
                      </svg>
                      <span>Edit</span>
                    </button>
                  )}
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
         prevProps.message.noPreview === nextProps.message.noPreview &&
         prevProps.message.editedAt === nextProps.message.editedAt &&
         JSON.stringify(prevProps.message.reactions) === JSON.stringify(nextProps.message.reactions) &&
         prevProps.isGroup === nextProps.isGroup &&
         prevProps.groupMembers?.length === nextProps.groupMembers?.length;
});
