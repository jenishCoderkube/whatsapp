"use client";

import React, { useState, useEffect } from "react";
import { MessageSquarePlus, MoreVertical, Search, Users, UserPlus, Check } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Dropdown } from "../ui/Dropdown";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { ThemeToggle } from "../ui/ThemeToggle";
import { SearchBar } from "./SearchBar";
import { ChatCard } from "./ChatCard";
import { useAppDispatch, useAppSelector } from "../../hooks/useRedux";
import { logout } from "../../redux/slices/authSlice";
import { toggleTheme } from "../../redux/slices/uiSlice";
import { setChats, appendChat, setActiveChat } from "../../redux/slices/chatSlice";
import { chatService } from "../../services/chatService";
import { profileService } from "../../services/profileService";
import { cn } from "../../utils/cn";

export function Sidebar({ className }) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const chats = useAppSelector((state) => state.chat.chats);
  const searchQuery = useAppSelector((state) => state.chat.searchQuery);
  const theme = useAppSelector((state) => state.ui.theme);

  const [profileModal, setProfileModal] = useState(false);
  const [newChatModal, setNewChatModal] = useState(false);
  const [activeTab, setActiveTab] = useState("direct"); // 'direct' | 'group'

  // Direct chat search states
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Group creation states
  const [groupName, setGroupName] = useState("");
  const [groupAvatar, setGroupAvatar] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);

  // Fetch linked database conversations dynamically upon load
  useEffect(() => {
    if (user?.id) {
      chatService.getUserChats(user.id).then((fetchedChats) => {
        if (fetchedChats && fetchedChats.length > 0) {
          dispatch(setChats(fetchedChats));
        }
      });
    }
  }, [user?.id, dispatch]);

  // Handle debounced platform user profile searching
  useEffect(() => {
    if (!newChatModal) return;
    const timer = setTimeout(() => {
      setIsSearching(true);
      profileService.searchProfiles(userSearchQuery, user?.id).then((res) => {
        setSearchResults(res);
        setIsSearching(false);
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [userSearchQuery, user?.id, newChatModal]);

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

  // Initiate direct 1-to-1 conversation
  const handleStartDirectChat = async (targetProfile) => {
    if (!user?.id) return;
    try {
      const chatObj = await chatService.createOrOpenOneToOneChat(user.id, targetProfile);
      dispatch(appendChat(chatObj));
      dispatch(setActiveChat(chatObj.id));
      setNewChatModal(false);
    } catch (error) {
      console.error("Failed starting direct chat:", error);
    }
  };

  // Submit native multi-user Group Chat creation
  const handleCreateGroup = async () => {
    if (!user?.id || !groupName.trim()) return;
    try {
      const groupObj = await chatService.createGroupChat({
        name: groupName.trim(),
        avatar: groupAvatar || "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80",
        currentUserId: user.id,
        memberIds: selectedMembers,
      });

      dispatch(appendChat(groupObj));
      dispatch(setActiveChat(groupObj.id));
      setGroupName("");
      setSelectedMembers([]);
      setNewChatModal(false);
    } catch (error) {
      console.error("Group creation pipeline failure:", error);
    }
  };

  const toggleMemberSelection = (targetId) => {
    setSelectedMembers((prev) =>
      prev.includes(targetId) ? prev.filter((id) => id !== targetId) : [...prev, targetId]
    );
  };

  // Preset random avatar assignment support for swift group configurations
  const handleRandomGroupAvatar = () => {
    const icons = [
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80",
    ];
    setGroupAvatar(icons[Math.floor(Math.random() * icons.length)]);
  };

  return (
    <aside className={cn("flex flex-col h-full bg-wa-sidebar border-r border-wa-border select-none transition-colors duration-200", className)}>
      {/* Top native header strip */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-wa-header transition-colors duration-200">
        <div onClick={() => setProfileModal(true)} className="cursor-pointer" title="View Profile">
          <Avatar src={user?.avatar} fallback={user?.name?.[0] || "U"} size="md" isOnline={true} />
        </div>

        <div className="flex items-center gap-2 text-wa-muted">
          <ThemeToggle />

          <button
            onClick={() => setNewChatModal(true)}
            className="p-2 rounded-full hover:bg-wa-active transition-colors"
            title="New Chat"
          >
            <MessageSquarePlus className="h-5 w-5 text-wa-text" />
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

      {/* Profile Settings Modal */}
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

      {/* Interactive New Chat / Create Group Chat Modals */}
      <Modal isOpen={newChatModal} onClose={() => setNewChatModal(false)} title="Start New Conversation">
        <div className="flex flex-col h-[420px]">
          {/* Internal view switching strip */}
          <div className="flex border-b border-wa-border mb-3">
            <button
              onClick={() => setActiveTab("direct")}
              className={cn(
                "flex-1 py-2 text-xs font-medium text-center border-b-2 transition-colors",
                activeTab === "direct"
                  ? "border-wa-primary text-wa-primary"
                  : "border-transparent text-wa-muted hover:text-wa-text"
              )}
            >
              Direct Chat
            </button>
            <button
              onClick={() => setActiveTab("group")}
              className={cn(
                "flex-1 py-2 text-xs font-medium text-center border-b-2 transition-colors",
                activeTab === "group"
                  ? "border-wa-primary text-wa-primary"
                  : "border-transparent text-wa-muted hover:text-wa-text"
              )}
            >
              Create Group
            </button>
          </div>

          {/* Direct Chat search view */}
          {activeTab === "direct" ? (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="relative mb-3">
                <Input
                  type="text"
                  placeholder="Search registered profiles..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="pl-9"
                />
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-wa-muted" />
              </div>

              <div className="flex-1 overflow-y-auto pr-1">
                {isSearching ? (
                  <div className="py-8 text-center text-xs text-wa-muted">Searching profiles...</div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((profile) => (
                    <div
                      key={profile.id}
                      onClick={() => handleStartDirectChat(profile)}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-wa-hover cursor-pointer transition-colors"
                    >
                      <Avatar src={profile.avatar} fallback={profile.name[0]} size="md" isOnline={profile.online} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-wa-text truncate">{profile.name}</div>
                        <div className="text-[11px] text-wa-muted truncate">{profile.email}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-wa-muted">
                    {userSearchQuery.trim()
                      ? "No platform users found matching criteria."
                      : "Type an email or name to discover members."}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Multi-User Native Group Creation Layer */
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex items-center gap-3 mb-3">
                <div onClick={handleRandomGroupAvatar} className="cursor-pointer" title="Generate Preset Icon">
                  <Avatar
                    src={groupAvatar}
                    fallback="G"
                    size="lg"
                    className="border border-wa-border hover:opacity-80 transition-opacity"
                  />
                </div>
                <div className="flex-1">
                  <Input
                    type="text"
                    placeholder="Group Subject / Title..."
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                  />
                  <span className="text-[10px] text-wa-muted block mt-1">
                    Click placeholder icon to pick random custom image
                  </span>
                </div>
              </div>

              <div className="text-xs font-medium text-wa-muted mb-1.5">Select Group Participants</div>

              <div className="flex-1 overflow-y-auto border border-wa-border rounded-md p-1.5 mb-3 bg-wa-sidebar">
                {searchResults.length > 0 ? (
                  searchResults.map((profile) => {
                    const isSelected = selectedMembers.includes(profile.id);
                    return (
                      <div
                        key={profile.id}
                        onClick={() => toggleMemberSelection(profile.id)}
                        className={cn(
                          "flex items-center gap-2 p-1.5 rounded hover:bg-wa-hover cursor-pointer transition-colors select-none",
                          isSelected && "bg-wa-active"
                        )}
                      >
                        <div
                          className={cn(
                            "flex items-center justify-center h-4 w-4 rounded border transition-colors shrink-0",
                            isSelected ? "bg-wa-primary border-wa-primary text-white" : "border-wa-muted"
                          )}
                        >
                          {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                        </div>
                        <Avatar src={profile.avatar} fallback={profile.name[0]} size="sm" />
                        <span className="text-xs text-wa-text truncate flex-1">{profile.name}</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8 text-center text-xs text-wa-muted">
                    No searchable peers ready. Type characters in the Search input to fetch accounts.
                  </div>
                )}
              </div>

              <Button
                onClick={handleCreateGroup}
                disabled={!groupName.trim()}
                className="w-full"
                variant="default"
              >
                Create Group ({selectedMembers.length} Selected)
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </aside>
  );
}
