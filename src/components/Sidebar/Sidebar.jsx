"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquarePlus,
  MoreVertical,
  Search,
  Users,
  UserPlus,
  Check,
  Edit2,
  X,
  Upload,
  Trash2,
  Loader2,
  CircleDashed,
} from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Dropdown } from "../ui/Dropdown";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { ThemeToggle } from "../ui/ThemeToggle";
import { SearchBar } from "./SearchBar";
import { ChatCard } from "./ChatCard";
import { useAppDispatch, useAppSelector } from "../../hooks/useRedux";
import { useTranslation } from "../../hooks/useTranslation";
import { logout, updateProfile } from "../../redux/slices/authSlice";
import { toggleTheme, setArchivedViewOpen } from "../../redux/slices/uiSlice";
import { setStatusViewOpen } from "../../redux/slices/statusSlice";
import {
  setChats,
  appendChat,
  setActiveChat,
  resetChats,
  updateLastMessage,
  incrementUnread,
  updateChatMembership,
  updateChatAvatar,
  setUserTyping,
  syncOnlineUsers,
} from "../../redux/slices/chatSlice";
import { resetMessages } from "../../redux/slices/messageSlice";
import { chatService } from "../../services/chatService";
import { profileService } from "../../services/profileService";
import { authService } from "../../services/authService";
import { messageService } from "../../services/messageService";
import { realtimeService } from "../../services/realtimeService";
import { storageService } from "../../services/storageService";
import { supabase } from "../../lib/supabaseClient";
import { cn } from "../../utils/cn";
import { formatSidebarDate } from "../../utils/dateUtils";

export function Sidebar({ className }) {
  const dispatch = useAppDispatch();
  const { t, locale, changeLanguage, availableLanguages, languageNames } = useTranslation();
  const user = useAppSelector((state) => state.auth.user);
  const chats = useAppSelector((state) => state.chat.chats);
  const searchQuery = useAppSelector((state) => state.chat.searchQuery);
  const theme = useAppSelector((state) => state.ui.theme);
  const archivedViewOpen = useAppSelector((state) => state.ui.archivedViewOpen);
  const onlineMap = useAppSelector((state) => state.chat.onlineMap);

  const chatsRef = useRef(chats);
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  const [isChatsLoading, setIsChatsLoading] = useState(true);
  const [profileModal, setProfileModal] = useState(false);
  const [linkedDevicesModalOpen, setLinkedDevicesModalOpen] = useState(false);
  const [languageModalOpen, setLanguageModalOpen] = useState(false);
  const [activeDevices, setActiveDevices] = useState([
    { id: "chrome", name: "Google Chrome (Windows)", active: true, desc: "Last active: Just now • Bengaluru, India", isBrowser: true },
    { id: "iphone", name: "iPhone 15 Pro Max", active: false, desc: "Last active: Yesterday at 9:45 PM • California, US", isBrowser: false }
  ]);
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

  // Profile editable setting states
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [editingStatus, setEditingStatus] = useState(false);
  const [tempStatus, setTempStatus] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const profileFileInputRef = useRef(null);

  const handleLogoutDevice = async (dev) => {
    if (dev.active) {
      if (window.confirm(t("sidebar.logout_device_confirm"))) {
        try {
          await authService.logout();
        } catch (e) {
          console.warn("Signout request had error:", e);
        }
        dispatch(logout());
        dispatch(resetChats());
        dispatch(resetMessages());
        window.location.href = "/login";
      }
    } else {
      if (window.confirm(t("sidebar.logout_other_device_confirm", { device: dev.name }))) {
        setActiveDevices(activeDevices.filter((d) => d.id !== dev.id));
      }
    }
  };

  const handleLogoutAllDevices = async () => {
    try {
      await authService.logoutAllDevices();
    } catch (e) {
      console.warn("Global signout request had error, forcing local cleanup:", e);
    }
    dispatch(logout());
    dispatch(resetChats());
    dispatch(resetMessages());
    window.location.href = "/login";
  };

  // Fetch linked database conversations dynamically upon load
  useEffect(() => {
    if (user?.id) {
      // Try to load cached chats immediately from localStorage for instant display
      let hasCache = false;
      if (typeof window !== "undefined") {
        try {
          const cached = localStorage.getItem(`wa_cached_chats_${user.id}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.length > 0) {
              dispatch(setChats(parsed));
              setIsChatsLoading(false);
              hasCache = true;
            }
          }
        } catch (e) {
          console.warn("Failed to load cached chats:", e);
        }
      }

      if (!hasCache) {
        setIsChatsLoading(true);
      }
      
      const loadChats = () => {
        chatService.getUserChats(user.id).then((fetchedChats) => {
          if (fetchedChats && fetchedChats.length > 0) {
            dispatch(setChats(fetchedChats));

            // Cache the fresh chats in localStorage
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem(`wa_cached_chats_${user.id}`, JSON.stringify(fetchedChats));
              } catch (e) {
                console.warn("Failed to cache chats:", e);
              }
            }

            // Batch acknowledge delivery for all active sidebar conversations at once
            messageService.syncAllPendingDeliveries(user.id).catch((err) => {
              console.warn("Failed syncing pending deliveries:", err);
            });
          }
          setIsChatsLoading(false);
        }).catch((err) => {
          console.error("Failed loading user conversations:", err);
          setIsChatsLoading(false);
        });
      };

      // Clean up database-level expired disappearing messages asynchronously in the background
      const runCleanup = async () => {
        try {
          await supabase.rpc("cleanup_expired_messages");
        } catch (err) {
          console.warn("Expired disappearing messages cleanup failed:", err);
        }
      };
      runCleanup();

      // Load fresh conversations from the network
      loadChats();

      // Listen for membership changes (being added, removed, or leaving groups)
      const membershipChannel = supabase
        .channel(`membership-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "conversation_members",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const { eventType, new: newRow, old: oldRow } = payload;

            if (eventType === "DELETE") {
              dispatch(removeChat(oldRow.conversation_id));
            } else if (eventType === "UPDATE" || eventType === "INSERT") {
              // If it's an update to is_left, sync the slice status
              const chatId = newRow.conversation_id;
              const isLeft = newRow.is_left;

              // Check if we already have this chat
              const existingChat = chatsRef.current.find(
                (c) => c.id === chatId,
              );
              if (existingChat) {
                dispatch(updateChatMembership({ chatId, isLeft }));
              } else if (!isLeft) {
                // If added to a group we don't have in local state yet, fetch it
                chatService.getUserChats(user.id).then((allChats) => {
                  const target = allChats.find((c) => c.id === chatId);
                  if (target) dispatch(appendChat(target));
                });
              }
            }
          },
        )
        .subscribe();

      // Listen for conversation metadata updates (Group Avatar/Name, Last Message, Status)
      const conversationChannel = supabase
        .channel("global-conversation-updates")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "conversations",
          },
          (payload) => {
            const updatedConv = payload.new;
            // Check if this conversation exists in our list
            const existing = chatsRef.current.find(
              (c) => c.id === updatedConv.id,
            );
            if (existing) {
              // Update avatar if changed (only for groups, since 1-to-1 avatars are managed via peer profiles)
              if (existing.isGroup && updatedConv.avatar !== existing.avatar) {
                dispatch(
                  updateChatAvatar({
                    chatId: updatedConv.id,
                    avatar: updatedConv.avatar,
                  }),
                );
              }

              // Update last message preview and status (ticks) if changed
              if (
                updatedConv.last_message_text !== existing.lastMessage?.text ||
                updatedConv.last_message_status !==
                  existing.lastMessage?.status ||
                updatedConv.last_message_timestamp !==
                  existing.lastMessage?.timestamp
              ) {
                dispatch(
                  updateLastMessage({
                    chatId: updatedConv.id,
                    text: updatedConv.last_message_text,
                    timestamp: updatedConv.last_message_timestamp,
                    isOutgoing: updatedConv.last_message_sender_id === user.id,
                    status: updatedConv.last_message_status,
                  }),
                );
              }
            }
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(membershipChannel);
        supabase.removeChannel(conversationChannel);
      };
    }
  }, [user?.id, dispatch]);

  // Sync temp profile attributes upon mounting configuration overlays
  useEffect(() => {
    if (profileModal && user) {
      setTempName(user.name || "");
      setTempStatus(user.status || "Available");
      setEditingName(false);
      setEditingStatus(false);
      setProfileMessage("");
    }
  }, [profileModal, user]);

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
    chat.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const activeChats = filteredChats.filter((chat) => !chat.isArchived);
  const archivedChats = filteredChats.filter((chat) => chat.isArchived);

  const handleLogout = async () => {
    try {
      // 1. Terminate Supabase session and update online status to false
      await authService.logout();

      // 2. Clear all Redux slices to prevent stale data upon next login or refresh
      dispatch(logout());
      dispatch(resetChats());
      dispatch(resetMessages());

      // 3. Absolute cleanup of real-time listeners
      realtimeService.disconnectGlobalPresence();
      realtimeService.disconnectGlobalMessages();

      // 4. Clear all potential sensitive cached items manually
      if (typeof window !== "undefined") {
        localStorage.clear();
        sessionStorage.clear();
      }
    } catch (error) {
      console.error("Logout error:", error);
      dispatch(logout());
      dispatch(resetChats());
      dispatch(resetMessages());
    }
  };

  const dropdownItems = [
    {
      label: t("sidebar.profile_info"),
      onClick: () => setProfileModal(true),
    },
    {
      label: t("sidebar.linked_devices"),
      onClick: () => setLinkedDevicesModalOpen(true),
    },
    {
      label: t("sidebar.language_settings"),
      onClick: () => setLanguageModalOpen(true),
    },
    {
      label: theme === "light" ? t("sidebar.dark_theme") : t("sidebar.light_theme"),
      onClick: () => dispatch(toggleTheme()),
    },
    {
      label: t("sidebar.logout"),
      danger: true,
      onClick: handleLogout,
    },
  ];

  // Initiate direct 1-to-1 conversation
  const handleStartDirectChat = async (targetProfile) => {
    if (!user?.id) return;
    try {
      const chatObj = await chatService.createOrOpenOneToOneChat(
        user.id,
        targetProfile,
      );
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
        avatar:
          groupAvatar ||
          "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80",
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
      prev.includes(targetId)
        ? prev.filter((id) => id !== targetId)
        : [...prev, targetId],
    );
  };

  const handleRandomGroupAvatar = () => {
    const icons = [
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80",
    ];
    setGroupAvatar(icons[Math.floor(Math.random() * icons.length)]);
  };

  // Profile Customization pipelines
  const handleSaveName = async () => {
    if (!user?.id || !tempName.trim()) return;
    setIsUpdatingProfile(true);
    setProfileMessage("");
    try {
      const updated = await profileService.updateProfileData(user.id, {
        name: tempName.trim(),
      });
      if (updated) {
        dispatch(updateProfile({ name: updated.name }));
        setEditingName(false);
        setProfileMessage("Username updated successfully.");
      }
    } catch (err) {
      setProfileMessage("Failed to update username.");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleSaveStatus = async () => {
    if (!user?.id || !tempStatus.trim()) return;
    setIsUpdatingProfile(true);
    setProfileMessage("");
    try {
      const updated = await profileService.updateProfileData(user.id, {
        status: tempStatus.trim(),
      });
      if (updated) {
        dispatch(updateProfile({ status: updated.status }));
        setEditingStatus(false);
        setProfileMessage("About description updated successfully.");
      }
    } catch (err) {
      setProfileMessage("Failed to update about section.");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleProfileAvatarSelectChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    if (file.size > 5 * 1024 * 1024) {
      setProfileMessage("Maximum image size is 5MB.");
      return;
    }

    setIsUpdatingProfile(true);
    setProfileMessage("");

    try {
      const uploadedAbsoluteUrl = await storageService.uploadFile(
        file,
        "avatars",
      );
      if (uploadedAbsoluteUrl) {
        const updated = await profileService.updateProfileData(user.id, {
          avatar: uploadedAbsoluteUrl,
        });
        if (updated) {
          dispatch(updateProfile({ avatar: updated.avatar }));
          setProfileMessage("Profile photo updated successfully.");
        }
      }
    } catch (err) {
      setProfileMessage("Failed to upload profile picture.");
    } finally {
      setIsUpdatingProfile(false);
      e.target.value = "";
    }
  };

  const handleRemoveAvatarImage = async () => {
    if (!user?.id) return;
    setIsUpdatingProfile(true);
    setProfileMessage("");
    try {
      const fallbackUrl =
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80";
      const updated = await profileService.updateProfileData(user.id, {
        avatar: fallbackUrl,
      });
      if (updated) {
        dispatch(updateProfile({ avatar: updated.avatar }));
        setProfileMessage("Profile photo removed.");
      }
    } catch (err) {
      setProfileMessage("Failed to delete custom image.");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  if (archivedViewOpen) {
    return (
      <aside
        className={cn(
          "flex flex-col h-full bg-wa-sidebar border-r border-wa-border select-none transition-colors duration-200",
          className,
        )}
      >
        {/* Archived view header strip matching WhatsApp Web */}
        <header className="flex items-center gap-6 px-4 py-4 bg-wa-primary text-white shrink-0">
          <button
            onClick={() => dispatch(setArchivedViewOpen(false))}
            className="p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              className="fill-white rotate-180"
            >
              <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"></path>
            </svg>
          </button>
          <span className="font-semibold text-base sm:text-lg">{t("sidebar.archived")}</span>
        </header>

        {/* Scrollable list of archived chats */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden bg-wa-sidebar transition-colors duration-200">
          {archivedChats.length > 0 ? (
            archivedChats.map((chat) => <ChatCard key={chat.id} chat={chat} />)
          ) : (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center text-wa-muted select-none">
              <span className="text-xs sm:text-sm font-medium">
                No archived chats
              </span>
            </div>
          )}
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-wa-sidebar border-r border-wa-border select-none transition-colors duration-200",
        className,
      )}
    >
      {/* Top native header strip */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-wa-header transition-colors duration-200 shrink-0">
        <div
          onClick={() => setProfileModal(true)}
          className="cursor-pointer block"
          title="View Profile"
        >
          <Avatar
            src={user?.avatar}
            fallback={user?.name?.[0] || "U"}
            size="md"
            isOnline={true}
          />
        </div>

        <div className="flex items-center gap-2 text-wa-muted">
          <ThemeToggle />

          <button
            onClick={() => dispatch(setStatusViewOpen(true))}
            className="p-2 rounded-full hover:bg-wa-active transition-colors block"
            title={t("status.my_status").split(" ")[1] || "Status"}
          >
            <CircleDashed className="h-5 w-5 text-wa-text" />
          </button>

          <button
            onClick={() => setNewChatModal(true)}
            className="p-2 rounded-full hover:bg-wa-active transition-colors block"
            title={t("sidebar.new_chat")}
          >
            <MessageSquarePlus className="h-5 w-5 text-wa-text" />
          </button>

          <Dropdown
            trigger={
              <button className="p-2 rounded-full hover:bg-wa-active transition-colors block">
                <MoreVertical className="h-5 w-5" />
              </button>
            }
            items={dropdownItems}
          />
        </div>
      </header>

      {/* Filter engine */}
      <SearchBar />

      {/* Archived Chats Folder Banner */}
      {archivedChats.length > 0 && (
        <div
          onClick={() => dispatch(setArchivedViewOpen(true))}
          className="flex items-center justify-between px-4 py-3 hover:bg-wa-hover cursor-pointer border-b border-wa-border/40 select-none group transition-colors duration-150 shrink-0"
        >
          <div className="flex items-center gap-3">
            <span className="text-wa-primary flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                className="fill-wa-primary"
              >
                <path d="M4 3h16a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm1 14h14v-7H5v7zm-2-9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8zm7 3h4a1 1 0 0 1 0 2h-4a1 1 0 0 1 0-2z"></path>
              </svg>
            </span>
            <span className="font-medium text-sm sm:text-base text-wa-text">
              {t("sidebar.archived")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-wa-primary font-semibold">
              {archivedChats.length}
            </span>
          </div>
        </div>
      )}

      {/* Scrollable contact records */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden bg-wa-sidebar transition-colors duration-200">
        {isChatsLoading ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center select-none h-full gap-4">
            <div className="animate-spin text-wa-primary flex items-center justify-center">
              <svg className="h-9 w-9 text-wa-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-85" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <span className="text-xs sm:text-sm text-wa-muted font-medium tracking-wide animate-pulse">
              {t("sidebar.loading_chats")}
            </span>
          </div>
        ) : activeChats.length > 0 ? (
          activeChats.map((chat) => <ChatCard key={chat.id} chat={chat} />)
        ) : (
          <div className="p-6 text-center text-xs sm:text-sm text-wa-muted">
            {t("sidebar.no_chats", { query: searchQuery })}
          </div>
        )}
      </div>

      {/* Profile Settings Engine Modal */}
      <Modal
        isOpen={profileModal}
        onClose={() => setProfileModal(false)}
        title={t("sidebar.profile_info")}
      >
        <div className="flex flex-col items-center py-2 max-h-[75vh] overflow-y-auto px-2">
          {profileMessage && (
            <div className="w-full mb-3 p-2 rounded text-center text-xs bg-wa-active text-wa-text border border-wa-border animate-fade-in">
              {profileMessage}
            </div>
          )}

          {/* Hidden Avatar Uploader element */}
          <input
            type="file"
            ref={profileFileInputRef}
            onChange={handleProfileAvatarSelectChange}
            accept="image/*"
            className="hidden"
          />

          {/* Realtime Interactive Profile photo block */}
          <div className="relative group cursor-pointer my-2 block rounded-full">
            <Avatar
              src={user?.avatar}
              fallback={user?.name?.[0] || "U"}
              size="xxl"
              className="shadow-md ring-2 ring-wa-border"
            />
            <div
              onClick={() => profileFileInputRef.current?.click()}
              className="absolute inset-0 flex flex-col items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity text-white text-center p-2"
            >
              <Upload className="h-5 w-5 mb-1" />
              <span className="text-[10px] leading-tight">{t("sidebar.change_photo")}</span>
            </div>
            {isUpdatingProfile && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-wa-modal/80 backdrop-blur-xs">
                <Loader2 className="h-6 w-6 text-wa-primary animate-spin" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1 mb-4 text-xs">
            <button
              onClick={() => profileFileInputRef.current?.click()}
              disabled={isUpdatingProfile}
              className="text-wa-primary font-medium hover:underline block cursor-pointer"
            >
              {t("sidebar.upload_image")}
            </button>
            <span className="text-wa-muted">•</span>
            <button
              onClick={handleRemoveAvatarImage}
              disabled={isUpdatingProfile}
              className="text-red-500 font-medium hover:underline block cursor-pointer"
            >
              {t("common.remove")}
            </button>
          </div>

          {/* Fully Interactive Edit Fields mapping */}
          <div className="w-full pt-3 border-t border-wa-border flex flex-col gap-4 text-left">
            {/* Username Section */}
            <div className="flex flex-col gap-1">
              <div className="text-[11px] text-wa-primary font-medium uppercase tracking-wider px-1">
                {t("sidebar.your_name")}
              </div>
              {editingName ? (
                <div className="flex items-center gap-1">
                  <Input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    className="h-8 text-xs flex-1"
                    placeholder={t("sidebar.your_name")}
                    autoFocus
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={isUpdatingProfile || !tempName.trim()}
                    className="p-1.5 rounded bg-wa-primary text-white hover:opacity-90 block cursor-pointer"
                    title={t("common.save")}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setTempName(user?.name || "");
                      setEditingName(false);
                    }}
                    disabled={isUpdatingProfile}
                    className="p-1.5 rounded bg-wa-active text-wa-muted hover:text-wa-text block cursor-pointer"
                    title={t("common.cancel")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-wa-header px-3 py-2 rounded-md group">
                  <span className="text-xs sm:text-sm font-medium text-wa-text truncate">
                    {user?.name}
                  </span>
                  <button
                    onClick={() => setEditingName(true)}
                    className="text-wa-muted hover:text-wa-primary transition-colors block cursor-pointer"
                    title={t("sidebar.edit_name") || "Edit name"}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <span className="text-[10px] text-wa-muted px-1 block">
                {t("sidebar.name_disclaimer")}
              </span>
            </div>

            {/* About description Section */}
            <div className="flex flex-col gap-1">
              <div className="text-[11px] text-wa-primary font-medium uppercase tracking-wider px-1">
                {t("sidebar.about")}
              </div>
              {editingStatus ? (
                <div className="flex items-center gap-1">
                  <Input
                    type="text"
                    value={tempStatus}
                    onChange={(e) => setTempStatus(e.target.value)}
                    className="h-8 text-xs flex-1"
                    placeholder={t("status.type_status")}
                    autoFocus
                  />
                  <button
                    onClick={handleSaveStatus}
                    disabled={isUpdatingProfile || !tempStatus.trim()}
                    className="p-1.5 rounded bg-wa-primary text-white hover:opacity-90 block cursor-pointer"
                    title={t("common.save")}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setTempStatus(user?.status || "Available");
                      setEditingStatus(false);
                    }}
                    disabled={isUpdatingProfile}
                    className="p-1.5 rounded bg-wa-active text-wa-muted hover:text-wa-text block cursor-pointer"
                    title={t("common.cancel")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-wa-header px-3 py-2 rounded-md group">
                  <span className="text-xs sm:text-sm text-wa-text truncate">
                    {user?.status || t("sidebar.available") || "Available"}
                  </span>
                  <button
                    onClick={() => setEditingStatus(true)}
                    className="text-wa-muted hover:text-wa-primary transition-colors block cursor-pointer"
                    title={t("sidebar.edit_about") || "Edit about"}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Interactive New Chat / Create Group Chat Modals */}
      <Modal
        isOpen={newChatModal}
        onClose={() => setNewChatModal(false)}
        title={t("sidebar.new_chat")}
      >
        <div className="flex flex-col h-[420px]">
          {/* Internal view switching strip */}
          <div className="flex border-b border-wa-border mb-3">
            <button
              onClick={() => setActiveTab("direct")}
              className={cn(
                "flex-1 py-2 text-xs font-medium text-center border-b-2 transition-colors block cursor-pointer",
                activeTab === "direct"
                  ? "border-wa-primary text-wa-primary"
                  : "border-transparent text-wa-muted hover:text-wa-text",
              )}
            >
              {t("sidebar.direct_chat")}
            </button>
            <button
              onClick={() => setActiveTab("group")}
              className={cn(
                "flex-1 py-2 text-xs font-medium text-center border-b-2 transition-colors block cursor-pointer",
                activeTab === "group"
                  ? "border-wa-primary text-wa-primary"
                  : "border-transparent text-wa-muted hover:text-wa-text",
              )}
            >
              {t("sidebar.create_group")}
            </button>
          </div>

          {/* Direct Chat search view */}
          {activeTab === "direct" ? (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="relative mb-3 p-0.5">
                <Input
                  type="text"
                  placeholder={t("sidebar.search_profiles")}
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="pl-9 bg-wa-header border border-wa-border rounded-lg text-xs sm:text-sm py-2 focus:ring-1 focus:ring-wa-primary"
                />
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-wa-muted" />
              </div>

              <div className="flex-1 overflow-y-auto pr-1">
                {isSearching ? (
                  <div className="py-8 text-center text-xs text-wa-muted animate-pulse">
                    {t("sidebar.searching_profiles")}
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((profile) => (
                    <div
                      key={profile.id}
                      onClick={() => handleStartDirectChat(profile)}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-wa-hover cursor-pointer transition-colors"
                    >
                      <Avatar
                        src={profile.avatar}
                        fallback={profile.name[0]}
                        size="md"
                        isOnline={!!onlineMap[profile.id]}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-wa-text truncate">
                          {profile.name}
                        </div>
                        <div className="text-[11px] text-wa-muted truncate">
                          {profile.email}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-wa-muted">
                    {userSearchQuery.trim()
                      ? t("sidebar.no_profiles_found")
                      : t("sidebar.type_to_discover")}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Multi-User Native Group Creation Layer */
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex items-center gap-3 mb-3">
                <div
                  onClick={handleRandomGroupAvatar}
                  className="cursor-pointer block"
                  title={t("sidebar.generate_preset_icon")}
                >
                  <Avatar
                    src={groupAvatar}
                    fallback="G"
                    size="lg"
                    className="border border-wa-border hover:opacity-80 transition-opacity"
                  />
                </div>
                <div className="flex-1 p-0.5">
                  <Input
                    className="bg-wa-header border border-wa-border rounded-lg text-xs sm:text-sm py-2 font-medium focus:ring-1 focus:ring-wa-primary"
                    type="text"
                    placeholder={t("sidebar.group_subject_placeholder")}
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                  />
                  <span className="text-[10px] text-wa-muted block mt-1">
                    {t("sidebar.click_placeholder_desc")}
                  </span>
                </div>
              </div>

              <div className="text-xs font-medium text-wa-muted mb-1.5">
                {t("sidebar.select_participants")}
              </div>

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
                          isSelected && "bg-wa-active",
                        )}
                      >
                        <div
                          className={cn(
                            "flex items-center justify-center h-4 w-4 rounded border transition-colors shrink-0",
                            isSelected
                              ? "bg-wa-primary border-wa-primary text-white"
                              : "border-wa-muted",
                          )}
                        >
                          {isSelected && (
                            <Check className="h-3 w-3 stroke-[3]" />
                          )}
                        </div>
                        <Avatar
                          src={profile.avatar}
                          fallback={profile.name[0]}
                          size="sm"
                        />
                        <span className="text-xs text-wa-text truncate flex-1">
                          {profile.name}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8 text-center text-xs text-wa-muted">
                    {t("sidebar.no_peers_desc")}
                  </div>
                )}
              </div>

              <Button
                onClick={handleCreateGroup}
                disabled={!groupName.trim()}
                className="w-full"
                variant="default"
              >
                {t("sidebar.create_group_with_count", { count: selectedMembers.length })}
              </Button>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={linkedDevicesModalOpen}
        onClose={() => setLinkedDevicesModalOpen(false)}
        title={t("sidebar.linked_devices")}
      >
        <div className="flex flex-col items-center py-2 max-h-[75vh] overflow-y-auto px-4 select-none">
          {/* Main Visual Graphic (laptop + phone sync mockup) */}
          <div className="flex flex-col items-center justify-center text-center py-6 px-4 bg-wa-header/20 border border-wa-border/50 rounded-2xl w-full mb-6 relative overflow-hidden">
            <div className="h-16 w-16 rounded-full bg-wa-primary/10 flex items-center justify-center mb-3">
              <svg
                viewBox="0 0 24 24"
                width="32"
                height="32"
                className="fill-wa-primary animate-pulse"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"></path>
              </svg>
            </div>
            <h4 className="text-sm sm:text-base font-semibold text-wa-text">
              {t("sidebar.active_login_sessions")}
            </h4>
            <p className="text-xs text-wa-muted mt-1 max-w-sm leading-relaxed">
              {t("sidebar.active_login_sessions_desc")}
            </p>
          </div>

          {/* Linked Sessions List */}
          <div className="w-full text-left">
            <span className="text-xs text-wa-muted font-bold uppercase tracking-wider block mb-3 px-1">
              {t("sidebar.active_sessions")}
            </span>

            <div className="flex flex-col gap-2.5">
              {activeDevices.map((dev) => (
                <div 
                  key={dev.id} 
                  className={cn(
                    "flex items-center gap-3.5 p-3 rounded-xl bg-wa-header border border-wa-border/40 transition-all",
                    dev.active ? "border-wa-border/60" : "opacity-75 group hover:opacity-100"
                  )}
                >
                  <div className="h-10 w-10 rounded-full bg-wa-active flex items-center justify-center shrink-0 text-wa-muted">
                    {dev.isBrowser ? (
                      <svg
                        viewBox="0 0 24 24"
                        width="20"
                        height="20"
                        className="fill-wa-primary"
                      >
                        <path d="M20 4H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-2 12H6V6h12v10z"></path>
                      </svg>
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        width="20"
                        height="20"
                        className="fill-wa-muted"
                      >
                        <path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z"></path>
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs sm:text-sm font-semibold text-wa-text flex items-center gap-2">
                      {dev.name}
                      {dev.active && (
                        <>
                          <span className="h-2 w-2 rounded-full bg-green-500 shrink-0 inline-block animate-ping" />
                          <span className="text-[10px] text-green-500 font-bold uppercase tracking-tighter">
                            {t("sidebar.active")}
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-[10px] sm:text-xs text-wa-muted truncate mt-0.5">
                      {dev.desc}
                    </p>
                  </div>
                  <button
                    onClick={() => handleLogoutDevice(dev)}
                    className="text-[10px] sm:text-xs font-bold text-red-500 hover:underline shrink-0 block"
                  >
                    {t("sidebar.logout")}
                  </button>
                </div>
              ))}

              {activeDevices.length > 0 && (
                <button
                  onClick={handleLogoutAllDevices}
                  className="w-full mt-4 py-2.5 rounded-xl border border-red-500/30 hover:bg-red-500/10 text-red-500 font-bold text-xs sm:text-sm transition-all text-center block outline-none"
                >
                  {t("sidebar.logout_all_devices")}
                </button>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Language Settings Modal */}
      <Modal
        isOpen={languageModalOpen}
        onClose={() => setLanguageModalOpen(false)}
        title={t("sidebar.language_settings")}
      >
        <div className="flex flex-col py-2 max-h-[75vh] overflow-y-auto px-4 select-none">
          <p className="text-xs text-wa-muted mb-4">
            {t("sidebar.select_language")}
          </p>
          <div className="flex flex-col gap-2">
            {availableLanguages.map((langCode) => {
              const isSelected = locale === langCode;
              return (
                <button
                  key={langCode}
                  onClick={() => {
                    changeLanguage(langCode);
                  }}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl border transition-all text-left w-full outline-none cursor-pointer",
                    isSelected
                      ? "bg-wa-primary/10 border-wa-primary text-wa-primary font-semibold"
                      : "bg-wa-header border-wa-border/40 text-wa-text hover:bg-wa-hover hover:border-wa-border/60"
                  )}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {languageNames[langCode] || langCode}
                    </span>
                    <span className="text-[10px] text-wa-muted uppercase mt-0.5">
                      {langCode}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "flex items-center justify-center h-5 w-5 rounded-full border transition-all shrink-0",
                      isSelected
                        ? "border-wa-primary bg-wa-primary"
                        : "border-wa-border"
                    )}
                  >
                    {isSelected && (
                      <div className="h-2 w-2 rounded-full bg-white" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </Modal>
    </aside>
  );
}
