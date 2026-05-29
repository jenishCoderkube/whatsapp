"use client";

import React, { useState } from "react";
import { Check, CheckCheck, Ban, Pin, ChevronDown, Clock } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Dropdown } from "../ui/Dropdown";
import { useAppDispatch, useAppSelector } from "../../hooks/useRedux";
import { setActiveChat, togglePinChat, toggleArchiveChat, removeChat } from "../../redux/slices/chatSlice";
import { setMobileScreen } from "../../redux/slices/uiSlice";
import { chatService } from "../../services/chatService";
import { cn } from "../../utils/cn";
import { formatSidebarDate } from "../../utils/dateUtils";

export const ChatCard = React.memo(({ chat }) => {
  const dispatch = useAppDispatch();
  const [menuOpen, setMenuOpen] = useState(false);
  const activeChatId = useAppSelector((state) => state.chat.activeChatId);
  const typingMap = useAppSelector((state) => state.chat.typingMap[chat.id] || {});
  const currentUser = useAppSelector((state) => state.auth.user);
  const currentUserId = currentUser?.id;
  const messagesList = useAppSelector((state) => state.message.messages[chat.id]);
  const draft = useAppSelector((state) => state.chat.drafts[chat.id]);

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

  const isDeleted = chat.lastMessage?.text === "This message was deleted" || 
                    (latestLoadedMsg && (latestLoadedMsg.type === "deleted" || latestLoadedMsg.text === "This message was deleted"));

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
    if (draft && (draft.text || (draft.files && draft.files.length > 0))) return null;
    if (isDeleted) return null;
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

    // Render Draft preview if exists
    if (draft && (draft.text || (draft.files && draft.files.length > 0))) {
      let previewText = draft.text || "";
      if (!previewText && draft.files && draft.files.length > 0) {
        const firstFile = draft.files[0];
        if (firstFile.type === "image") previewText = "📷 Photo";
        else if (firstFile.type === "video") previewText = "🎥 Video";
        else previewText = "📎 Document";
      }
      return (
        <span className="truncate">
          <span className="text-red-500 dark:text-red-400 font-normal mr-1">Draft:</span>
          <span className="text-wa-muted">{previewText}</span>
        </span>
      );
    }

    let baseText = chat.lastMessage?.text || (latestLoadedMsg ? latestLoadedMsg.text : "");
    const type = latestLoadedMsg ? latestLoadedMsg.type : "text";

    if (isDeleted) {
      return (
        <span className="italic text-wa-muted/70 inline-flex items-center gap-1">
          <Ban className="h-3.5 w-3.5 inline shrink-0" />
          This message was deleted
        </span>
      );
    }

    const isForwarded = chat.lastMessage?.isForwarded || latestLoadedMsg?.isForwarded;
    let displayString = baseText;

    // Dynamic type icon labeling support matching standard WhatsApp lists
    if (baseText === "📷 Photo" || type === "image") displayString = "📷 Photo";
    else if (baseText === "🎥 Video" || type === "video") displayString = "🎥 Video";
    else if (baseText === "📎 Document" || type === "file") displayString = "📎 Document";
    else if (baseText === "🎤 Voice Message" || type === "voice") displayString = "🎤 Voice Message";
    else if (type === "live_location" || baseText?.includes("live location")) displayString = "📍 Live Location";
    else if (type === "location" || baseText?.includes("Current Location")) displayString = "📍 Location";

    if (isForwarded && displayString && !displayString.startsWith("↪️")) {
      displayString = `↪️ ${displayString}`;
    }

    if (!displayString) return "No messages yet";

    // Format mentions in the preview text
    const mentionRegex = /@([^@\s\n]+(?:\s+[^@\s\n]+)?)/g;
    const parts = displayString.split(mentionRegex);
    if (parts.length === 1) return displayString;

    const currentUserName = currentUser?.name;
    return parts.map((part, i) => {
      if (i % 2 === 0) return part;
      const isMe = currentUserName && part.toLowerCase().includes(currentUserName.toLowerCase());
      return (
        <span key={i} className={cn("font-medium", isMe ? "text-wa-unread" : "text-wa-primary")}>
          @{part}
        </span>
      );
    });
  };

  const cardDropdownItems = [
    {
      label: chat.isPinned ? "Unpin chat" : "Pin chat",
      onClick: async (e) => {
        e.stopPropagation();
        await chatService.togglePinChat(chat.id, currentUserId, !chat.isPinned);
        dispatch(togglePinChat(chat.id));
      }
    },
    {
      label: chat.isArchived ? "Unarchive chat" : "Archive chat",
      onClick: async (e) => {
        e.stopPropagation();
        await chatService.toggleArchiveChat(chat.id, currentUserId, !chat.isArchived);
        dispatch(toggleArchiveChat(chat.id));
      }
    },
    {
      label: "Delete chat",
      danger: true,
      onClick: (e) => {
        e.stopPropagation();
        if (window.confirm("Are you sure you want to delete this chat?")) {
          dispatch(removeChat(chat.id));
        }
      }
    }
  ];

  return (
    <div
      onClick={handleClick}
      onMouseLeave={() => setMenuOpen(false)}
      className={cn(
        "flex items-center gap-3.5 pl-3.5 pr-4 py-3 cursor-pointer transition-colors relative select-none group",
        isActive ? "bg-wa-active" : "hover:bg-wa-hover"
      )}
    >
      <div className="relative shrink-0">
        <Avatar src={chat.avatar} fallback={chat.name[0]} isOnline={chat.online} size="lg" uid={chat.isGroup ? chat.id : chat.peerId} />
        {chat.disappearingDuration > 0 && (
          <div className="absolute -bottom-1 -right-1 bg-wa-sidebar rounded-full p-0.5 border border-wa-border shadow-xs" title="Disappearing messages active">
            <Clock className="h-3 w-3 text-[#00a884]" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 border-b border-wa-border pb-3 pt-1 group-last:border-none transition-colors">
        <div className="flex items-center justify-between mb-1">
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

        <div className="flex items-center justify-between relative">
          <p className="text-xs sm:text-sm text-wa-muted truncate flex-1 pr-8 leading-snug">
            {renderStatus()}
            {renderPreviewText()}
          </p>

          <div className="transition-opacity duration-150 group-hover:opacity-0 flex items-center gap-1.5 shrink-0 select-none ml-2 min-h-[20px]">
            {chat.isPinned && (
              <Pin className="h-3.5 w-3.5 text-wa-muted rotate-45 shrink-0" />
            )}
            {chat.unreadCount > 0 && (
              <span className="flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-wa-unread text-white text-[10px] font-semibold shrink-0">
                {chat.unreadCount}
              </span>
            )}
          </div>

          {/* Dynamic hover context dropdown trigger button */}
          <div className={cn(
            "transition-all duration-150 absolute right-0 top-1/2 -translate-y-1/2 z-20",
            menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}>
            <Dropdown
              isOpen={menuOpen}
              onOpenChange={setMenuOpen}
              trigger={
                <button 
                  className="p-1 rounded-full bg-wa-sidebar/95 hover:bg-wa-hover shadow-md border border-wa-border text-wa-muted hover:text-wa-text transition-colors flex items-center justify-center"
                  title="Menu"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              }
              triggerClassName="block"
              items={cardDropdownItems}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

ChatCard.displayName = "ChatCard";
