"use client";

import React, { useState, useMemo } from "react";
import { Search, X, Calendar } from "lucide-react";
import { useAppDispatch } from "../../hooks/useRedux";
import { setActiveSearchPanelOpen } from "../../redux/slices/uiSlice";
import { Avatar } from "../ui/Avatar";
import { formatMessageTime } from "../../utils/dateUtils";
import { cn } from "../../utils/cn";

export function MessageSearchPanel({ chat, messages }) {
  const dispatch = useAppDispatch();
  const [searchQuery, setSearchQuery] = useState("");

  // Only filter out text messages that are not deleted
  const filteredMessages = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return [];

    return messages.filter((msg) => {
      if (msg.type !== "text" || !msg.text) return false;
      const isDeleted = msg.type === "deleted" || msg.text === "This message was deleted";
      if (isDeleted) return false;

      return msg.text.toLowerCase().includes(query);
    });
  }, [messages, searchQuery]);

  const handleResultClick = (msgId) => {
    const targetElement = document.getElementById(`msg-${msgId}`);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
      
      // WhatsApp style visual flash highlight
      targetElement.classList.add("bg-wa-primary/25", "scale-102");
      setTimeout(() => {
        targetElement.classList.remove("bg-wa-primary/25", "scale-102");
      }, 1500);
    }
  };

  // Text highlight helper
  const highlightText = (text, query) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, "gi"));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-yellow-200 dark:bg-yellow-500/40 text-wa-text rounded-sm px-0.5 font-semibold">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  return (
    <div className="w-full md:w-[350px] shrink-0 border-l border-wa-border bg-wa-sidebar h-full flex flex-col z-35 animate-slide-in-right transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 bg-wa-header border-b border-wa-border select-none shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => dispatch(setActiveSearchPanelOpen(false))}
            className="p-1.5 rounded-full hover:bg-wa-hover text-wa-muted hover:text-wa-text transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          <span className="text-sm sm:text-base font-semibold text-wa-text">Search messages</span>
        </div>
      </div>

      {/* Search Input Container */}
      <div className="p-3 border-b border-wa-border bg-wa-sidebar shrink-0">
        <div className="bg-wa-input border border-wa-border rounded-lg flex items-center px-3 py-1.5 gap-2.5 transition-colors focus-within:border-wa-primary focus-within:bg-wa-sidebar">
          <Search className="h-4.5 w-4.5 text-wa-muted shrink-0" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none text-xs sm:text-sm text-wa-text focus:outline-none w-full placeholder:text-wa-muted"
            autoFocus
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery("")} 
              className="text-wa-muted hover:text-wa-text shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Results panel */}
      <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
        {!searchQuery.trim() ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center text-wa-muted select-none">
            <Search className="h-10 w-10 text-wa-border mb-3" />
            <span className="text-xs sm:text-sm font-medium">Search for messages in this chat.</span>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center text-wa-muted select-none">
            <span className="text-xs sm:text-sm font-medium">No messages found</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1 px-2">
            <span className="text-[10px] sm:text-[11px] text-wa-muted px-2 py-1 uppercase font-bold tracking-wider">
              {filteredMessages.length} message{filteredMessages.length > 1 ? "s" : ""} found
            </span>
            {filteredMessages.map((msg) => {
              const displayTime = msg.createdAt ? formatMessageTime(msg.createdAt) : msg.timestamp;
              return (
                <div
                  key={msg.id}
                  onClick={() => handleResultClick(msg.id)}
                  className="flex flex-col gap-1 p-2.5 rounded-lg hover:bg-wa-hover cursor-pointer transition-colors border border-transparent hover:border-wa-border/50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-wa-primary">
                      {msg.senderName || (msg.isOutgoing ? "You" : "Peer")}
                    </span>
                    <span className="text-[10px] text-wa-muted">{displayTime}</span>
                  </div>
                  <p className="text-xs sm:text-sm text-wa-text line-clamp-2 select-text leading-snug break-words">
                    {highlightText(msg.text, searchQuery)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
