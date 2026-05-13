"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  CheckCheck,
  Play,
  FileText,
  Download,
  AlertCircle,
  Maximize2,
} from "lucide-react";
import { Modal } from "../ui/Modal";
import { useAppSelector } from "../../hooks/useRedux";
import { cn } from "../../utils/cn";

export function MessageBubble({ message }) {
  const {
    text,
    timestamp,
    status,
    type = "text",
    mediaUrl,
    fileName,
    fileSize,
    duration,
  } = message;

  const currentUser = useAppSelector((state) => state.auth.user);
  const currentUserId = currentUser?.id;

  // Accurately resolve string/UUID ownership parameters ensuring alignment parity survives refreshing/reconnection
  const normalizedSenderId = message.sender_id || message.senderId;
  const isMsgOutgoing =
    normalizedSenderId && currentUserId
      ? String(normalizedSenderId).toLowerCase() ===
        String(currentUserId).toLowerCase()
      : !!message.isOutgoing;

  const [imageModalOpen, setImageModalOpen] = useState(false);

  const renderStatusTicks = () => {
    if (!isMsgOutgoing) return null;
    if (status === "failed") {
      return (
        <span
          className="text-red-500 text-[10px] ml-1 font-medium inline-flex items-center gap-0.5"
          title="Network delivery error. Retry payload queue triggered."
        >
          <AlertCircle className="h-3 w-3 inline" /> Failed
        </span>
      );
    }
    if (status === "read") {
      return (
        <CheckCheck
          className="h-3.5 w-3.5 text-[#53bdeb] inline-block ml-1 shrink-0"
          title="Read"
        />
      );
    }
    if (status === "delivered") {
      return (
        <CheckCheck
          className="h-3.5 w-3.5 text-wa-muted inline-block ml-1 shrink-0"
          title="Delivered"
        />
      );
    }
    return (
      <Check
        className="h-3.5 w-3.5 text-wa-muted inline-block ml-1 shrink-0"
        title="Sent"
      />
    );
  };

  const handleDownload = (e) => {
    e.stopPropagation();
    if (mediaUrl) {
      window.open(mediaUrl, "_blank");
    }
  };

  const renderMediaContent = () => {
    switch (type) {
      case "image":
        return (
          <div className="relative rounded-md overflow-hidden mb-1 max-w-sm sm:max-w-md select-none">
            <div
              onClick={() => setImageModalOpen(true)}
              className="relative group cursor-pointer block overflow-hidden rounded bg-black/10"
            >
              <img
                src={
                  mediaUrl ||
                  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe"
                }
                alt="Attachment"
                className="w-full h-auto object-cover max-h-64 sm:max-h-80 transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Maximize2 className="h-6 w-6 text-white drop-shadow-md" />
              </div>
            </div>
            {text && (
              <p className="mt-1.5 text-xs sm:text-sm text-wa-text select-text whitespace-pre-wrap">
                {text}
              </p>
            )}

            {/* Native Fullscreen Image Lightbox Preview Modal */}
            <Modal
              isOpen={imageModalOpen}
              onClose={() => setImageModalOpen(false)}
              title={fileName || "Photo Preview"}
              className="max-w-4xl"
            >
              <div className="flex flex-col items-center justify-center p-2 bg-black/5 dark:bg-white/5 rounded-lg">
                <img
                  src={
                    mediaUrl ||
                    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe"
                  }
                  alt="Fullscreen view"
                  className="max-h-[70vh] max-w-full object-contain rounded"
                />
                <div className="flex items-center justify-between w-full mt-4 pt-3 border-t border-wa-border">
                  <span className="text-xs text-wa-muted truncate max-w-xs">
                    {fileName || "shared_image.png"}
                  </span>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-3 py-1.5 rounded bg-wa-primary text-white text-xs font-medium hover:bg-wa-primary-hover transition-colors"
                  >
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
            <video
              src={mediaUrl}
              controls
              controlsList="nodownload"
              className="w-full max-h-64 sm:max-h-80 object-cover rounded bg-black"
            />
            {text && (
              <p className="mt-1.5 text-xs sm:text-sm text-wa-text select-text whitespace-pre-wrap">
                {text}
              </p>
            )}
          </div>
        );

      case "voice":
        return (
          <div className="flex items-center gap-3 py-1 min-w-[200px] sm:min-w-[240px]">
            <button className="p-2 rounded-full bg-wa-primary text-white hover:opacity-90 shrink-0 transition-colors">
              <Play className="h-4 w-4 fill-white" />
            </button>
            <div className="flex-1">
              <div className="h-1.5 w-full bg-wa-border rounded-full overflow-hidden relative transition-colors">
                <div className="absolute left-0 top-0 bottom-0 w-1/3 bg-wa-primary rounded-full transition-colors" />
              </div>
              <div className="flex justify-between text-[10px] text-wa-muted mt-1">
                <span>{duration || "0:15"}</span>
                <span>Voice Note</span>
              </div>
            </div>
          </div>
        );

      case "file":
        return (
          <div
            onClick={handleDownload}
            className="flex items-center gap-3 p-2 rounded bg-wa-header hover:bg-wa-hover mb-1 cursor-pointer transition-colors group select-none border border-wa-border"
            title="Click to Download File"
          >
            <div className="flex items-center justify-center h-10 w-10 rounded bg-wa-active text-wa-muted shrink-0 group-hover:text-wa-primary transition-colors">
              <FileText className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-wa-text truncate select-text">
                {fileName || text}
              </p>
              <span className="text-[10px] text-wa-muted block truncate">
                {fileSize || "Attachment"} • Click to retrieve
              </span>
            </div>
            <button
              onClick={handleDownload}
              className="p-1.5 rounded hover:bg-wa-active text-wa-muted group-hover:text-wa-primary transition-colors"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        );

      default:
        return (
          <p className="text-sm sm:text-base text-wa-text leading-snug whitespace-pre-wrap break-words">
            {text}
          </p>
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className={cn(
        "flex w-full mb-1 sm:mb-2 px-2 sm:px-4 select-text",
        isMsgOutgoing ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "relative max-w-[85%] sm:max-w-[70%] rounded-lg px-2.5 sm:px-3 py-1.5 shadow-xs transition-colors duration-200",
          isMsgOutgoing
            ? "bg-wa-bubble-out text-wa-text rounded-tr-none"
            : "bg-wa-bubble-in text-wa-text rounded-tl-none",
        )}
      >
        {/* Tail graphic rendering */}
        <span
          className={cn(
            "absolute top-0 w-0 h-0 border-solid border-t-[10px] transition-colors duration-200",
            isMsgOutgoing
              ? "right-[-8px] border-r-[8px] border-t-wa-bubble-out border-r-transparent"
              : "left-[-8px] border-l-[8px] border-t-wa-bubble-in border-l-transparent",
          )}
        />

        {renderMediaContent()}

        {/* Timestamp metadata */}
        <div className="flex items-center justify-end gap-1 mt-0.5 float-right clear-both ml-3 -mb-0.5 select-none">
          <span className="text-[10px] sm:text-[11px] text-wa-muted font-sans">
            {timestamp}
          </span>
          {renderStatusTicks()}
        </div>
      </div>
    </motion.div>
  );
}
