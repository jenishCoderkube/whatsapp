"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "../../hooks/useTranslation";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
  loading: () => <EmojiPickerLoader />,
});

function EmojiPickerLoader() {
  const { t } = useTranslation();
  return (
    <div className="w-[280px] h-[350px] bg-wa-modal flex items-center justify-center text-xs text-wa-muted">
      {t("chat.loading_emojis") || "Loading Emojis..."}
    </div>
  );
}

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
  ChevronDown,
  Camera,
  Mic,
  Paperclip,
  Palette,
  MapPin,
  CornerUpRight,
} from "lucide-react";
import { Modal } from "../ui/Modal";
import { Avatar } from "../ui/Avatar";
import { useAppSelector, useAppDispatch } from "../../hooks/useRedux";
import { messageService } from "../../services/messageService";
import { supabase } from "../../lib/supabaseClient";
import { setReplyingMessage, setEditingMessage } from "../../redux/slices/uiSlice";
import { updateMessage, updateMessageStatus, replaceOptimisticMessage, deleteMessage } from "../../redux/slices/messageSlice";
import { updateLastMessage } from "../../redux/slices/chatSlice";
import {
  setStatusViewOpen,
  setStatuses,
  setActiveUser,
  setActiveStatusIndex,
} from "../../redux/slices/statusSlice";
import { statusService } from "../../services/statusService";
import { cn } from "../../utils/cn";
import { formatMessageTime } from "../../utils/dateUtils";
import LiveLocationBubble from "./LiveLocationBubble";
import StaticLocationBubble from "./StaticLocationBubble";
import { MediaGrid } from "./MediaGrid";
import { MediaViewer } from "./MediaViewer";

import { ExpandableText } from "./ExpandableText";
import { VoiceNotePlayer } from "./VoiceNotePlayer";

const FONT_STYLES = [
  { name: "sans", family: "system-ui, -apple-system, sans-serif" },
  { name: "serif", family: "Georgia, Cambria, serif" },
  { name: "mono", family: "Courier New, Courier, monospace" },
  { name: "handwriting", family: "'Outfit', 'Caveat', cursive, sans-serif" },
];

export const MessageBubble = React.memo(function MessageBubble({ message, isGroup, groupMembers = [] }) {
  const { t } = useTranslation();
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
        <span className="bg-wa-encrypted/50 text-wa-muted text-[11px] sm:text-[12px] px-3 py-1.5 rounded-md text-center max-w-md shadow-xs backdrop-blur-sm tracking-tight font-medium leading-relaxed">
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
  const convId = message.conversation_id || message.conversationId;
  const messagesForChat = useAppSelector((state) => state.message.messages[convId] || []);

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
        alert(t("status.not_available") || "This status update is no longer available.");
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

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [isDeletedForMe, setIsDeletedForMe] = useState(false);
  const [showReactionBar, setShowReactionBar] = useState(false);
  const [dropdownConfig, setDropdownConfig] = useState({
    isOpen: false,
    style: {},
  });
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  const [showHistoryTooltip, setShowHistoryTooltip] = useState(false);

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
  const DELETE_EVERYONE_TIME_LIMIT_MS = 60 * 60 * 1000; // 1 hour
  const messageAge = createdAt ? (Date.now() - new Date(createdAt).getTime()) : 0;
  const canEdit = isMsgOutgoing && !isDeleted && messageAge < EDIT_TIME_LIMIT_MS && (type === "text" || type === "image" || type === "video" || type === "file");
  const canDeleteForEveryone = isMsgOutgoing && !isDeleted && messageAge < DELETE_EVERYONE_TIME_LIMIT_MS;

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

    // Dynamically align dropdown based on available space on the right of the chevron button.
    // If the space to the right of the chevron is less than 180px, align right (extend left).
    // Otherwise, align left (extend right).
    if (window.innerWidth - rect.left < 180) {
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

      // Check if this was the latest message
      const wasLatest = messagesForChat.length > 0 && messagesForChat[messagesForChat.length - 1].id === id;
      dispatch(deleteMessage({ chatId: convId, messageId: id }));

      if (wasLatest) {
        const remaining = messagesForChat.filter(m => m.id !== id && !stored.includes(m.id));
        if (remaining.length > 0) {
          const newLatest = remaining[remaining.length - 1];
          let previewText = newLatest.text;
          if (newLatest.type === "image") previewText = "Photo";
          if (newLatest.type === "video") previewText = "Video";
          if (newLatest.type === "file") previewText = "Document";
          if (newLatest.type === "voice") previewText = "Voice Message";
          if (newLatest.type === "sticker") previewText = "Sticker";
          if (newLatest.type === "gif") previewText = "GIF";

          dispatch(
            updateLastMessage({
              chatId: convId,
              text: previewText,
              timestamp: newLatest.timestamp || new Date(newLatest.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }),
              isOutgoing: newLatest.senderId === currentUserId || newLatest.isOutgoing,
              status: newLatest.status,
              isForwarded: newLatest.isForwarded,
            })
          );
        } else {
          dispatch(
            updateLastMessage({
              chatId: convId,
              text: "",
              timestamp: "",
              isOutgoing: false,
              status: null,
            })
          );
        }
      }

      import("../../services/indexedDBService").then(({ indexedDBService }) => {
        indexedDBService.removePendingMessage(id).catch(console.error);
      });
    } catch (err) {}
  };

  const handleDeleteForEveryone = async (e) => {
    e.stopPropagation();
    if (!isMsgOutgoing || isDeleted) return;
    const currentAge = createdAt ? (Date.now() - new Date(createdAt).getTime()) : 0;
    if (currentAge > 60 * 60 * 1000) {
      alert("Delete for everyone time limit (1 hour) has expired.");
      setDropdownConfig((prev) => ({ ...prev, isOpen: false }));
      return;
    }
    try {
      const targetConvId = message.conversation_id || message.conversationId;
      await messageService.deleteMessageForEveryone(id, targetConvId);
      setDropdownConfig((prev) => ({ ...prev, isOpen: false }));
    } catch (err) {
      alert(err.message || "Failed to delete message for everyone");
    }
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

  const handleInfoAction = (e) => {
    e.stopPropagation();
    setDropdownConfig((prev) => ({ ...prev, isOpen: false }));
    setIsInfoModalOpen(true);
  };

  const handleToggleFavoriteSticker = (e) => {
    if (e) e.stopPropagation();
    if (type !== "sticker" || !mediaUrl) return;
    try {
      const storedFavs = JSON.parse(localStorage.getItem("wa_favorite_stickers") || "[]");
      let newFavs;
      if (storedFavs.includes(mediaUrl)) {
        newFavs = storedFavs.filter(x => x !== mediaUrl);
      } else {
        newFavs = [mediaUrl, ...storedFavs];
      }
      localStorage.setItem("wa_favorite_stickers", JSON.stringify(newFavs));
    } catch (err) {
      console.warn("Failed to toggle favorite sticker", err);
    }
    setDropdownConfig((prev) => ({ ...prev, isOpen: false }));
  };

  const isFavoriteSticker = () => {
    if (type !== "sticker" || !mediaUrl) return false;
    try {
      const storedFavs = JSON.parse(localStorage.getItem("wa_favorite_stickers") || "[]");
      return storedFavs.includes(mediaUrl);
    } catch (err) {
      return false;
    }
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

  const handleRetryResend = async (e) => {
    if (e) e.stopPropagation();
    setDropdownConfig((prev) => ({ ...prev, isOpen: false }));
    
    const conversationId = message.conversationId || message.conversation_id;
    dispatch(
      updateMessageStatus({
        chatId: conversationId,
        messageId: id,
        status: "pending",
      })
    );

    try {
      // Deduplication Check
      let existingConfirmedRow = null;
      try {
        const { supabase } = await import("../../lib/supabaseClient");
        // 1. Check using client_id column if migration is active
        const { data: dbCheckClientId } = await supabase
          .from("messages")
          .select("*")
          .eq("client_id", id)
          .limit(1);

        if (dbCheckClientId && dbCheckClientId.length > 0) {
          existingConfirmedRow = dbCheckClientId[0];
        } else {
          // 2. Heuristic fallback matching for backward-compatibility
          const checkTimeBound = new Date(Date.now() - 10 * 60 * 1000).toISOString();
          let semanticQuery = supabase
            .from("messages")
            .select("*")
            .eq("conversation_id", conversationId)
            .eq("sender_id", currentUserId)
            .eq("type", type)
            .gte("created_at", checkTimeBound);

          if (type === "text") {
            const { encodeMessageText } = await import("../../utils/messageParser");
            const encoded = encodeMessageText(text, message.replyTo, message.isForwarded, {}, noPreview);
            semanticQuery = semanticQuery.eq("text", encoded);
          } else if (fileName) {
            semanticQuery = semanticQuery.eq("file_name", fileName);
          }

          const { data: dbCheckSemantic } = await semanticQuery.limit(1);
          if (dbCheckSemantic && dbCheckSemantic.length > 0) {
            existingConfirmedRow = dbCheckSemantic[0];
          }
        }
      } catch (dedupErr) {
        console.warn("Retry deduplication query check failed:", dedupErr);
      }

      let confirmedRow = null;
      if (existingConfirmedRow) {
        const { parseMessageText } = await import("../../utils/messageParser");
        const { text: cleanText, reactions, replyTo: parsedReplyTo, isForwarded: parsedIsForward, noPreview: parsedNoPreview } = parseMessageText(existingConfirmedRow.text || "");
        
        confirmedRow = {
          id: existingConfirmedRow.id,
          conversationId: existingConfirmedRow.conversation_id,
          conversation_id: existingConfirmedRow.conversation_id,
          text: cleanText,
          rawText: existingConfirmedRow.text || "",
          reactions: {},
          replyTo: existingConfirmedRow.reply_to || parsedReplyTo,
          isForwarded: existingConfirmedRow.is_forwarded || parsedIsForward,
          noPreview: existingConfirmedRow.no_preview || parsedNoPreview,
          editedAt: existingConfirmedRow.edited_at,
          editHistory: existingConfirmedRow.edit_history,
          timestamp: existingConfirmedRow.timestamp_string,
          status: existingConfirmedRow.status,
          type: existingConfirmedRow.type,
          mediaUrl: existingConfirmedRow.media_url,
          fileName: existingConfirmedRow.file_name,
          fileSize: existingConfirmedRow.file_size,
          duration: existingConfirmedRow.duration,
          senderId: existingConfirmedRow.sender_id,
          sender_id: existingConfirmedRow.sender_id,
          isOutgoing: true,
          createdAt: existingConfirmedRow.created_at,
        };
      } else {
        let finalMediaUrl = mediaUrl;

        if (type === "image" || type === "video" || type === "file") {
          const { indexedDBService } = await import("../../services/indexedDBService");
          const fileObj = await indexedDBService.getPendingFile(id);

          if (fileObj) {
            const { storageService } = await import("../../services/storageService");
            finalMediaUrl = await storageService.uploadFile(fileObj, type + "s");
          }
        }

        confirmedRow = await messageService.sendMessage({
          conversationId: conversationId,
          senderId: currentUserId,
          text: text,
          type: type,
          mediaUrl: finalMediaUrl,
          fileName: fileName,
          fileSize: fileSize,
          timestampString: timestamp,
          replyTo: message.replyTo,
          noPreview: noPreview,
          clientId: id,
        });
      }

      dispatch(
        replaceOptimisticMessage({
          chatId: conversationId,
          tempId: id,
          confirmedMessage: {
            ...confirmedRow,
            isOutgoing: true,
          },
        })
      );

      const { indexedDBService } = await import("../../services/indexedDBService");
      await indexedDBService.removePendingMessage(id);
    } catch (err) {
      console.error("Manual resend failed:", err);
      dispatch(
        updateMessageStatus({
          chatId: conversationId,
          messageId: id,
          status: "failed",
        })
      );
    }
  };

  const renderStatusTicks = (overrideColorClass) => {
    if (!isMsgOutgoing || isDeleted) return null;
    const mutedColor = overrideColorClass || "text-wa-muted";
    if (status === "failed") {
      return (
        <span className="text-red-500 text-[10px] ml-1 font-medium inline-flex items-center gap-1 select-none">
          <AlertCircle className="h-3 w-3 inline" /> 
          <span>{t("chat.failed") || "Failed"}</span>
          <button
            onClick={handleRetryResend}
            className="text-wa-primary hover:underline font-bold cursor-pointer border-none bg-transparent flex items-center leading-none"
            title={t("chat.retry") || "Retry resending"}
          >
            ↺ {t("chat.retry") || "Retry"}
          </button>
        </span>
      );
    }
    if (status === "pending") {
      return (
        <Clock className={cn("h-3 w-3 inline-block ml-1 shrink-0", mutedColor)} />
      );
    }
    if (status === "read") {
      return (
        <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb] inline-block ml-1 shrink-0" />
      );
    }
    if (status === "delivered") {
      return (
        <CheckCheck className={cn("h-3.5 w-3.5 inline-block ml-1 shrink-0", mutedColor)} />
      );
    }
    return (
      <Check className={cn("h-3.5 w-3.5 inline-block ml-1 shrink-0", mutedColor)} />
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
          <span>{t("chat.message_deleted") || "This message was deleted"}</span>
        </div>
      );
    }

    switch (type) {
      case "image":
      case "image_group": {
        const isGroupedImage = type === "image_group";
        const imageList = isGroupedImage ? (message.messages || []) : [message];
        return (
          <div className="relative rounded-md mb-1 max-w-[320px] select-none">
            <MediaGrid
              messages={imageList}
              onImageClick={(idx) => {
                setViewerIndex(idx);
                setViewerOpen(true);
              }}
            />
            {!isGroupedImage && text && (
              <ExpandableText
                text={text}
                groupMembers={groupMembers}
                onMentionClick={handleMentionClick}
                isCaption={true}
              />
            )}
            {isGroupedImage && imageList.map(msg => msg.text).filter(Boolean).map((cap, capIdx) => (
              <ExpandableText
                key={capIdx}
                text={cap}
                groupMembers={groupMembers}
                onMentionClick={handleMentionClick}
                isCaption={true}
              />
            ))}
            <MediaViewer
              isOpen={viewerOpen}
              onClose={() => setViewerOpen(false)}
              mediaList={imageList}
              initialIndex={viewerIndex}
            />
          </div>
        );
      }
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
      case "sticker":
        return (
          <div className="relative w-[140px] h-[140px] sm:w-[170px] sm:h-[170px] flex items-center justify-center select-none group/sticker">
            <img
              src={mediaUrl}
              alt="Sticker"
              className="w-full h-full object-contain pointer-events-none"
              loading="lazy"
            />
            {/* Timestamp & status ticks overlaid like WhatsApp */}
            <div className="absolute bottom-1 right-1 bg-black/45 backdrop-blur-xs text-white/95 px-1.5 py-0.5 rounded-md text-[9px] flex items-center gap-1 opacity-70 group-hover/sticker:opacity-100 transition-opacity duration-200 pointer-events-none select-none shadow-xs">
              <span>{displayTime}</span>
              {renderStatusTicks("text-white/80")}
            </div>
          </div>
        );
      case "gif":
        return (
          <div className="relative rounded-md overflow-hidden mb-1 max-w-[240px] select-none bg-black/5 flex items-center justify-center">
            <img
              src={mediaUrl}
              alt="GIF"
              className="w-full max-h-56 object-cover rounded"
              loading="lazy"
            />
            {/* WhatsApp GIF Badge */}
            <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-xs text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-md flex items-center justify-center tracking-wider shadow-xs pointer-events-none select-none border border-white/10 uppercase">
              GIF
            </div>
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
          <VoiceNotePlayer
            id={id}
            mediaUrl={mediaUrl}
            durationMetadata={duration}
          />
        );
      case "file":
        return (
          <div onClick={handleDownload} className="flex items-center gap-3 p-2 rounded bg-wa-header hover:bg-wa-hover mb-1 cursor-pointer transition-colors group border border-wa-border">
            <div className="flex items-center justify-center h-10 w-10 rounded bg-wa-active text-wa-muted shrink-0 group-hover:text-wa-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-wa-text truncate">{fileName || text}</p>
              <span className="text-[10px] text-wa-muted block truncate">{fileSize || (t("chat.attachment") || "Attachment")}</span>
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
                {isMissed 
                  ? (isVideo ? (t("call.missed_video") || "Missed video call") : (t("call.missed_voice") || "Missed voice call")) 
                  : (isVideo ? (t("call.video") || "Video call") : (t("call.voice") || "Voice call"))}
              </p>
              <span className="text-[11px] text-wa-muted">
                {message.metadata?.duration ? `${message.metadata.duration}s` : ""}
                {!isMissed && ` • ${t("call.completed") || "Completed"}`}
              </span>
            </div>
          </div>
        );
      case "location":
        return <StaticLocationBubble message={message} />;
      case "live_location":
        return <LiveLocationBubble message={message} />;
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
        "flex w-full mb-1.5 sm:mb-2.5 px-2 sm:px-4 select-text relative transition-all duration-300 rounded-lg group/row",
        isMsgOutgoing ? "justify-end" : "justify-start",
      )}
    >
      {isGroup && !isMsgOutgoing && (
        <div className="mr-1.5 sm:mr-2 shrink-0 self-start mt-0.5 select-none">
          <Avatar src={message.senderAvatar} fallback={message.senderName?.[0] || "U"} size="sm" className="ring-1 ring-wa-border shadow-xs" uid={message.senderId} />
        </div>
      )}

      <div className="flex items-center gap-1 sm:gap-1.5 relative max-w-[85%] sm:max-w-[70%] md:max-w-[65%] flex-row">
        {/* Quick Reaction Button on Hover (Outgoing) */}
        {isMsgOutgoing && !isDeleted && (
          <div className={cn(
            "transition-opacity duration-150 relative shrink-0 select-none self-center",
            showReactionBar ? "opacity-100" : "opacity-0 group-hover/row:opacity-100"
          )}>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowReactionBar(prev => !prev);
              }}
              className="p-1 text-wa-muted hover:text-wa-text hover:bg-wa-hover rounded-full transition-colors cursor-pointer"
              title={t("chat.react_to_message") || "React to message"}
            >
              <Smile className="h-4.5 w-4.5" />
            </button>
            <AnimatePresence>
              {showReactionBar && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 10 }}
                  transition={{ duration: 0.1 }}
                  className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-wa-header border border-wa-border rounded-full px-2 py-1.5 flex items-center gap-2 shadow-2xl z-50"
                  onClick={(e) => e.stopPropagation()}
                >
                  {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
                    <button key={emoji} onClick={() => handleToggleReaction(emoji)} className="text-base sm:text-lg hover:scale-130 transition-transform cursor-pointer block leading-tight px-0.5">{emoji}</button>
                  ))}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowFullReactionPicker(true);
                    }} 
                    className="text-wa-primary hover:scale-130 transition-transform cursor-pointer block leading-tight px-1 font-bold text-sm sm:text-base hover:text-wa-primary-hover"
                  >
                    +
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <div className={cn(
          "relative rounded-lg px-2.5 sm:px-3 py-1.5 shadow-xs transition-colors duration-200 shrink min-w-0 max-w-full group",
          type === "sticker" ? "bg-transparent shadow-none p-0" : (isMsgOutgoing ? "bg-wa-bubble-out text-wa-text rounded-tr-none" : "bg-wa-bubble-in text-wa-text rounded-tl-none"),
          reactionEmojis.length > 0 && "mb-3",
        )}>
          {type !== "sticker" && (
            <span className={cn(
              "absolute top-0 w-0 h-0 border-solid border-t-[10px] transition-colors duration-200",
              isMsgOutgoing ? "right-[-8px] border-r-[8px] border-t-wa-bubble-out border-r-transparent" : "left-[-8px] border-l-[8px] border-t-wa-bubble-in border-l-transparent",
            )} />
          )}

          {isGroup && !isMsgOutgoing && !isDeleted && (
            <div className="text-xs font-semibold text-wa-primary mb-0.5 truncate max-w-xs">{message.senderName || (t("chat.group_member") || "Group Member")}</div>
          )}

          {(message.isForwarded || (message.type === "image_group" && message.messages?.some(m => m.isForwarded))) && (
            <div className="flex items-center gap-1 text-[10px] text-wa-muted/80 italic mb-1.5 select-none">
              <svg viewBox="0 0 24 24" width="12" height="12" className="fill-wa-muted/70 inline shrink-0 rotate-[-45deg]">
                <path d="M15 5l-1.41 1.41L18.17 11H2V13h16.17l-4.59 4.59L15 19l7-7-7-7z" />
              </svg>
              <span>{t("chat.forwarded")}</span>
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
                      <span className="text-[10px] uppercase font-extrabold tracking-wider px-1 bg-[#00a884]/20 text-[#00a884] rounded">{t("status.status") || "Status"}</span>
                      <span className="truncate">{message.replyTo.senderName}</span>
                    </>
                  ) : (
                    message.replyTo.senderName
                  )}
                </span>
                <span className="text-wa-muted truncate max-w-[160px] sm:max-w-xs pr-5 flex items-center gap-1">
                  {message.replyTo.text || (
                    <>
                      {message.replyTo.type === "image" && (
                        <>
                          <Camera className="h-3.5 w-3.5 shrink-0 text-wa-muted" />
                          <span>{t("chat.photo") || "Photo"}</span>
                        </>
                      )}
                      {message.replyTo.type === "video" && (
                        <>
                          <Video className="h-3.5 w-3.5 shrink-0 text-wa-muted" />
                          <span>{t("chat.video") || "Video"}</span>
                        </>
                      )}
                      {message.replyTo.type === "voice" && (
                        <>
                          <Mic className="h-3.5 w-3.5 shrink-0 text-wa-muted" />
                          <span>{t("chat.voice_note") || "Voice Note"}</span>
                        </>
                      )}
                      {message.replyTo.type === "file" && (
                        <>
                          <Paperclip className="h-3.5 w-3.5 shrink-0 text-wa-muted" />
                          <span>{t("chat.document") || "Document"}</span>
                        </>
                      )}
                      {message.replyTo.type === "sticker" && (
                        <>
                          <Palette className="h-3.5 w-3.5 shrink-0 text-wa-muted" />
                          <span>{t("chat.sticker") || "Sticker"}</span>
                        </>
                      )}
                      {message.replyTo.type === "gif" && (
                        <>
                          <Play className="h-3.5 w-3.5 shrink-0 text-wa-muted" />
                          <span>{t("chat.gif") || "GIF"}</span>
                        </>
                      )}
                      {message.replyTo.type === "live_location" && (
                        <>
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-wa-muted" />
                          <span>{t("chat.live_location") || "Live Location"}</span>
                        </>
                      )}
                      {message.replyTo.type === "location" && (
                        <>
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-wa-muted" />
                          <span>{t("chat.location") || "Location"}</span>
                        </>
                      )}
                      {!["image", "video", "voice", "file", "sticker", "gif", "live_location", "location"].includes(message.replyTo.type) && (
                        <span>{t("chat.attachment") || "Attachment"}</span>
                      )}
                    </>
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
                      alt={t("status.preview") || "Status preview"} 
                      className="w-8 h-8 rounded object-cover border border-white/10"
                    />
                  )}
                </div>
              )}

              {isMsgOutgoing && !(message.replyTo.isStatus || message.replyTo.messageId?.startsWith("status-")) && (
                <button
                  onClick={handleClearReplyContext}
                  className="absolute top-1 right-1 h-4.5 w-4.5 rounded-full bg-wa-modal border border-wa-border text-wa-muted hover:text-red-500 hover:bg-wa-hover opacity-0 group-hover/quote:opacity-100 transition-opacity flex items-center justify-center shadow-sm cursor-pointer z-20"
                  title={t("chat.remove_quote_preview") || "Remove quote preview"}
                >
                  <svg viewBox="0 0 24 24" width="10" height="10" className="fill-current">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {renderMediaContent()}

          {type !== "sticker" && (
            <div className="flex items-center justify-end gap-1 mt-0.5 float-right clear-both ml-3 -mb-0.5 select-none">
              <span className="text-[10px] sm:text-[11px] text-wa-muted font-sans inline-flex items-center">
                {message.editedAt && (
                  <span 
                    className="relative mr-1.5 text-[9px] italic opacity-85 cursor-help select-none font-semibold hover:underline text-wa-muted/95"
                    onMouseEnter={() => setShowHistoryTooltip(true)}
                    onMouseLeave={() => setShowHistoryTooltip(false)}
                  >
                    {t("chat.edited") || "edited"}
                    {showHistoryTooltip && message.editHistory && message.editHistory.length > 0 && (
                      <span className="absolute bottom-full right-0 mb-2.5 bg-wa-modal border border-wa-border p-2.5 rounded-lg shadow-2xl text-[10px] min-w-[180px] z-[99] text-left normal-case not-italic text-wa-text select-text pointer-events-auto leading-relaxed animate-scale-up">
                        <span className="font-semibold block border-b border-wa-border pb-1.5 mb-1.5 text-wa-primary text-[11px]">{t("chat.edit_history") || "Edit History"}</span>
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
          )}

          {/* Reaction bar inside bubble has been removed to avoid duplicate rows */}

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

          {/* Chevron Dropdown Trigger & Dropdown Menu */}
          {!isDeleted && (
            <div className={cn(
              "absolute top-1 right-1.5 z-20 select-none transition-opacity duration-150",
              dropdownConfig.isOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}>
              <button 
                onClick={handleOpenMenu}
                className={cn(
                  "p-0.5 rounded-full text-wa-muted hover:text-wa-text transition-colors cursor-pointer",
                  isMsgOutgoing ? "bg-wa-bubble-out/90 hover:bg-wa-bubble-out" : "bg-wa-bubble-in/90 hover:bg-wa-bubble-in",
                )}
              >
                <ChevronDown className="h-4 w-4" />
              </button>

              {/* Dropdown Menu (Rendered relative to Chevron container) */}
              <AnimatePresence>
                {dropdownConfig.isOpen && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: dropdownConfig.style.bottom ? 4 : -4 }} 
                    animate={{ opacity: 1, scale: 1, y: 0 }} 
                    exit={{ opacity: 0, scale: 0.95 }} 
                    transition={{ duration: 0.12 }} 
                    style={dropdownConfig.style} 
                    className="absolute bg-wa-modal border border-wa-border rounded-lg py-1 shadow-2xl z-50 min-w-[160px] text-xs overflow-hidden" 
                    onClick={(e) => e.stopPropagation()}
                  >
                    {status === "failed" && (
                      <button onClick={handleRetryResend} className="w-full text-left px-3 py-2 hover:bg-wa-hover text-wa-primary font-semibold transition-colors flex items-center gap-2">
                        <svg viewBox="0 0 24 24" width="14" height="14" className="stroke-wa-primary stroke-2 fill-none inline shrink-0">
                          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                        </svg>
                        <span>{t("chat.retry") || "Retry"}</span>
                      </button>
                    )}
                    <button onClick={handleReplyAction} className="w-full text-left px-3 py-2 hover:bg-wa-hover text-wa-text transition-colors flex items-center gap-2"><Reply className="h-3.5 w-3.5 text-wa-muted" /><span>{t("chat.reply") || "Reply"}</span></button>
                    <button onClick={handleOpenReactions} className="w-full text-left px-3 py-2 hover:bg-wa-hover text-wa-text transition-colors flex items-center gap-2"><Smile className="h-3.5 w-3.5 text-wa-muted" /><span>{t("chat.react") || "React"}</span></button>
                    <button onClick={handleForwardAction} className="w-full text-left px-3 py-2 hover:bg-wa-hover text-wa-text transition-colors flex items-center gap-2"><ArrowRight className="h-3.5 w-3.5 text-wa-muted" /><span>{t("chat.forward") || "Forward"}</span></button>
                    {canEdit && (
                      <button onClick={handleEditAction} className="w-full text-left px-3 py-2 hover:bg-wa-hover text-wa-text transition-colors flex items-center gap-2">
                        <svg viewBox="0 0 24 24" width="14" height="14" className="stroke-wa-muted stroke-2 fill-none inline shrink-0">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z" />
                        </svg>
                        <span>{t("chat.edit") || "Edit"}</span>
                      </button>
                    )}
                    {type === "sticker" && (
                      <button onClick={handleToggleFavoriteSticker} className="w-full text-left px-3 py-2 hover:bg-wa-hover text-wa-text transition-colors flex items-center gap-2">
                        <span className="text-sm shrink-0">⭐</span>
                        <span>{isFavoriteSticker() ? (t("chat.remove_favorite") || "Remove from Favorites") : (t("chat.add_favorite") || "Add to Favorites")}</span>
                      </button>
                    )}
                    <div className="border-t border-wa-border my-1" />
                    <button onClick={handleDeleteForMe} className="w-full text-left px-3 py-2 hover:bg-wa-hover text-wa-text transition-colors flex items-center gap-2"><Trash2 className="h-3.5 w-3.5 text-wa-muted" /><span>{t("chat.delete_for_me") || "Delete for me"}</span></button>
                    {isMsgOutgoing && isGroup && (
                      <button onClick={handleInfoAction} className="w-full text-left px-3 py-2 hover:bg-wa-hover text-wa-text transition-colors flex items-center gap-2">
                        <svg viewBox="0 0 24 24" width="14" height="14" className="stroke-wa-muted stroke-2 fill-none inline shrink-0">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                        <span>{t("chat.info") || "Message info"}</span>
                      </button>
                    )}
                    {canDeleteForEveryone && <button onClick={handleDeleteForEveryone} className="w-full text-left px-3 py-2 hover:bg-wa-hover text-red-500 transition-colors font-medium flex items-center gap-2"><Trash2 className="h-3.5 w-3.5 text-red-500" /><span>{t("chat.delete_for_everyone") || "Delete for everyone"}</span></button>}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Quick Reaction Button on Hover (Incoming) */}
        {!isMsgOutgoing && !isDeleted && (
          <div className={cn(
            "transition-opacity duration-150 relative shrink-0 select-none self-center",
            showReactionBar ? "opacity-100" : "opacity-0 group-hover/row:opacity-100"
          )}>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowReactionBar(prev => !prev);
              }}
              className="p-1 text-wa-muted hover:text-wa-text hover:bg-wa-hover rounded-full transition-colors cursor-pointer"
              title={t("chat.react_to_message") || "React to message"}
            >
              <Smile className="h-4.5 w-4.5" />
            </button>
            <AnimatePresence>
              {showReactionBar && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 10 }}
                  transition={{ duration: 0.1 }}
                  className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-wa-header border border-wa-border rounded-full px-2 py-1.5 flex items-center gap-2 shadow-2xl z-50"
                  onClick={(e) => e.stopPropagation()}
                >
                  {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
                    <button key={emoji} onClick={() => handleToggleReaction(emoji)} className="text-base sm:text-lg hover:scale-130 transition-transform cursor-pointer block leading-tight px-0.5">{emoji}</button>
                  ))}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowFullReactionPicker(true);
                    }} 
                    className="text-wa-primary hover:scale-130 transition-transform cursor-pointer block leading-tight px-1 font-bold text-sm sm:text-base hover:text-wa-primary-hover"
                  >
                    +
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
      {isInfoModalOpen && (
        <MessageInfoModal
          isOpen={isInfoModalOpen}
          onClose={() => setIsInfoModalOpen(false)}
          message={message}
          isGroup={isGroup}
          groupMembers={groupMembers}
        />
      )}
    </motion.div>
  );
}, (prevProps, nextProps) => {
  const msgA = prevProps.message;
  const msgB = nextProps.message;
  
  const basicMatch = msgA.id === msgB.id && 
         msgA.status === msgB.status &&
         msgA.text === msgB.text &&
         msgA.noPreview === msgB.noPreview &&
         msgA.editedAt === msgB.editedAt &&
         msgA.senderAvatar === msgB.senderAvatar &&
         msgA.senderName === msgB.senderName &&
         JSON.stringify(msgA.reactions) === JSON.stringify(msgB.reactions) &&
         JSON.stringify(msgA.receipts) === JSON.stringify(msgB.receipts) &&
         prevProps.isGroup === nextProps.isGroup &&
         prevProps.groupMembers?.length === nextProps.groupMembers?.length;

  if (!basicMatch) return false;

  // For image groups, compare nested messages list length and each nested message
  if (msgA.type === "image_group") {
    const listA = msgA.messages || [];
    const listB = msgB.messages || [];
    if (listA.length !== listB.length) return false;
    for (let i = 0; i < listA.length; i++) {
      if (listA[i].id !== listB[i].id || 
          listA[i].status !== listB[i].status || 
          listA[i].mediaUrl !== listB[i].mediaUrl ||
          listA[i].text !== listB[i].text) {
        return false;
      }
    }
  }

  return true;
});

const formatReceiptTime = (isoString) => {
  if (!isoString) return "—";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "—";
  
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
};

function MessageInfoModal({ isOpen, onClose, message, isGroup, groupMembers }) {
  const { t } = useTranslation();
  const [msgData, setMsgData] = useState(null);
  const [members, setMembers] = useState([]);

  useEffect(() => {
    if (!isOpen || !message?.id) return;

    // Fetch initial receipts
    const fetchInitialData = async () => {
      try {
        const { data, error } = await supabase
          .from("messages")
          .select("receipts, status, delivered_at, seen_at, created_at, text, type, media_url, file_name, sender_id")
          .eq("id", message.id)
          .single();
        if (error) throw error;
        setMsgData(data);
      } catch (err) {
        console.warn("Failed to fetch initial message info receipts:", err);
      }
    };
    fetchInitialData();

    // Resolve group members names and profiles
    if (isGroup) {
      if (groupMembers && groupMembers.length > 0) {
        setMembers(groupMembers);
      } else {
        // Fallback fetch if not passed
        import("../../services/chatService").then(({ chatService }) => {
          chatService.getGroupMembers(message.conversationId || message.conversation_id).then(setMembers).catch(console.error);
        });
      }
    }

    // Subscribe to changes
    const channel = supabase
      .channel(`msg-info-${message.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `id=eq.${message.id}`
        },
        (payload) => {
          setMsgData(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, message?.id, isGroup, groupMembers, message?.conversationId, message?.conversation_id]);

  if (!isOpen) return null;

  const currentMsg = msgData || message;
  const receipts = currentMsg.receipts || {};
  const deliveredList = receipts.delivered || {};
  const readList = receipts.read || {};
  const senderId = currentMsg.sender_id || currentMsg.senderId;

  // Render message preview
  const renderMsgPreview = () => {
    const previewMediaUrl = currentMsg.mediaUrl || currentMsg.media_url;
    
    return (
      <div className="bg-wa-bubble-out text-wa-text rounded-lg rounded-tr-none px-3 py-2 shadow-xs max-w-full text-left relative">
        <span className="absolute top-0 right-[-8px] w-0 h-0 border-solid border-t-[10px] border-r-[8px] border-t-wa-bubble-out border-r-transparent" />
        
        {(() => {
          switch (currentMsg.type) {
            case "image":
            case "image_group": {
              const isGroupedImage = currentMsg.type === "image_group";
              const imageList = isGroupedImage 
                ? (currentMsg.messages || []) 
                : [{ id: currentMsg.id, mediaUrl: previewMediaUrl, text: currentMsg.text }];
              return (
                <div className="relative rounded-md mb-1 max-w-[260px] select-none">
                  <div className={cn("grid gap-1", imageList.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
                    {imageList.map((img, idx) => (
                      <img 
                        key={img.id || idx} 
                        src={img.mediaUrl || img.media_url} 
                        alt="Preview" 
                        className="w-full h-24 object-cover rounded-md" 
                      />
                    ))}
                  </div>
                  {currentMsg.text && (
                    <p className="text-xs sm:text-sm mt-1.5 break-words whitespace-pre-wrap">{currentMsg.text}</p>
                  )}
                </div>
              );
            }
            case "video":
              return (
                <div className="relative rounded-md overflow-hidden mb-1 max-w-[260px]">
                  <video src={previewMediaUrl} controls controlsList="nodownload" className="w-full max-h-40 object-cover rounded bg-black" />
                  {currentMsg.text && (
                    <p className="text-xs sm:text-sm mt-1.5 break-words whitespace-pre-wrap">{currentMsg.text}</p>
                  )}
                </div>
              );
            case "sticker":
              return (
                <div className="relative w-24 h-24 flex items-center justify-center select-none bg-transparent">
                  <img src={previewMediaUrl} alt="Sticker" className="w-full h-full object-contain pointer-events-none" />
                </div>
              );
            case "gif":
              return (
                <div className="relative rounded-md overflow-hidden mb-1 max-w-[200px] bg-black/5 flex flex-col justify-center">
                  <img src={previewMediaUrl} alt="GIF" className="w-full max-h-40 object-cover rounded" />
                  <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-xs text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase">
                    GIF
                  </div>
                  {currentMsg.text && (
                    <p className="text-xs sm:text-sm mt-1.5 break-words whitespace-pre-wrap">{currentMsg.text}</p>
                  )}
                </div>
              );
            case "voice":
              return (
                <div className="flex items-center gap-2 py-1 min-w-[180px]">
                  <div className="p-2 rounded-full bg-wa-primary/10 text-wa-primary shrink-0">
                    <Mic className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="h-1.5 w-24 bg-wa-muted/30 rounded-full overflow-hidden">
                      <div className="h-full w-1/3 bg-wa-primary rounded-full" />
                    </div>
                    <span className="text-[10px] text-wa-muted mt-1 block">Voice Message</span>
                  </div>
                </div>
              );
            case "file":
              return (
                <div className="flex items-center gap-3 p-2 rounded bg-black/5 border border-wa-border max-w-xs">
                  <FileText className="h-5 w-5 text-wa-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-wa-text truncate">{currentMsg.file_name || currentMsg.fileName || currentMsg.text || "Document"}</p>
                  </div>
                </div>
              );
            case "live_location":
            case "location":
              return (
                <div className="flex items-center gap-2 p-2 rounded bg-black/5 border border-wa-border max-w-xs">
                  <MapPin className="h-5 w-5 text-wa-primary shrink-0" />
                  <span className="text-xs text-wa-text font-medium">
                    {currentMsg.type === "live_location" ? "Live Location" : "Location"}
                  </span>
                </div>
              );
            case "voice_call":
              return (
                <div className="flex items-center gap-2 p-2 rounded bg-black/5 max-w-xs">
                  <Phone className="h-5 w-5 text-wa-primary shrink-0" />
                  <span className="text-xs text-wa-text font-medium">Call</span>
                </div>
              );
            default:
              return (
                <div className="text-sm whitespace-pre-wrap break-words leading-relaxed max-w-md font-normal">
                  {currentMsg.text}
                </div>
              );
          }
        })()}
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("chat.message_info") || "Message info"} className="max-w-md">
      <div className="flex flex-col gap-6 py-2 select-none">
        {/* Message preview */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] text-wa-muted font-bold uppercase tracking-wider">{t("chat.message_preview") || "Message Preview"}</span>
          <div className="flex justify-end pr-2">{renderMsgPreview()}</div>
        </div>

        {/* Info detail list */}
        <div className="border-t border-wa-border pt-4 flex flex-col gap-5">
          {!isGroup ? (
            // One-to-One receipts
            <div className="flex flex-col gap-4">
              {/* Read receipt */}
              <div className="flex items-start gap-4 p-1">
                <CheckCheck className={cn("h-5 w-5 mt-0.5 shrink-0", currentMsg.status === "read" ? "text-[#53bdeb]" : "text-wa-muted")} />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-wa-text">{t("chat.read") || "Read"}</span>
                  <span className="text-xs text-wa-muted mt-0.5">
                    {formatReceiptTime(currentMsg.seen_at || readList[Object.keys(readList)[0]])}
                  </span>
                </div>
              </div>

              {/* Delivered receipt */}
              <div className="flex items-start gap-4 p-1">
                <CheckCheck className={cn("h-5 w-5 mt-0.5 shrink-0 text-wa-muted")} />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-wa-text">{t("chat.delivered") || "Delivered"}</span>
                  <span className="text-xs text-wa-muted mt-0.5">
                    {formatReceiptTime(currentMsg.delivered_at || deliveredList[Object.keys(deliveredList)[0]] || currentMsg.seen_at || readList[Object.keys(readList)[0]])}
                  </span>
                </div>
              </div>

              {/* Sent receipt */}
              <div className="flex items-start gap-4 p-1">
                <Check className="h-5 w-5 mt-0.5 shrink-0 text-wa-muted" />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-wa-text">{t("chat.sent") || "Sent"}</span>
                  <span className="text-xs text-wa-muted mt-0.5">
                    {formatReceiptTime(currentMsg.created_at || currentMsg.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            // Group Chat Receipts
            <div className="flex flex-col gap-6 max-h-[45vh] overflow-y-auto pr-1 custom-scrollbar">
              {/* Read By List */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-wa-muted font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCheck className="h-4 w-4 text-[#53bdeb]" />
                  {t("chat.read_by") || "Read by"}
                </span>
                <div className="flex flex-col gap-2.5 pl-5">
                  {members.filter(m => m.id !== senderId && readList[m.id]).length === 0 ? (
                    <span className="text-xs text-wa-muted italic font-medium">{t("chat.no_one_yet") || "No one yet"}</span>
                  ) : (
                    members.filter(m => m.id !== senderId && readList[m.id]).map(m => (
                      <div key={m.id} className="flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar src={m.avatar} fallback={m.name[0]} size="sm" uid={m.id} />
                          <span className="font-semibold text-wa-text truncate max-w-[150px]">{m.name}</span>
                        </div>
                        <span className="text-wa-muted shrink-0 font-medium">{formatReceiptTime(readList[m.id])}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Delivered To List */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-wa-muted font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCheck className="h-4 w-4 text-wa-muted" />
                  {t("chat.delivered_to") || "Delivered to"}
                </span>
                <div className="flex flex-col gap-2.5 pl-5">
                  {members.filter(m => m.id !== senderId && deliveredList[m.id] && !readList[m.id]).length === 0 ? (
                    <span className="text-xs text-wa-muted italic font-medium">{t("chat.no_one_yet") || "No one yet"}</span>
                  ) : (
                    members.filter(m => m.id !== senderId && deliveredList[m.id] && !readList[m.id]).map(m => (
                      <div key={m.id} className="flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar src={m.avatar} fallback={m.name[0]} size="sm" uid={m.id} />
                          <span className="font-semibold text-wa-text truncate max-w-[150px]">{m.name}</span>
                        </div>
                        <span className="text-wa-muted shrink-0 font-medium">{formatReceiptTime(deliveredList[m.id])}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Sent To List */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-wa-muted font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-wa-muted" />
                  {t("chat.sent_to") || "Sent to"}
                </span>
                <div className="flex flex-col gap-2.5 pl-5">
                  {members.filter(m => m.id !== senderId && !deliveredList[m.id] && !readList[m.id]).length === 0 ? (
                    <span className="text-xs text-wa-muted italic font-medium">{t("chat.everyone_received") || "Everyone received"}</span>
                  ) : (
                    members.filter(m => m.id !== senderId && !deliveredList[m.id] && !readList[m.id]).map(m => (
                      <div key={m.id} className="flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar src={m.avatar} fallback={m.name[0]} size="sm" uid={m.id} />
                          <span className="font-semibold text-wa-text truncate max-w-[150px]">{m.name}</span>
                        </div>
                        <span className="text-wa-muted/60 shrink-0 font-medium italic">{t("chat.pending") || "Pending..."}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
