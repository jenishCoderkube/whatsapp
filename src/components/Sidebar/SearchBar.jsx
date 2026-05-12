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
    <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-[#111b21] border-b border-[#e9edef] dark:border-[#222d34] select-none">
      <div className="relative flex-1 flex items-center bg-[#f0f2f5] dark:bg-[#202c33] rounded-lg transition-all overflow-hidden">
        <button
          className={cn(
            "absolute left-3 transition-all duration-200 text-[#54656f] dark:text-[#aebac1]",
            isFocused ? "rotate-0 text-[#00a884]" : "rotate-90 scale-0 opacity-0 pointer-events-none"
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
            "absolute left-3 transition-all duration-200 text-[#54656f] dark:text-[#aebac1]",
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
          className="w-full bg-transparent py-1.5 pl-10 pr-3 text-xs md:text-sm text-[#111b21] dark:text-[#e9edef] placeholder:text-[#667781] dark:placeholder:text-[#8696a0] focus:outline-none"
        />
      </div>

      <button className="p-1 rounded-full text-[#54656f] dark:text-[#aebac1] hover:bg-[#f0f2f5] dark:hover:bg-[#202c33] transition-colors" title="Unread chats filter">
        <Filter className="h-4 w-4" />
      </button>
    </div>
  );
}
