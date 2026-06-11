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
import { ThemeToggle } from "../ui/ThemeToggle";
import { SearchBar } from "./SearchBar";
import { ChatCard } from "./ChatCard";
import { NewChatModal } from "./NewChatModal";
import { LockScreen } from "../Lock/LockScreen";
import { useAppDispatch, useAppSelector } from "../../hooks/useRedux";
import { useTranslation } from "../../hooks/useTranslation";
import {
  setArchivedViewOpen,
  setSettingsViewOpen,
} from "../../redux/slices/uiSlice";
import { setStatusViewOpen } from "../../redux/slices/statusSlice";
import {
  lockApp,
  setLockedChatsFolderUnlocked,
} from "../../redux/slices/lockSlice";
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
import { messageService } from "../../services/messageService";
import { storageService } from "../../services/storageService";
import { supabase } from "../../lib/supabaseClient";
import { cn } from "../../utils/cn";
import { formatSidebarDate } from "../../utils/dateUtils";

export function Sidebar({ className }) {
  const dispatch = useAppDispatch();
  const { t, locale, changeLanguage, availableLanguages, languageNames } =
    useTranslation();
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

  const [lockedChatsOpen, setLockedChatsOpen] = useState(false);

  const chatsRef = useRef(chats);
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  const [isChatsLoading, setIsChatsLoading] = useState(true);
  const [newChatModal, setNewChatModal] = useState(false);
  const [activeTab, setActiveTab] = useState("direct"); // 'direct' | 'group'

  // Direct chat search states
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchPage, setSearchPage] = useState(0);
  const [hasMoreSearch, setHasMoreSearch] = useState(true);
  const [isSearchingMore, setIsSearchingMore] = useState(false);

  // Group creation states
  const [groupName, setGroupName] = useState("");
  const [groupAvatar, setGroupAvatar] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);

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
        chatService
          .getUserChats(user.id)
          .then((fetchedChats) => {
            const chatsList = fetchedChats || [];
            dispatch(setChats(chatsList));

            // Cache the fresh chats in localStorage
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem(
                  `wa_cached_chats_${user.id}`,
                  JSON.stringify(chatsList),
                );
              } catch (e) {
                console.warn("Failed to cache chats:", e);
              }
            }

            // Batch acknowledge delivery for all active sidebar conversations at once
            if (chatsList.length > 0) {
              messageService.syncAllPendingDeliveries(user.id).catch((err) => {
                console.warn("Failed syncing pending deliveries:", err);
              });
            }
            setIsChatsLoading(false);
          })
          .catch((err) => {
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
          const { indexedDBService } =
            await import("../../services/indexedDBService");
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
              const textChanged =
                updatedConv.last_message_text !== existing.lastMessage?.text;
              const timestampChanged =
                updatedConv.last_message_timestamp !==
                existing.lastMessage?.timestamp;
              const statusChanged =
                updatedConv.last_message_status !==
                existing.lastMessage?.status;

              if (textChanged || timestampChanged) {
                // New message arrived — full update with re-sort
                dispatch(
                  updateLastMessage({
                    chatId: updatedConv.id,
                    text: updatedConv.last_message_text,
                    timestamp: updatedConv.last_message_timestamp,
                    isOutgoing: updatedConv.last_message_sender_id === user.id,
                    status: updatedConv.last_message_status,
                  }),
                );
              } else if (statusChanged) {
                // Status-only change (sent → delivered → read) — update status in-place without re-sort
                const isMine = updatedConv.last_message_sender_id === user.id;
                dispatch(
                  updateLastMessage({
                    chatId: updatedConv.id,
                    text: existing.lastMessage?.text,
                    timestamp: existing.lastMessage?.timestamp,
                    isOutgoing: isMine,
                    status: updatedConv.last_message_status,
                    updatedAt: existing.updatedAt, // preserve existing updatedAt to prevent re-sort
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

  // Handle debounced platform user profile searching
  useEffect(() => {
    if (!newChatModal) return;
    const timer = setTimeout(() => {
      setIsSearching(true);
      setSearchPage(0);
      setHasMoreSearch(true);
      profileService
        .searchProfiles(userSearchQuery, user?.id, 0)
        .then((res) => {
          setSearchResults(res);
          setIsSearching(false);
          if (res.length < 20) {
            setHasMoreSearch(false);
          }
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [userSearchQuery, user?.id, newChatModal]);

  const handleLoadMoreProfiles = () => {
    if (isSearching || isSearchingMore || !hasMoreSearch || !user?.id) return;
    setIsSearchingMore(true);
    const nextPage = searchPage + 1;
    profileService
      .searchProfiles(userSearchQuery, user.id, nextPage)
      .then((res) => {
        setSearchResults((prev) => [...prev, ...res]);
        setSearchPage(nextPage);
        setIsSearchingMore(false);
        if (res.length < 20) {
          setHasMoreSearch(false);
        }
      })
      .catch(() => {
        setIsSearchingMore(false);
      });
  };

  const [visibleLimit, setVisibleLimit] = useState(15);

  useEffect(() => {
    setVisibleLimit(15);
  }, [searchQuery]);

  const filteredChats = chats.filter((chat) =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const activeChats = filteredChats.filter(
    (chat) => !chat.isArchived && !lockedChatIds.includes(chat.id),
  );
  const archivedChats = filteredChats.filter((chat) => chat.isArchived);

  const renderedChats = activeChats.slice(0, visibleLimit);
  const dropdownItems = [
    {
      label: t("sidebar.settings") || "Settings",
      onClick: () => {
        console.log("Settings dropdown option clicked");
        dispatch(setSettingsViewOpen(true));
      },
    },
    {
      label: t("sidebar.lock_screen_now") || "Lock Screen Now",
      onClick: () => dispatch(lockApp()),
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
          <span className="font-semibold text-base sm:text-lg">
            {t("sidebar.archived")}
          </span>
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

    const lockedChats = filteredChats.filter((chat) =>
      lockedChatIds.includes(chat.id),
    );

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
                {t("lock.no_locked_chats_desc") ||
                  "No locked chats. Lock a chat from its contact profile."}
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
      <header className="relative z-20 flex items-center justify-between px-4 py-2.5 bg-wa-header transition-colors duration-200 shrink-0">
        <div
          onClick={() => dispatch(setSettingsViewOpen(true))}
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
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden bg-wa-sidebar transition-colors duration-200"
        onScroll={(e) => {
          const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
          if (scrollHeight - scrollTop - clientHeight < 50) {
            setVisibleLimit((prev) => prev + 15);
          }
        }}
      >
        {isChatsLoading ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center select-none h-full gap-4">
            <div className="animate-spin text-wa-primary flex items-center justify-center">
              <svg
                className="h-9 w-9 text-wa-primary"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-20"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  className="opacity-85"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
            <span className="text-xs sm:text-sm text-wa-muted font-medium tracking-wide animate-pulse">
              {t("sidebar.loading_chats")}
            </span>
          </div>
        ) : activeChats.length > 0 ? (
          renderedChats.map((chat) => <ChatCard key={chat.id} chat={chat} />)
        ) : (
          <div className="p-6 text-center text-xs sm:text-sm text-wa-muted">
            {t("sidebar.no_chats", { query: searchQuery })}
          </div>
        )}
      </div>

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
        onLoadMore={handleLoadMoreProfiles}
        hasMore={hasMoreSearch}
        isSearchingMore={isSearchingMore}
      />
    </aside>
  );
}
