"use client";

import React, { useState } from "react";
import { Search, ArrowLeft, Filter } from "lucide-react";
import { useAppDispatch, useAppSelector } from "../../hooks/useRedux";
import { setSearchQuery } from "../../redux/slices/chatSlice";
import { cn } from "../../utils/cn";

export function SearchBar() {
  const dispatch = useAppDispatch();
  const searchQuery = useAppSelector((state) => state.chat.searchQuery);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-wa-sidebar border-b border-wa-border select-none transition-colors duration-200">
      <div className="relative flex-1 flex items-center bg-wa-header rounded-lg transition-all overflow-hidden">
        <button
          className={cn(
            "absolute left-3 transition-all duration-200 text-wa-muted",
            isFocused ? "rotate-0 text-wa-primary" : "rotate-90 scale-0 opacity-0 pointer-events-none"
          )}
          onClick={() => {
            dispatch(setSearchQuery(""));
            setIsFocused(false);
          }}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <span
          className={cn(
            "absolute left-3 transition-all duration-200 text-wa-muted",
            isFocused ? "-rotate-90 scale-0 opacity-0" : "rotate-0 opacity-100"
          )}
        >
          <Search className="h-4 w-4" />
        </span>

        <input
          type="text"
          placeholder="Search or start new chat"
          value={searchQuery}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            if (!searchQuery) setIsFocused(false);
          }}
          onChange={(e) => dispatch(setSearchQuery(e.target.value))}
          className="w-full bg-transparent py-1.5 pl-10 pr-3 text-xs md:text-sm text-wa-text placeholder:text-wa-muted focus:outline-none"
        />
      </div>

      <button className="p-1 rounded-full text-wa-muted hover:bg-wa-active transition-colors" title="Unread chats filter">
        <Filter className="h-4 w-4" />
      </button>
    </div>
  );
}
