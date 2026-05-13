"use client";

import React, { useState } from "react";
import { Search, MoreVertical, ArrowLeft, Video, Phone } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Dropdown } from "../ui/Dropdown";
import { Modal } from "../ui/Modal";
import { useAppDispatch, useAppSelector } from "../../hooks/useRedux";
import { setMobileScreen } from "../../redux/slices/uiSlice";
import { clearUnread } from "../../redux/slices/chatSlice";

export function ChatHeader() {
  const dispatch = useAppDispatch();
  const chats = useAppSelector((state) => state.chat.chats);
  const activeChatId = useAppSelector((state) => state.chat.activeChatId);
  const typingMap = useAppSelector((state) => state.chat.typingMap[activeChatId] || {});
  const currentUserId = useAppSelector((state) => state.auth.user?.id);

  const activeChat = chats.find((c) => c.id === activeChatId);
  const [infoModal, setInfoModal] = useState(false);

  if (!activeChat) return null;

  // Check if any remote peer is dynamically typing inside this view channel
  const isPeerTyping = Object.keys(typingMap).some((uid) => uid !== currentUserId);

  const formatLastSeen = (timestamp) => {
    if (!timestamp) return activeChat.phoneNumber;
    const date = new Date(timestamp);
    const now = new Date();

    const isToday = date.toDateString() === now.toDateString();

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    if (isToday) {
      return `last seen today at ${timeStr}`;
    } else if (isYesterday) {
      return `last seen yesterday at ${timeStr}`;
    } else {
      const dateStr = date.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
      return `last seen ${dateStr} at ${timeStr}`;
    }
  };

  const renderSubtitle = () => {
    if (activeChat.isGroup) return activeChat.phoneNumber;
    if (activeChat.online) return "Online";
    if (activeChat.lastSeen) return formatLastSeen(activeChat.lastSeen);
    return activeChat.phoneNumber;
  };

  const headerOptions = [
    { label: "Contact Info", onClick: () => setInfoModal(true) },
    { label: "Select Messages", onClick: () => {} },
    { label: "Close Chat", onClick: () => dispatch(setMobileScreen("list")) },
    { label: "Clear messages", danger: true, onClick: () => {} },
  ];

  return (
    <header className="flex items-center justify-between px-4 py-2 bg-wa-header border-b border-wa-border select-none z-10 shrink-0 transition-colors duration-200">
      <div className="flex items-center gap-3 min-w-0">
        {/* Back navigation support on mobile viewports */}
        <button
          onClick={() => {
            dispatch(setMobileScreen("list"));
            dispatch(clearUnread(activeChat.id));
          }}
          className="md:hidden block p-1 -ml-1 rounded-full text-wa-muted hover:bg-wa-active transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div onClick={() => setInfoModal(true)} className="cursor-pointer shrink-0">
          <Avatar src={activeChat.avatar} fallback={activeChat.name[0]} isOnline={activeChat.online} size="md" />
        </div>

        <div onClick={() => setInfoModal(true)} className="flex-1 min-w-0 cursor-pointer">
          <h2 className="text-sm sm:text-base font-medium text-wa-text truncate">
            {activeChat.name}
          </h2>
          {isPeerTyping ? (
            <p className="text-xs text-wa-primary font-medium italic animate-pulse truncate">
              Typing...
            </p>
          ) : (
            <p className="text-xs text-wa-muted truncate capitalize-first">
              {renderSubtitle()}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 text-wa-muted">
        <button className="p-2 rounded-full hover:bg-wa-active transition-colors hidden sm:inline-flex" title="Voice Call Placeholder">
          <Phone className="h-4 w-4" />
        </button>

        <button className="p-2 rounded-full hover:bg-wa-active transition-colors hidden sm:inline-flex" title="Video Call Placeholder">
          <Video className="h-4 w-4" />
        </button>

        <button className="p-2 rounded-full hover:bg-wa-active transition-colors" title="Search Messages">
          <Search className="h-4 w-4" />
        </button>

        <Dropdown
          trigger={
            <button className="p-2 rounded-full hover:bg-wa-active transition-colors">
              <MoreVertical className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          }
          items={headerOptions}
        />
      </div>

      {/* Contact modal view */}
      <Modal isOpen={infoModal} onClose={() => setInfoModal(false)} title="Contact info">
        <div className="flex flex-col items-center py-4 text-center">
          <Avatar src={activeChat.avatar} fallback={activeChat.name[0]} size="xxl" className="mb-4 shadow-md" />
          <h3 className="text-lg font-semibold text-wa-text">{activeChat.name}</h3>
          <p className="text-xs text-wa-primary font-medium mt-1 capitalize-first">{renderSubtitle()}</p>
          
          <div className="w-full mt-6 pt-4 border-t border-wa-border flex flex-col gap-2 text-left">
            <span className="text-xs text-wa-muted">Phone Number / Details</span>
            <span className="text-sm font-medium text-wa-text">{activeChat.phoneNumber}</span>
          </div>

          <div className="w-full mt-4 pt-4 border-t border-wa-border flex flex-col gap-2 text-left">
            <span className="text-xs text-wa-muted">Encryption</span>
            <span className="text-xs text-wa-text">
              Messages and calls are end-to-end encrypted. No one outside of this chat can read or listen to them.
            </span>
          </div>
        </div>
      </Modal>
    </header>
  );
}
