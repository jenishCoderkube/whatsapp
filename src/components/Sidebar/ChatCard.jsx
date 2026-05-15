"use client";

import React from "react";
import { Check, CheckCheck } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { useAppDispatch, useAppSelector } from "../../hooks/useRedux";
import { setActiveChat } from "../../redux/slices/chatSlice";
import { setMobileScreen } from "../../redux/slices/uiSlice";
import { cn } from "../../utils/cn";
import { formatSidebarDate } from "../../utils/dateUtils";

export const ChatCard = React.memo(({ chat }) => {
  const dispatch = useAppDispatch();
  const activeChatId = useAppSelector((state) => state.chat.activeChatId);
  const typingMap = useAppSelector((state) => state.chat.typingMap[chat.id] || {});
  const currentUserId = useAppSelector((state) => state.auth.user?.id);
  const messagesList = useAppSelector((state) => state.message.messages[chat.id]);

  // Natively access the LAST element in the chronological array to guarantee the absolute latest message preview displays
  const latestLoadedMsg = messagesList && messagesList.length > 0 
    ? messagesList[messagesList.length - 1] 
    : null;

  const isActive = activeChatId === chat.id;

  // Evaluate if any peer apart from myself is typing
  const isPeerTyping = Object.keys(typingMap).some((uid) => uid !== currentUserId);

  const handleClick = () => {
    dispatch(setActiveChat(chat.id));
    dispatch(setMobileScreen("chat"));
  };

  // Prioritize the designated "Last Message" preview data from the chat object itself, 
  // as it is updated first during realtime events to ensure the sidebar feels instant.
  const isOutgoing = chat.lastMessage?.isOutgoing !== undefined
    ? chat.lastMessage.isOutgoing
    : latestLoadedMsg
    ? (latestLoadedMsg.sender_id || latestLoadedMsg.senderId) === currentUserId
    : false;

  const status = chat.lastMessage?.status || (latestLoadedMsg ? latestLoadedMsg.status : "sent");
 
  const createdAt = chat.lastMessage?.timestamp || latestLoadedMsg?.createdAt || chat.updatedAt;
  const displayTimestamp = formatSidebarDate(createdAt || chat.lastMessage?.timestamp);

  const renderStatus = () => {
    if (isPeerTyping) return null;
    if (!isOutgoing) return null;
    if (status === "read") {
      return <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb] inline mr-1 shrink-0" />;
    }
    if (status === "delivered") {
      return <CheckCheck className="h-3.5 w-3.5 text-wa-muted inline mr-1 shrink-0" />;
    }
    return <Check className="h-3.5 w-3.5 text-wa-muted inline mr-1 shrink-0" />;
  };

  const renderPreviewText = () => {
    if (isPeerTyping) {
      return <span className="text-wa-primary font-medium italic animate-pulse">Typing...</span>;
    }

    const baseText = chat.lastMessage?.text || (latestLoadedMsg ? latestLoadedMsg.text : "");
    const type = latestLoadedMsg ? latestLoadedMsg.type : "text";

    // Dynamic type icon labeling support matching standard WhatsApp lists
    if (baseText === "📷 Photo" || type === "image") return "📷 Photo";
    if (baseText === "🎥 Video" || type === "video") return "🎥 Video";
    if (baseText === "📎 Document" || type === "file") return "📎 Document";
    if (baseText === "🎤 Voice Message" || type === "voice") return "🎤 Voice Message";
    return baseText || "No messages yet";
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
            {displayTimestamp}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs sm:text-sm text-wa-muted truncate flex-1 pr-1">
            {renderStatus()}
            {renderPreviewText()}
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
});

ChatCard.displayName = "ChatCard";
