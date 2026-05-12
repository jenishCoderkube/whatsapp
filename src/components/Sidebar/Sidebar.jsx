"use client";

import React, { useState } from "react";
import { MessageSquarePlus, MoreVertical, Sun, Moon, LogOut, User } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Dropdown } from "../ui/Dropdown";
import { Modal } from "../ui/Modal";
import { ThemeToggle } from "../ui/ThemeToggle";
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
    <aside className={cn("flex flex-col h-full bg-wa-sidebar border-r border-wa-border select-none transition-colors duration-200", className)}>
      {/* Top native header strip */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-wa-header transition-colors duration-200">
        <div onClick={() => setProfileModal(true)} className="cursor-pointer" title="View Profile">
          <Avatar src={user?.avatar} fallback={user?.name?.[0] || "U"} size="md" isOnline={true} />
        </div>

        <div className="flex items-center gap-2 text-wa-muted">
          <ThemeToggle />

          <button className="p-2 rounded-full hover:bg-wa-active transition-colors" title="New Chat">
            <MessageSquarePlus className="h-5 w-5" />
          </button>

          <Dropdown
            trigger={
              <button className="p-2 rounded-full hover:bg-wa-active transition-colors">
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
      <div className="flex-1 overflow-y-auto overflow-x-hidden bg-wa-sidebar transition-colors duration-200">
        {filteredChats.length > 0 ? (
          filteredChats.map((chat) => <ChatCard key={chat.id} chat={chat} />)
        ) : (
          <div className="p-6 text-center text-xs sm:text-sm text-wa-muted">
            No chats or contacts found matching "{searchQuery}"
          </div>
        )}
      </div>

      {/* Modal Profile Box */}
      <Modal isOpen={profileModal} onClose={() => setProfileModal(false)} title="Profile settings">
        <div className="flex flex-col items-center py-4">
          <Avatar src={user?.avatar} fallback={user?.name?.[0] || "U"} size="xxl" className="mb-4 shadow-md" />
          <h4 className="text-lg font-semibold text-wa-text">{user?.name}</h4>
          <p className="text-xs text-wa-muted mt-1">{user?.email}</p>
          
          <div className="w-full mt-6 pt-4 border-t border-wa-border flex flex-col gap-3">
            <div className="text-xs text-wa-primary font-medium uppercase tracking-wider">About</div>
            <div className="text-sm text-wa-text bg-wa-header p-3 rounded-md transition-colors">
              {user?.status || "Available"}
            </div>
          </div>
        </div>
      </Modal>
    </aside>
  );
}
