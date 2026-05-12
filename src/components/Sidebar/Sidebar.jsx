"use client";

import React, { useState } from "react";
import { MessageSquarePlus, MoreVertical, Sun, Moon, LogOut, User } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Dropdown } from "../ui/Dropdown";
import { Modal } from "../ui/Modal";
import { SearchBar } from "./SearchBar";
import { ChatCard } from "./ChatCard";
import { useAppDispatch, useAppSelector } from "../../hooks/useRedux";
import { logout } from "../../redux/slices/authSlice";
import { toggleTheme } from "../../redux/slices/uiSlice";
import { cn } from "../../utils/cn";

export function Sidebar({ className }) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const chats = useAppSelector((state) => state.chat.chats);
  const searchQuery = useAppSelector((state) => state.chat.searchQuery);
  const theme = useAppSelector((state) => state.ui.theme);
  
  const [profileModal, setProfileModal] = useState(false);

  const filteredChats = chats.filter((chat) =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const dropdownItems = [
    {
      label: "Profile Info",
      onClick: () => setProfileModal(true),
    },
    {
      label: theme === "light" ? "Dark Theme" : "Light Theme",
      onClick: () => dispatch(toggleTheme()),
    },
    {
      label: "Logout",
      danger: true,
      onClick: () => dispatch(logout()),
    },
  ];

  return (
    <aside className={cn("flex flex-col h-full bg-white dark:bg-[#111b21] border-r border-[#e9edef] dark:border-[#222d34] select-none", className)}>
      {/* Top native header strip */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-[#f0f2f5] dark:bg-[#202c33]">
        <div onClick={() => setProfileModal(true)} className="cursor-pointer" title="View Profile">
          <Avatar src={user?.avatar} fallback={user?.name?.[0] || "U"} size="md" isOnline={true} />
        </div>

        <div className="flex items-center gap-2 text-[#54656f] dark:text-[#aebac1]">
          <button
            onClick={() => dispatch(toggleTheme())}
            className="p-2 rounded-full hover:bg-[#e4e7eb] dark:hover:bg-[#2a3942] transition-colors"
            title="Toggle Light/Dark Theme"
          >
            {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </button>

          <button className="p-2 rounded-full hover:bg-[#e4e7eb] dark:hover:bg-[#2a3942] transition-colors" title="New Chat">
            <MessageSquarePlus className="h-5 w-5" />
          </button>

          <Dropdown
            trigger={
              <button className="p-2 rounded-full hover:bg-[#e4e7eb] dark:hover:bg-[#2a3942] transition-colors">
                <MoreVertical className="h-5 w-5" />
              </button>
            }
            items={dropdownItems}
          />
        </div>
      </header>

      {/* Filter engine */}
      <SearchBar />

      {/* Scrollable contact records */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden bg-white dark:bg-[#111b21]">
        {filteredChats.length > 0 ? (
          filteredChats.map((chat) => <ChatCard key={chat.id} chat={chat} />)
        ) : (
          <div className="p-6 text-center text-xs sm:text-sm text-[#667781] dark:text-[#8696a0]">
            No chats or contacts found matching "{searchQuery}"
          </div>
        )}
      </div>

      {/* Modal Profile Box */}
      <Modal isOpen={profileModal} onClose={() => setProfileModal(false)} title="Profile settings">
        <div className="flex flex-col items-center py-4">
          <Avatar src={user?.avatar} fallback={user?.name?.[0] || "U"} size="xxl" className="mb-4 shadow-md" />
          <h4 className="text-lg font-semibold text-[#111b21] dark:text-[#e9edef]">{user?.name}</h4>
          <p className="text-xs text-[#667781] dark:text-[#8696a0] mt-1">{user?.email}</p>
          
          <div className="w-full mt-6 pt-4 border-t border-[#e9edef] dark:border-[#222d34] flex flex-col gap-3">
            <div className="text-xs text-[#00a884] font-medium uppercase tracking-wider">About</div>
            <div className="text-sm text-[#111b21] dark:text-[#e9edef] bg-[#f0f2f5] dark:bg-[#202c33] p-3 rounded-md">
              {user?.status || "Available"}
            </div>
          </div>
        </div>
      </Modal>
    </aside>
  );
}
