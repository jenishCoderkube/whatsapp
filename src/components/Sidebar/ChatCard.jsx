"use client";

import React from "react";
import { Check, CheckCheck } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { useAppDispatch, useAppSelector } from "../../hooks/useRedux";
import { setActiveChat } from "../../redux/slices/chatSlice";
import { setMobileScreen } from "../../redux/slices/uiSlice";
import { cn } from "../../utils/cn";

export function ChatCard({ chat }) {
  const dispatch = useAppDispatch();
  const activeChatId = useAppSelector((state) => state.chat.activeChatId);
  const isActive = activeChatId === chat.id;

  const handleClick = () => {
    dispatch(setActiveChat(chat.id));
    dispatch(setMobileScreen("chat"));
  };

  const renderStatus = () => {
    if (!chat.lastMessage?.isOutgoing) return null;
    if (chat.lastMessage.status === "read") {
      return <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb] inline mr-1" />;
    }
    return <CheckCheck className="h-3.5 w-3.5 text-wa-muted inline mr-1" />;
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        "flex items-center gap-3 pl-3 pr-4 py-2.5 cursor-pointer transition-colors relative select-none group",
        isActive ? "bg-wa-active" : "hover:bg-wa-hover"
      )}
    >
      <Avatar src={chat.avatar} fallback={chat.name[0]} isOnline={chat.online} size="md" />

      <div className="flex-1 min-w-0 border-b border-wa-border pb-2.5 pt-0.5 group-last:border-none transition-colors">
        <div className="flex items-center justify-between mb-0.5">
          <span className="font-medium text-sm sm:text-base text-wa-text truncate">
            {chat.name}
          </span>
          <span
            className={cn(
              "text-xs shrink-0 ml-2",
              chat.unreadCount > 0 ? "text-wa-unread font-medium" : "text-wa-muted"
            )}
          >
            {chat.lastMessage?.timestamp}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs sm:text-sm text-wa-muted truncate flex-1 pr-1">
            {renderStatus()}
            {chat.lastMessage?.text || "No messages yet"}
          </p>

          {chat.unreadCount > 0 && (
            <span className="flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-wa-unread text-white text-[11px] font-medium shrink-0">
              {chat.unreadCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
