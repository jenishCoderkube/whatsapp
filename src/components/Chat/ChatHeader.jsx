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

  const activeChat = chats.find((c) => c.id === activeChatId);
  const [infoModal, setInfoModal] = useState(false);

  if (!activeChat) return null;

  const headerOptions = [
    { label: "Contact Info", onClick: () => setInfoModal(true) },
    { label: "Select Messages", onClick: () => {} },
    { label: "Close Chat", onClick: () => dispatch(setMobileScreen("list")) },
    { label: "Clear messages", danger: true, onClick: () => {} },
  ];

  return (
    <header className="flex items-center justify-between px-4 py-2 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-[#e9edef] dark:border-[#222d34] select-none z-10 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        {/* Back navigation support on mobile viewports */}
        <button
          onClick={() => {
            dispatch(setMobileScreen("list"));
            dispatch(clearUnread(activeChat.id));
          }}
          className="md:hidden block p-1 -ml-1 rounded-full text-[#54656f] dark:text-[#aebac1] hover:bg-[#e4e7eb] dark:hover:bg-[#2a3942]"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div onClick={() => setInfoModal(true)} className="cursor-pointer shrink-0">
          <Avatar src={activeChat.avatar} fallback={activeChat.name[0]} isOnline={activeChat.online} size="md" />
        </div>

        <div onClick={() => setInfoModal(true)} className="flex-1 min-w-0 cursor-pointer">
          <h2 className="text-sm sm:text-base font-medium text-[#111b21] dark:text-[#e9edef] truncate">
            {activeChat.name}
          </h2>
          <p className="text-xs text-[#667781] dark:text-[#8696a0] truncate">
            {activeChat.online ? "click here for contact info" : activeChat.phoneNumber}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 text-[#54656f] dark:text-[#aebac1]">
        <button className="p-2 rounded-full hover:bg-[#e4e7eb] dark:hover:bg-[#2a3942] transition-colors hidden sm:inline-flex" title="Voice Call Placeholder">
          <Phone className="h-4 w-4" />
        </button>

        <button className="p-2 rounded-full hover:bg-[#e4e7eb] dark:hover:bg-[#2a3942] transition-colors hidden sm:inline-flex" title="Video Call Placeholder">
          <Video className="h-4 w-4" />
        </button>

        <button className="p-2 rounded-full hover:bg-[#e4e7eb] dark:hover:bg-[#2a3942] transition-colors" title="Search Messages">
          <Search className="h-4 w-4" />
        </button>

        <Dropdown
          trigger={
            <button className="p-2 rounded-full hover:bg-[#e4e7eb] dark:hover:bg-[#2a3942] transition-colors">
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
          <h3 className="text-lg font-semibold text-[#111b21] dark:text-[#e9edef]">{activeChat.name}</h3>
          <p className="text-xs text-[#00a884] font-medium mt-1">{activeChat.online ? "Online" : "Offline"}</p>
          
          <div className="w-full mt-6 pt-4 border-t border-[#e9edef] dark:border-[#222d34] flex flex-col gap-2 text-left">
            <span className="text-xs text-[#667781] dark:text-[#8696a0]">Phone Number / Details</span>
            <span className="text-sm font-medium text-[#111b21] dark:text-[#e9edef]">{activeChat.phoneNumber}</span>
          </div>

          <div className="w-full mt-4 pt-4 border-t border-[#e9edef] dark:border-[#222d34] flex flex-col gap-2 text-left">
            <span className="text-xs text-[#667781] dark:text-[#8696a0]">Encryption</span>
            <span className="text-xs text-[#111b21] dark:text-[#e9edef]">
              Messages and calls are end-to-end encrypted. No one outside of this chat can read or listen to them.
            </span>
          </div>
        </div>
      </Modal>
    </header>
  );
}
