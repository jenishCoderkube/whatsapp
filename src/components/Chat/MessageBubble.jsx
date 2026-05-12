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
    if (status === "delivered") {
      return <CheckCheck className="h-3.5 w-3.5 text-[#667781] dark:text-[#8696a0] inline-block ml-1 shrink-0" />;
    }
    return <Check className="h-3.5 w-3.5 text-[#667781] dark:text-[#8696a0] inline-block ml-1 shrink-0" />;
  };

  const renderMediaContent = () => {
    switch (type) {
      case "image":
        return (
          <div className="relative rounded-md overflow-hidden mb-1 max-w-sm">
            <img src={mediaUrl || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe"} alt="Attachment" className="w-full h-auto object-cover max-h-60" />
            {text && <p className="mt-1.5 text-sm">{text}</p>}
          </div>
        );

      case "voice":
        return (
          <div className="flex items-center gap-3 py-1 min-w-[200px] sm:min-w-[240px]">
            <button className="p-2 rounded-full bg-[#00a884] text-white hover:opacity-90 shrink-0">
              <Play className="h-4 w-4 fill-white" />
            </button>
            <div className="flex-1">
              <div className="h-1.5 w-full bg-[#d1d7db] dark:bg-[#2a3942] rounded-full overflow-hidden relative">
                <div className="absolute left-0 top-0 bottom-0 w-1/3 bg-[#00a884] rounded-full" />
              </div>
              <div className="flex justify-between text-[10px] text-[#667781] dark:text-[#8696a0] mt-1">
                <span>{duration || "0:15"}</span>
                <span>Voice Note</span>
              </div>
            </div>
          </div>
        );

      case "file":
        return (
          <div className="flex items-center gap-3 p-2 rounded bg-black/5 dark:bg-white/5 mb-1">
            <FileText className="h-8 w-8 text-[#54656f] dark:text-[#aebac1] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium truncate">{fileName || text}</p>
              <span className="text-[10px] text-[#667781] dark:text-[#8696a0]">{fileSize || "1.2 MB"} • Document</span>
            </div>
            <button className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-[#54656f] dark:text-[#aebac1]">
              <Download className="h-4 w-4" />
            </button>
          </div>
        );

      default:
        return <p className="text-sm sm:text-base leading-snug whitespace-pre-wrap break-words">{text}</p>;
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
          "relative max-w-[85%] sm:max-w-[70%] rounded-lg px-2.5 sm:px-3 py-1.5 shadow-xs transition-all",
          isOutgoing
            ? "bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-[#e9edef] rounded-tr-none"
            : "bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] rounded-tl-none"
        )}
      >
        {/* Tail graphic rendering */}
        <span
          className={cn(
            "absolute top-0 w-0 h-0 border-solid border-t-[10px]",
            isOutgoing
              ? "right-[-8px] border-r-[8px] border-t-[#d9fdd3] dark:border-t-[#005c4b] border-r-transparent"
              : "left-[-8px] border-l-[8px] border-t-white dark:border-t-[#202c33] border-l-transparent"
          )}
        />

        {renderMediaContent()}

        {/* Timestamp metadata */}
        <div className="flex items-center justify-end gap-1 mt-0.5 float-right clear-both ml-3 -mb-0.5 select-none">
          <span className="text-[10px] sm:text-[11px] text-[#667781] dark:text-[#8696a0] font-sans">
            {timestamp}
          </span>
          {renderStatusTicks()}
        </div>
      </div>
    </motion.div>
  );
}
