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
  Lock,
} from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Dropdown } from "../ui/Dropdown";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { ThemeToggle } from "../ui/ThemeToggle";
import { SearchBar } from "./SearchBar";
import { ChatCard } from "./ChatCard";
import { ProfileModal } from "./ProfileModal";
import { NewChatModal } from "./NewChatModal";
import { LinkedDevicesModal } from "./LinkedDevicesModal";
import { LanguageModal } from "./LanguageModal";
import { LockScreen } from "../Lock/LockScreen";
import { LockSettingsModal } from "../Lock/LockSettingsModal";
import { useAppDispatch, useAppSelector } from "../../hooks/useRedux";
import { useTranslation } from "../../hooks/useTranslation";
import { logout, updateProfile } from "../../redux/slices/authSlice";
import { toggleTheme, setArchivedViewOpen, setWallpaperModal } from "../../redux/slices/uiSlice";
import { setStatusViewOpen } from "../../redux/slices/statusSlice";
import { lockApp, setLockedChatsFolderUnlocked } from "../../redux/slices/lockSlice";
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
  setDrafts,
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

  // Screen/Chat Lock States
  const {
    lockedChatIds,
    isLockedChatsFolderUnlocked,
    savedPin,
    savedPattern,
    lockType,
  } = useAppSelector((state) => state.lock);

  const [lockSettingsOpen, setLockSettingsOpen] = useState(false);
  const [lockedChatsOpen, setLockedChatsOpen] = useState(false);

  const chatsRef = useRef(chats);
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  const [isChatsLoading, setIsChatsLoading] = useState(true);
  const [profileModal, setProfileModal] = useState(false);
  const [linkedDevicesModalOpen, setLinkedDevicesModalOpen] = useState(false);
  const [languageModalOpen, setLanguageModalOpen] = useState(false);
  const [activeDevices, setActiveDevices] = useState([]);
  const [currentDeviceId, setCurrentDeviceId] = useState("");
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

  useEffect(() => {
    if (user?.id) {
      let isSubscribed = true;
      let cleanupSession = null;
      let intervalId = null;

      const initSessions = async () => {
        const handleLocalLogout = async () => {
          if (!isSubscribed) return;
          try {
            await authService.logout();
          } catch (e) {
            console.warn("Auto logout failed:", e);
          }
          dispatch(logout());
          dispatch(resetChats());
          dispatch(resetMessages());
          window.location.href = "/login";
        };

        const handleListUpdated = (devices) => {
          if (!isSubscribed) return;
          const localId = localStorage.getItem("wa_device_id");
          const formatted = devices.map(d => ({
            id: d.id,
            name: d.name,
            active: d.id === localId,
            desc: d.id === localId
              ? t("sidebar.active") || "Active"
              : `Last active: ${new Date(d.lastActive).toLocaleString()} (Logged in: ${new Date(d.loginTime).toLocaleString()})`,
            isBrowser: d.isBrowser,
            loginTime: d.loginTime,
            lastActive: d.lastActive,
            platform: d.platform,
            browser: d.browser
          }));
          setActiveDevices(formatted);
        };

        try {
          const { sessionService } = await import("../../services/sessionService");
          const { currentDeviceId: myId, activeDevices: list, loggedOut } = await sessionService.registerCurrentDevice(
            user.id,
            handleLocalLogout,
            handleListUpdated
          );
          
          if (loggedOut) return;

          if (isSubscribed) {
            setCurrentDeviceId(myId);
            handleListUpdated(list);
          }

          // Update last active periodically (every 3 minutes)
          intervalId = setInterval(() => {
            sessionService.updateLastActive(user.id, myId);
          }, 3 * 60 * 1000);

          cleanupSession = sessionService;
        } catch (err) {
          console.error("Failed to initialize active sessions:", err);
        }
      };

      initSessions();

      return () => {
        isSubscribed = false;
        if (intervalId) clearInterval(intervalId);
        if (cleanupSession) cleanupSession.unsubscribe();
      };
    }
  }, [user?.id, dispatch, t]);

  const handleLogoutDevice = async (dev) => {
    const isCurrent = dev.id === currentDeviceId;
    const confirmMsg = isCurrent 
      ? t("sidebar.logout_device_confirm") 
      : t("sidebar.logout_other_device_confirm", { device: dev.name }) || `Are you sure you want to log out ${dev.name}?`;
      
    if (window.confirm(confirmMsg)) {
      try {
        const { sessionService } = await import("../../services/sessionService");
        if (isCurrent) {
          await authService.logout();
          dispatch(logout());
          dispatch(resetChats());
          dispatch(resetMessages());
          window.location.href = "/login";
        } else {
          await sessionService.logoutDevice(user.id, dev.id);
          setActiveDevices(prev => prev.filter(d => d.id !== dev.id));
        }
      } catch (e) {
        console.warn("Logout device failed:", e);
      }
    }
  };

  const handleLogoutAllDevices = async () => {
    if (window.confirm(t("sidebar.logout_all_devices_confirm") || "Are you sure you want to log out all other devices?")) {
      try {
        const { sessionService } = await import("../../services/sessionService");
        await sessionService.logoutAllOtherDevices(user.id, currentDeviceId);
        setActiveDevices(prev => prev.filter(d => d.active));
      } catch (e) {
        console.warn("Logout other devices failed:", e);
      }
    }
  };

  const handleLogoutAllIncludingCurrent = async () => {
    if (window.confirm(t("sidebar.logout_all_confirm") || "Are you sure you want to log out all devices, including this one?")) {
      try {
        const { sessionService } = await import("../../services/sessionService");
        await sessionService.logoutAllDevices(user.id);
        await authService.logoutAllDevices();
      } catch (e) {
        console.warn("Global signout request had error, forcing local cleanup:", e);
      }
      dispatch(logout());
      dispatch(resetChats());
      dispatch(resetMessages());
      window.location.href = "/login";
    }
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

      // Load drafts from IndexedDB
      const loadDrafts = async () => {
        try {
          const { indexedDBService } = await import("../../services/indexedDBService");
          const allDrafts = await indexedDBService.getAllDrafts();
          const draftMap = {};
          allDrafts.forEach((d) => {
            draftMap[d.chatId] = {
              text: d.text,
              replyTo: d.replyTo,
              files: d.files || [],
            };
          });
          dispatch(setDrafts(draftMap));
        } catch (e) {
          console.warn("Failed to load drafts from IndexedDB:", e);
        }
      };
      loadDrafts();

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

  const activeChats = filteredChats.filter(
    (chat) => !chat.isArchived && !lockedChatIds.includes(chat.id),
  );
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
      label: t("sidebar.chat_wallpaper") || "Chat Wallpaper",
      onClick: () => dispatch(setWallpaperModal({ open: true })),
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
      label: t("sidebar.screen_lock_settings") || "Screen Lock Settings",
      onClick: () => setLockSettingsOpen(true),
    },
    {
      label: t("sidebar.lock_screen_now") || "Lock Screen Now",
      onClick: () => dispatch(lockApp()),
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

  // LOCKED CHATS SUB-VIEW
  if (lockedChatsOpen) {
    if (!isLockedChatsFolderUnlocked) {
      return (
        <aside
          className={cn(
            "flex flex-col h-full bg-wa-sidebar border-r border-wa-border select-none transition-colors duration-200",
            className,
          )}
        >
          <LockScreen
            mode="unlock"
            lockType={lockType}
            savedCode={lockType === "pin" ? savedPin : savedPattern}
            onSuccess={() => dispatch(setLockedChatsFolderUnlocked(true))}
            onCancel={() => setLockedChatsOpen(false)}
            title={t("lock.locked_chats") || "Locked Chats"}
          />
        </aside>
      );
    }

    const lockedChats = filteredChats.filter((chat) => lockedChatIds.includes(chat.id));

    return (
      <aside
        className={cn(
          "flex flex-col h-full bg-wa-sidebar border-r border-wa-border select-none transition-colors duration-200",
          className,
        )}
      >
        <header className="flex items-center gap-6 px-4 py-4 bg-wa-primary text-white shrink-0">
          <button
            onClick={() => {
              setLockedChatsOpen(false);
              dispatch(setLockedChatsFolderUnlocked(false)); // auto-lock again on exit
            }}
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
          <span className="font-semibold text-base sm:text-lg">
            {t("lock.locked_chats") || "Locked Chats"}
          </span>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden bg-wa-sidebar transition-colors duration-200">
          {lockedChats.length > 0 ? (
            lockedChats.map((chat) => <ChatCard key={chat.id} chat={chat} />)
          ) : (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center text-wa-muted select-none">
              <span className="text-xs sm:text-sm font-medium">
                {t("lock.no_locked_chats_desc") || "No locked chats. Lock a chat from its contact profile."}
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
            uid={user?.id}
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

      {/* Locked Chats Folder Banner */}
      {lockedChatIds.length > 0 && (
        <div
          onClick={() => setLockedChatsOpen(true)}
          className="flex items-center justify-between px-4 py-3 hover:bg-wa-hover cursor-pointer border-b border-wa-border/40 select-none group transition-colors duration-150 shrink-0"
        >
          <div className="flex items-center gap-3">
            <span className="text-wa-primary flex items-center justify-center">
              <Lock className="h-5 w-5 text-wa-primary" />
            </span>
            <span className="font-semibold text-sm sm:text-base text-wa-text">
              {t("lock.locked_chats") || "Locked Chats"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-wa-primary font-semibold bg-wa-primary/10 px-2 py-0.5 rounded-full">
              {lockedChatIds.length}
            </span>
          </div>
        </div>
      )}

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
      <ProfileModal
        isOpen={profileModal}
        onClose={() => setProfileModal(false)}
        user={user}
        profileMessage={profileMessage}
        isUpdatingProfile={isUpdatingProfile}
        editingName={editingName}
        setEditingName={setEditingName}
        tempName={tempName}
        setTempName={setTempName}
        editingStatus={editingStatus}
        setEditingStatus={setEditingStatus}
        tempStatus={tempStatus}
        setTempStatus={setTempStatus}
        handleProfileAvatarSelectChange={handleProfileAvatarSelectChange}
        handleRemoveAvatarImage={handleRemoveAvatarImage}
        handleSaveName={handleSaveName}
        handleSaveStatus={handleSaveStatus}
        profileFileInputRef={profileFileInputRef}
      />

      <NewChatModal
        isOpen={newChatModal}
        onClose={() => setNewChatModal(false)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userSearchQuery={userSearchQuery}
        setUserSearchQuery={setUserSearchQuery}
        isSearching={isSearching}
        searchResults={searchResults}
        handleStartDirectChat={handleStartDirectChat}
        groupName={groupName}
        setGroupName={setGroupName}
        groupAvatar={groupAvatar}
        handleRandomGroupAvatar={handleRandomGroupAvatar}
        selectedMembers={selectedMembers}
        toggleMemberSelection={toggleMemberSelection}
        handleCreateGroup={handleCreateGroup}
        onlineMap={onlineMap}
      />

      <LinkedDevicesModal
        isOpen={linkedDevicesModalOpen}
        onClose={() => setLinkedDevicesModalOpen(false)}
        activeDevices={activeDevices}
        handleLogoutDevice={handleLogoutDevice}
        handleLogoutAllDevices={handleLogoutAllDevices}
        handleLogoutAllIncludingCurrent={handleLogoutAllIncludingCurrent}
      />

      <LanguageModal
        isOpen={languageModalOpen}
        onClose={() => setLanguageModalOpen(false)}
        availableLanguages={availableLanguages}
        locale={locale}
        languageNames={languageNames}
        changeLanguage={changeLanguage}
      />

      <LockSettingsModal
        isOpen={lockSettingsOpen}
        onClose={() => setLockSettingsOpen(false)}
      />
    </aside>
  );
}
