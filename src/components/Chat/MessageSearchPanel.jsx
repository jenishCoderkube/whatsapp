"use client";

import React, { useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { useAppDispatch } from "../../hooks/useRedux";
import { setActiveSearchPanelOpen } from "../../redux/slices/uiSlice";
import { formatMessageTime } from "../../utils/dateUtils";
import { messageService } from "../../services/messageService";
import { cn } from "../../utils/cn";

export function MessageSearchPanel({ chat, onJumpToMessage }) {
  const dispatch = useAppDispatch();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Debounced database search query
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const delayDebounce = setTimeout(async () => {
      try {
        const dbResults = await messageService.searchConversationMessages(chat.id, trimmed);
        setSearchResults(dbResults);
      } catch (err) {
        console.warn("Error searching messages:", err);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, chat.id]);

  const handleResultClick = (msgId) => {
    if (typeof onJumpToMessage === "function") {
      onJumpToMessage(msgId);
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
        {isSearching ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center select-none gap-3">
            <div className="animate-spin text-wa-primary">
              <svg className="h-7 w-7 text-wa-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <span className="text-xs text-wa-muted animate-pulse">Searching conversation...</span>
          </div>
        ) : !searchQuery.trim() ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center text-wa-muted select-none">
            <Search className="h-10 w-10 text-wa-border mb-3" />
            <span className="text-xs sm:text-sm font-medium">Search for messages in this chat.</span>
          </div>
        ) : searchResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center text-wa-muted select-none">
            <span className="text-xs sm:text-sm font-medium">No messages found</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1 px-2">
            <span className="text-[10px] sm:text-[11px] text-wa-muted px-2 py-1 uppercase font-bold tracking-wider">
              {searchResults.length} message{searchResults.length > 1 ? "s" : ""} found
            </span>
            {searchResults.map((msg) => {
              const displayTime = msg.createdAt ? formatMessageTime(msg.createdAt) : "";
              return (
                <div
                  key={msg.id}
                  onClick={() => handleResultClick(msg.id)}
                  className="flex flex-col gap-1 p-2.5 rounded-lg hover:bg-wa-hover cursor-pointer transition-colors border border-transparent hover:border-wa-border/50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-wa-primary">
                      {msg.senderName || "Member"}
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
