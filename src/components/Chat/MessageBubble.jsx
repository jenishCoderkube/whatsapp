"use client";

import React from "react";
import { motion } from "framer-motion";
import { Check, CheckCheck, Play, FileText, Download } from "lucide-react";
import { cn } from "../../utils/cn";

export function MessageBubble({ message }) {
  const { isOutgoing, text, timestamp, status, type = "text", mediaUrl, fileName, fileSize, duration } = message;

  const renderStatusTicks = () => {
    if (!isOutgoing) return null;
    if (status === "read") {
      return <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb] inline-block ml-1 shrink-0" />;
    }
    return <CheckCheck className="h-3.5 w-3.5 text-wa-muted inline-block ml-1 shrink-0" />;
  };

  const renderMediaContent = () => {
    switch (type) {
      case "image":
        return (
          <div className="relative rounded-md overflow-hidden mb-1 max-w-sm">
            <img src={mediaUrl || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe"} alt="Attachment" className="w-full h-auto object-cover max-h-60" />
            {text && <p className="mt-1.5 text-sm text-wa-text">{text}</p>}
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
          <div className="flex items-center gap-3 p-2 rounded bg-wa-header mb-1 transition-colors">
            <FileText className="h-8 w-8 text-wa-muted shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-wa-text truncate">{fileName || text}</p>
              <span className="text-[10px] text-wa-muted">{fileSize || "1.2 MB"} • Document</span>
            </div>
            <button className="p-1 rounded hover:bg-wa-hover text-wa-muted transition-colors">
              <Download className="h-4 w-4" />
            </button>
          </div>
        );

      default:
        return <p className="text-sm sm:text-base text-wa-text leading-snug whitespace-pre-wrap break-words">{text}</p>;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className={cn("flex w-full mb-1 sm:mb-2 px-2 sm:px-4 select-text", isOutgoing ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "relative max-w-[85%] sm:max-w-[70%] rounded-lg px-2.5 sm:px-3 py-1.5 shadow-xs transition-colors duration-200",
          isOutgoing
            ? "bg-wa-bubble-out text-wa-text rounded-tr-none"
            : "bg-wa-bubble-in text-wa-text rounded-tl-none"
        )}
      >
        {/* Tail graphic rendering */}
        <span
          className={cn(
            "absolute top-0 w-0 h-0 border-solid border-t-[10px] transition-colors duration-200",
            isOutgoing
              ? "right-[-8px] border-r-[8px] border-t-wa-bubble-out border-r-transparent"
              : "left-[-8px] border-l-[8px] border-t-wa-bubble-in border-l-transparent"
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
