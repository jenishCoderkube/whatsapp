"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Search,
  MoreVertical,
  ArrowLeft,
  Video,
  Phone,
  UserPlus,
  LogOut,
  Trash2,
  Loader2,
  Check,
  Upload,
  Download,
  X,
  Clock,
} from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Dropdown } from "../ui/Dropdown";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { useAppDispatch, useAppSelector } from "../../hooks/useRedux";
import {
  setMobileScreen,
  setActiveSearchPanelOpen,
  setWallpaperModal,
} from "../../redux/slices/uiSlice";
import {
  clearUnread,
  setActiveChat,
  removeChat,
  deleteDraft,
  updateChatAvatar,
  updateChatDisappearingDuration,
} from "../../redux/slices/chatSlice";
import { chatService } from "../../services/chatService";
import { profileService } from "../../services/profileService";
import { storageService } from "../../services/storageService";
import { supabase } from "../../lib/supabaseClient";
import { cn } from "../../utils/cn";
import { useVoiceCall } from "../../hooks/useVoiceCall";
import { useTranslation } from "../../hooks/useTranslation";
import { LockScreen } from "../Lock/LockScreen";
import {
  lockChat,
  unlockChat,
  authorizeChat,
  setLockConfiguration,
  setAppLockEnabled,
} from "../../redux/slices/lockSlice";

function MarqueeText({ text, className }) {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const [scrollAmount, setScrollAmount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);

    const observer = new ResizeObserver(() => {
      const container = containerRef.current;
      const textEl = textRef.current;
      if (container && textEl) {
        const overflowWidth = textEl.scrollWidth - container.clientWidth;
        setScrollAmount(overflowWidth > 0 ? overflowWidth : 0);
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener("resize", checkMobile);
      observer.disconnect();
    };
  }, [text]);

  const shouldScroll = isMobile && scrollAmount > 0;

  const style = shouldScroll
    ? {
        "--scroll-amount": `${scrollAmount}px`,
        animation: `waHeaderMarquee ${scrollAmount * 0.05 + 4}s linear infinite alternate`,
        display: "inline-block",
        paddingRight: "24px",
      }
    : {};

  return (
    <div
      ref={containerRef}
      className={cn("w-full overflow-hidden whitespace-nowrap", className)}
    >
      <span
        ref={textRef}
        style={style}
        className={cn("inline-block", !shouldScroll && "truncate max-w-full")}
      >
        {text}
      </span>
    </div>
  );
}

export function ChatHeader() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const chats = useAppSelector((state) => state.chat.chats);
  const activeChatId = useAppSelector((state) => state.chat.activeChatId);
  const messagesDict = useAppSelector((state) => state.message.messages);
  const typingMap = useAppSelector(
    (state) => state.chat.typingMap[activeChatId] || {},
  );
  const user = useAppSelector((state) => state.auth.user);
  const currentUserId = user?.id;

  const activeChat = chats.find((c) => c.id === activeChatId);
  const activeMessages = activeChatId ? messagesDict[activeChatId] || [] : [];

  const sharedMedia = useMemo(() => {
    return activeMessages.filter(
      (m) => (m.type === "image" || m.type === "video") && m.mediaUrl,
    );
  }, [activeMessages]);

  const [infoModal, setInfoModal] = useState(false);
  const [lightboxMedia, setLightboxMedia] = useState(null);

  // Chat Lock States & Dialogs
  const {
    lockedChatIds,
    savedPin,
    savedPattern,
    lockType,
  } = useAppSelector((state) => state.lock);

  const [showLockVerifyModal, setShowLockVerifyModal] = useState(false);
  const [showLockSetupModal, setShowLockSetupModal] = useState(false);
  const [lockActionType, setLockActionType] = useState("lock"); // 'lock' | 'unlock'

  // Group Management States
  const [groupMembers, setGroupMembers] = useState([]);
  const [isFetchingMembers, setIsFetchingMembers] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isActionPending, setIsActionPending] = useState(false);
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);

  const groupAvatarFileInputRef = useRef(null);

  const { startCall } = useVoiceCall();
  const isChatLocked = activeChat ? lockedChatIds.includes(activeChat.id) : false;

  const handleToggleChatLock = () => {
    if (isChatLocked) {
      setLockActionType("unlock");
      setShowLockVerifyModal(true);
    } else {
      if (!savedPin && !savedPattern) {
        setShowLockSetupModal(true);
      } else {
        setLockActionType("lock");
        setShowLockVerifyModal(true);
      }
    }
  };

  const handleLockVerifySuccess = () => {
    setShowLockVerifyModal(false);
    if (lockActionType === "lock") {
      dispatch(lockChat(activeChat.id));
      dispatch(authorizeChat(activeChat.id));
    } else {
      dispatch(unlockChat(activeChat.id));
    }
  };

  const handleLockSetupSuccess = (code) => {
    setShowLockSetupModal(false);
    dispatch(setLockConfiguration({ type: "pin", pin: code }));
    dispatch(setAppLockEnabled(true));
    dispatch(lockChat(activeChat.id));
    dispatch(authorizeChat(activeChat.id));
  };

  const [isUpdatingDuration, setIsUpdatingDuration] = useState(false);

  const handleUpdateDisappearingDuration = async (duration) => {
    if (!activeChatId || !currentUserId) return;
    setIsUpdatingDuration(true);
    try {
      await chatService.updateDisappearingDuration(
        activeChatId,
        duration,
        currentUserId,
      );
      dispatch(
        updateChatDisappearingDuration({
          chatId: activeChatId,
          disappearingDuration: duration,
        }),
      );
    } catch (err) {
      console.error("Failed to update disappearing duration:", err);
      alert(t("chat.disappearing_messages_failed") || "Failed to update disappearing messages setting.");
    } finally {
      setIsUpdatingDuration(false);
    }
  };

  const handleVoiceCallTrigger = () => {
    if (activeChat && !activeChat.isGroup) {
      startCall(
        {
          id: activeChat.peerId,
          name: activeChat.name,
          avatar: activeChat.avatar,
        },
        activeChat.id,
      );
    } else {
      alert(t("call.group_voice_coming_soon") || "Voice calling for groups is coming soon!");
    }
  };

  const handleVideoCallTrigger = () => {
    if (activeChat && !activeChat.isGroup) {
      startCall(
        {
          id: activeChat.peerId,
          name: activeChat.name,
          avatar: activeChat.avatar,
        },
        activeChat.id,
        "video",
      );
    } else {
      alert(t("call.group_video_coming_soon") || "Video calling for groups is coming soon!");
    }
  };

  useEffect(() => {
    if (infoModal && activeChat?.isGroup) {
      fetchMembers();
    }
  }, [infoModal, activeChatId]);

  const fetchMembers = async () => {
    if (!activeChatId) return;
    setIsFetchingMembers(true);
    try {
      const members = await chatService.getGroupMembers(activeChatId);
      setGroupMembers(members);
    } catch (e) {
      console.warn("Fetch members failed", e);
    } finally {
      setIsFetchingMembers(false);
    }
  };

  const handleGroupAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeChatId) return;

    setIsUpdatingAvatar(true);
    try {
      const uploadedUrl = await storageService.uploadFile(file, "avatars");
      await chatService.updateGroupAvatar(activeChatId, uploadedUrl);
      dispatch(updateChatAvatar({ chatId: activeChatId, avatar: uploadedUrl }));
    } catch (err) {
      console.error("Failed to update group avatar:", err);
      alert(t("chat.group_avatar_failed") || "Failed to update group avatar.");
    } finally {
      setIsUpdatingAvatar(false);
      if (e.target) e.target.value = "";
    }
  };

  // Debounced search for adding members
  useEffect(() => {
    if (!showAddMember) return;
    const timer = setTimeout(() => {
      setIsSearching(true);
      profileService
        .searchProfiles(userSearchQuery, currentUserId)
        .then((res) => {
          // Filter out existing members
          const filtered = res.filter(
            (p) => !groupMembers.some((m) => m.id === p.id),
          );
          setSearchResults(filtered);
          setIsSearching(false);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearchQuery, showAddMember, groupMembers]);

  if (!activeChat) return null;

  const isAdmin = activeChat.groupCreatorId === currentUserId;

  // Realtime membership sync
  useEffect(() => {
    if (!activeChatId) return;

    const channel = supabase
      .channel(`members-${activeChatId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_members",
          filter: `conversation_id=eq.${activeChatId}`,
        },
        () => {
          fetchMembers();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChatId]);

  const handleAddMember = async (targetId) => {
    setIsActionPending(true);
    try {
      await chatService.addGroupMembers(
        activeChatId,
        [targetId],
        currentUserId,
      );
      await fetchMembers();
      setShowAddMember(false);
    } catch (e) {
      alert(t("chat.add_member_failed") || "Failed to add member");
    } finally {
      setIsActionPending(false);
    }
  };

  const handleRemoveMember = async (targetId) => {
    if (!window.confirm(t("chat.remove_member_confirm") || "Are you sure you want to remove this member?")) return;
    setIsActionPending(true);
    try {
      await chatService.removeGroupMember(
        activeChatId,
        targetId,
        currentUserId,
      );
      await fetchMembers();
    } catch (e) {
      alert(t("chat.remove_member_failed") || "Failed to remove member");
    } finally {
      setIsActionPending(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!window.confirm(t("chat.leave_group_confirm") || "Are you sure you want to leave this group?")) return;
    setIsActionPending(true);
    try {
      await chatService.leaveGroup(activeChatId, currentUserId);
      dispatch(removeChat(activeChatId));
      dispatch(setActiveChat(null));
      setInfoModal(false);
    } catch (e) {
      alert(t("chat.leave_group_failed") || "Failed to leave group");
    } finally {
      setIsActionPending(false);
    }
  };

  const handleDeleteChat = async () => {
    const confirmMsg = activeChat.isGroup
      ? t("chat.delete_group_confirm") || "Are you sure you want to delete this group? You will lose all message history."
      : t("chat.delete_chat_confirm") || "Are you sure you want to delete this chat? You will lose all message history.";

    if (window.confirm(confirmMsg)) {
      try {
        const chatId = activeChat.id;
        await chatService.deleteChat(chatId, currentUserId);

        dispatch(setMobileScreen("list"));
        dispatch(setActiveChat(null));
        dispatch(removeChat(chatId));
        dispatch(deleteDraft(chatId));
        setInfoModal(false);
      } catch (err) {
        console.error("Failed to delete chat:", err);
        if (err.message === "RLS_DELETE_BLOCKED") {
          alert("Failed to delete chat from database: Row Level Security (RLS) policy for DELETE is missing on conversation_members. Please execute the policy update in your Supabase SQL Editor:\n\nALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;\n\nCREATE POLICY \"Members can delete their memberships\" ON public.conversation_members FOR DELETE USING (user_id = auth.uid());");
        } else {
          alert("Failed to delete chat. Please check your network connection and try again.");
        }
      }
    }
  };

  // Check if any remote peer is dynamically typing inside this view channel
  const isPeerTyping = Object.keys(typingMap).some(
    (uid) => uid !== currentUserId,
  );
  const typingNames = Object.entries(typingMap)
    .filter(([uid]) => uid !== currentUserId)
    .map(([_, name]) => (typeof name === "string" ? name : "Someone"));

  const typingText =
    typingNames.length > 1
      ? (t("chat.multiple_typing", { names: typingNames.join(", ") }) || `${typingNames.join(", ")} are typing...`)
      : (t("chat.one_typing", { name: typingNames[0] }) || `${typingNames[0]} is typing...`);

  const formatLastSeen = (timestamp) => {
    if (!timestamp) return activeChat.phoneNumber;
    const date = new Date(timestamp);
    const now = new Date();

    const isToday = date.toDateString() === now.toDateString();

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const timeStr = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    if (isToday) {
      return t("chat.last_seen_today", { time: timeStr }) || `last seen today at ${timeStr}`;
    } else if (isYesterday) {
      return t("chat.last_seen_yesterday", { time: timeStr }) || `last seen yesterday at ${timeStr}`;
    } else {
      const dateStr = date.toLocaleDateString([], {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      return t("chat.last_seen_datetime", { date: dateStr, time: timeStr }) || `last seen ${dateStr} at ${timeStr}`;
    }
  };

  const renderSubtitle = () => {
    if (activeChat.isGroup) {
      const count =
        groupMembers.length > 0
          ? groupMembers.length
          : activeChat.groupMembersCount || 0;
      return t("chat.participants_count", { count }) || `${count} participants`;
    }
    if (activeChat.online) return t("chat.online") || "Online";
    if (activeChat.lastSeen) return formatLastSeen(activeChat.lastSeen);
    return activeChat.phoneNumber;
  };

  const headerOptions = [
    { label: t("chat.contact_info") || "Contact Info", onClick: () => setInfoModal(true) },
    { label: t("chat.chat_wallpaper") || "Chat Wallpaper", onClick: () => dispatch(setWallpaperModal({ open: true, targetChatId: activeChatId })) },
    { label: t("chat.select_messages") || "Select Messages", onClick: () => {} },
    { label: t("chat.close_chat") || "Close Chat", onClick: () => {
      dispatch(setMobileScreen("list"));
      dispatch(setActiveChat(null));
      dispatch(clearUnread(activeChat.id));
    } },
    { label: t("chat.clear_messages") || "Clear messages", danger: true, onClick: () => {} },
  ];

  if (activeChat.isGroup) {
    if (!activeChat.isLeft) {
      headerOptions.push({
        label: t("chat.exit_group") || "Exit Group",
        danger: true,
        onClick: handleLeaveGroup,
      });
    } else {
      headerOptions.push({
        label: t("chat.delete_group") || "Delete Group",
        danger: true,
        onClick: handleDeleteChat,
      });
    }
  } else {
    headerOptions.push({
      label: t("chat.delete_chat") || "Delete Chat",
      danger: true,
      onClick: handleDeleteChat,
    });
  }

  return (
    <header className="flex items-center justify-between px-4 py-2 bg-wa-header border-b border-wa-border select-none z-[60] shrink-0 transition-colors duration-200">
      <div className="flex items-center gap-3 min-w-0">
        {/* Back navigation support on mobile viewports */}
        <button
          onClick={() => {
            dispatch(setMobileScreen("list"));
            dispatch(setActiveChat(null));
            dispatch(clearUnread(activeChat.id));
          }}
          className="md:hidden block p-1 -ml-1 rounded-full text-wa-muted hover:bg-wa-active transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div
          onClick={() => setInfoModal(true)}
          className="cursor-pointer shrink-0 relative group"
        >
          <Avatar
            src={activeChat.avatar}
            fallback={activeChat.name[0]}
            isOnline={activeChat.online}
            size="md"
            uid={activeChat.isGroup ? activeChat.id : activeChat.peerId}
          />
          {activeChat.disappearingDuration > 0 && (
            <div
              className="absolute -bottom-1 -right-1 bg-wa-header rounded-full p-0.5 border border-wa-border shadow-xs z-10"
              title={t("chat.disappearing_messages_active") || "Disappearing messages active"}
            >
              <Clock className="h-3 w-3 text-[#00a884]" />
            </div>
          )}
          {activeChat.isGroup && isAdmin && !activeChat.isLeft && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                groupAvatarFileInputRef.current?.click();
              }}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity text-white cursor-pointer"
              title={t("chat.change_group_icon") || "Change Group Icon"}
            >
              <Upload className="h-3 w-3" />
            </div>
          )}
        </div>

        <div
          onClick={() => setInfoModal(true)}
          className="flex-1 min-w-0 cursor-pointer overflow-hidden"
        >
          <MarqueeText
            text={activeChat.name}
            className="text-sm sm:text-base font-medium text-wa-text"
          />
          {isPeerTyping ? (
            <MarqueeText
              text={typingText}
              className="text-xs text-wa-primary font-medium italic animate-pulse"
            />
          ) : (
            <MarqueeText
              text={renderSubtitle()}
              className="text-xs text-wa-muted capitalize-first"
            />
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 text-wa-muted">
        {/* Mobile: Unified Call Dropdown */}
        <div className="sm:hidden block">
          <Dropdown
            trigger={
              <button className="p-2 rounded-full hover:bg-wa-active transition-colors">
                <Phone className="h-4 w-4" />
              </button>
            }
            items={[
              {
                label: t("call.voice_call") || "Voice Call",
                icon: <Phone className="h-3.5 w-3.5" />,
                onClick: handleVoiceCallTrigger,
              },
              {
                label: t("call.video_call") || "Video Call",
                icon: <Video className="h-3.5 w-3.5" />,
                onClick: handleVideoCallTrigger,
              },
            ]}
          />
        </div>

        {/* Desktop: Separate Buttons */}
        <button
          onClick={handleVoiceCallTrigger}
          className="p-2 rounded-full hover:bg-wa-active transition-colors hidden sm:inline-flex"
          title={t("call.voice_call") || "Voice Call"}
        >
          <Phone className="h-4 w-4" />
        </button>

        <button
          onClick={handleVideoCallTrigger}
          className="p-2 rounded-full hover:bg-wa-active transition-colors hidden sm:inline-flex"
          title={t("call.video_call") || "Video Call"}
        >
          <Video className="h-4 w-4" />
        </button>

        <button
          onClick={() => dispatch(setActiveSearchPanelOpen(true))}
          className="p-2 rounded-full hover:bg-wa-active transition-colors"
          title={t("chat.search_messages") || "Search Messages"}
        >
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
      <Modal
        isOpen={infoModal}
        onClose={() => {
          setInfoModal(false);
          setShowAddMember(false);
        }}
        title={activeChat.isGroup ? (t("chat.group_info") || "Group info") : (t("chat.contact_info") || "Contact info")}
        className="md:max-w-3xl"
      >
        <div className="flex flex-col md:flex-row md:items-stretch gap-6 max-h-[75vh] overflow-y-auto md:overflow-hidden pr-1">
          {/* Left Side: Avatar & Identity */}
          <div className="flex flex-col items-center text-center md:w-5/12 md:border-r md:border-wa-border md:pr-6 overflow-y-visible md:overflow-y-auto py-2 shrink-0">
            <input
              type="file"
              ref={groupAvatarFileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleGroupAvatarChange}
            />

            <div className="relative group mb-4">
              <Avatar
                src={activeChat.avatar}
                fallback={activeChat.name[0]}
                size="xxl"
                className="shadow-md"
                uid={activeChat.isGroup ? activeChat.id : activeChat.peerId}
              />
              {activeChat.isGroup && isAdmin && !activeChat.isLeft && (
                <div
                  onClick={() => groupAvatarFileInputRef.current?.click()}
                  className="absolute inset-0 flex flex-col items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity text-white text-center cursor-pointer p-4 border-2 border-transparent hover:border-wa-primary/50"
                >
                  <Upload className="h-6 w-6 mb-1" />
                  <span className="text-[10px] font-bold leading-tight">
                    {t("chat.change_group_icon_upper") || "CHANGE GROUP ICON"}
                  </span>
                </div>
              )}
              {isUpdatingAvatar && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-wa-modal/80 backdrop-blur-xs z-10">
                  <Loader2 className="h-8 w-8 text-wa-primary animate-spin" />
                </div>
              )}
            </div>

            <h3 className="text-lg font-semibold text-wa-text">
              {activeChat.name}
            </h3>
            <p className="text-xs text-wa-primary font-medium mt-1 capitalize-first">
              {renderSubtitle()}
            </p>

            <div className="w-full mt-6 pt-4 border-t border-wa-border flex flex-col gap-2 text-left">
              <span className="text-xs text-wa-muted font-bold uppercase tracking-wider">
                {activeChat.isGroup ? (t("chat.description") || "Description") : (t("chat.details") || "Details")}
              </span>
              <span className="text-sm font-medium text-wa-text break-words">
                {activeChat.isGroup
                  ? activeChat.description || (t("chat.no_description") || "No group description provided.")
                  : activeChat.phoneNumber}
              </span>
            </div>

            <div className="w-full mt-4 pt-4 border-t border-wa-border flex flex-col gap-2 text-left">
              <span className="text-xs text-wa-muted font-bold uppercase tracking-wider">
                {t("chat.encryption") || "Encryption"}
              </span>
              <p className="text-[11px] leading-relaxed text-wa-muted">
                {t("chat.encryption_desc") || "Messages and calls are end-to-end encrypted. No one outside of this chat can read or listen to them."}
              </p>
            </div>

            {/* Chat Lock Switch */}
            <div className="w-full mt-4 pt-4 border-t border-wa-border flex flex-col gap-2 text-left">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1 pr-4">
                  <span className="text-xs text-wa-muted font-bold uppercase tracking-wider">
                    {t("lock.chat_lock") || "Chat Lock"}
                  </span>
                  <p className="text-[11px] leading-relaxed text-wa-muted">
                    {t("lock.chat_lock_desc") || "Lock and hide this chat on this device."}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                  <input
                    type="checkbox"
                    checked={isChatLocked}
                    onChange={handleToggleChatLock}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-wa-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-wa-muted peer-checked:after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-wa-primary"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Right Side: Participants Management */}
          <div className="flex-1 flex flex-col min-w-0 overflow-visible md:overflow-hidden">
            {activeChat.isGroup ? (
              <div className="flex flex-col h-auto md:h-full relative min-h-[300px] md:min-h-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-wa-muted uppercase font-bold tracking-tighter">
                    {t("chat.participants_count", { count: groupMembers.length }) || `${groupMembers.length} Participants`}
                  </span>
                  {!activeChat.isLeft && isAdmin && (
                    <button
                      onClick={() => setShowAddMember(true)}
                      className="flex items-center gap-1.5 text-wa-primary text-xs font-semibold hover:bg-wa-active px-2.5 py-1.5 rounded-md transition-all border border-wa-primary/20"
                    >
                      <UserPlus className="h-4 w-4" />
                      {t("chat.add_member") || "Add Member"}
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-visible md:overflow-y-auto pr-1 custom-scrollbar">
                  {isFetchingMembers ? (
                    <div className="py-8 text-center text-xs text-wa-muted flex flex-col items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-wa-primary" />
                      {t("chat.loading_participants") || "Loading participants..."}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {groupMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-wa-hover group transition-all border border-transparent hover:border-wa-border/30"
                        >
                          <Avatar
                            src={member.avatar}
                            fallback={member.name[0]}
                            size="md"
                            uid={member.id}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-wa-text truncate flex items-center gap-2">
                              {member.name}
                              {member.id === currentUserId && (
                                <span className="bg-wa-active text-wa-muted text-[9px] px-1.5 py-0.5 rounded-full uppercase font-bold tracking-tighter">
                                  {t("chat.you") || "You"}
                                </span>
                              )}
                              {member.id === activeChat.groupCreatorId && (
                                <span className="bg-wa-primary/10 text-wa-primary text-[9px] px-1.5 py-0.5 rounded-full uppercase font-bold tracking-tighter border border-wa-primary/20">
                                  {t("chat.admin") || "Admin"}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-wa-muted truncate">
                              {member.status || (t("chat.available") || "Available")}
                            </div>
                          </div>

                          {isAdmin &&
                            member.id !== currentUserId &&
                            !activeChat.isLeft && (
                              <button
                                onClick={() => handleRemoveMember(member.id)}
                                className="opacity-0 group-hover:opacity-100 p-2 rounded-full text-red-500 hover:bg-red-50 transition-all cursor-pointer shadow-sm bg-white dark:bg-wa-sidebar"
                                title={t("chat.remove_from_group") || "Remove from group"}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                        </div>
                      ))}
                    </div>
                  )}

                  {sharedMedia.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-wa-border">
                      <span className="text-xs text-wa-muted uppercase font-bold tracking-widest mb-2 block">
                        {t("chat.shared_media") || "Shared Media"}
                      </span>
                      <div className="grid grid-cols-4 gap-1.5">
                        {sharedMedia.map((msg) => (
                          <div
                            key={msg.id}
                            onClick={() => setLightboxMedia(msg)}
                            className="aspect-square bg-wa-border rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                          >
                            {msg.type === "image" ? (
                              <img
                                src={msg.mediaUrl}
                                alt="Media"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <video
                                src={msg.mediaUrl}
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {!activeChat.isLeft && (
                  <div className="mt-4 pt-4 border-t border-wa-border">
                    <button
                      onClick={handleLeaveGroup}
                      className="flex items-center justify-center gap-2 text-red-500 text-sm font-bold hover:bg-red-50 w-full py-3 rounded-xl transition-all border border-red-100/50 hover:border-red-200"
                    >
                      <LogOut className="h-4 w-4" />
                      {t("chat.exit_group") || "Exit Group"}
                    </button>
                  </div>
                )}

                {/* Add Member Overlay Layer */}
                {showAddMember && (
                  <div className="absolute inset-0 bg-wa-modal z-20 animate-scale-up flex flex-col p-0">
                    <div className="flex items-center gap-3 mb-4 p-1">
                      <button
                        onClick={() => setShowAddMember(false)}
                        className="p-2 hover:bg-wa-active rounded-full transition-colors"
                      >
                        <ArrowLeft className="h-5 w-5" />
                      </button>
                      <div className="flex flex-col">
                        <span className="text-base font-bold text-wa-text">
                          {t("chat.add_participant") || "Add Participant"}
                        </span>
                        <span className="text-[10px] text-wa-muted uppercase tracking-widest">
                          {t("chat.select_from_contacts") || "Select from contacts"}
                        </span>
                      </div>
                    </div>

                    <div className="relative mb-4 px-1">
                      <Input
                        placeholder={t("chat.search_users") || "Search users..."}
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        className="h-10 text-sm pl-10 rounded-xl"
                        autoFocus
                      />
                      <Search className="absolute left-4 top-3 h-4 w-4 text-wa-muted" />
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1">
                      {isSearching ? (
                        <div className="text-center py-8 text-xs text-wa-muted flex flex-col items-center gap-2">
                          <Loader2 className="h-6 w-6 animate-spin text-wa-primary" />
                          {t("chat.scanning_directory") || "Scanning directory..."}
                        </div>
                      ) : searchResults.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {searchResults.map((p) => (
                            <div
                              key={p.id}
                              onClick={() => handleAddMember(p.id)}
                              className="flex items-center gap-3 p-3 rounded-xl hover:bg-wa-hover cursor-pointer transition-all border border-transparent hover:border-wa-border/50 group"
                            >
                              <Avatar
                                src={p.avatar}
                                fallback={p.name[0]}
                                size="md"
                                uid={p.id}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-wa-text truncate">
                                  {p.name}
                                </div>
                                <div className="text-[11px] text-wa-muted truncate">
                                  {p.email}
                                </div>
                              </div>
                              <div className="p-1.5 rounded-full bg-wa-primary/10 text-wa-primary opacity-0 group-hover:opacity-100 transition-opacity">
                                <UserPlus className="h-4 w-4" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12 text-sm text-wa-muted italic">
                          {t("chat.no_users_found") || "No users found matching your search."}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Contact Detail view for 1-to-1 chats */
              <div className="flex flex-col gap-4 py-2 h-auto md:h-full overflow-y-visible md:overflow-y-auto custom-scrollbar pr-1">
                <div className="bg-wa-header/30 p-4 rounded-xl border border-wa-border/50 shrink-0">
                  <span className="text-xs text-wa-muted uppercase font-bold tracking-widest mb-2 block">
                    {t("chat.personal_status") || "Personal Status"}
                  </span>
                  <p className="text-sm text-wa-text leading-relaxed">
                    {activeChat.status || (t("chat.available") || "Available")}
                  </p>
                </div>

                <div className="bg-wa-header/30 p-4 rounded-xl border border-wa-border/50 shrink-0">
                  <span className="text-xs text-wa-muted uppercase font-bold tracking-widest mb-2 block">
                    {t("chat.shared_media") || "Shared Media"}
                  </span>
                  {sharedMedia.length > 0 ? (
                    <div className="grid grid-cols-4 gap-2">
                      {sharedMedia.map((msg) => (
                        <div
                          key={msg.id}
                          onClick={() => setLightboxMedia(msg)}
                          className="aspect-square bg-wa-border rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                        >
                          {msg.type === "image" ? (
                            <img
                              src={msg.mediaUrl}
                              alt="Media"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <video
                              src={msg.mediaUrl}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-xs text-wa-muted italic">
                      {t("chat.no_media_shared") || "No media shared yet"}
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="w-full mt-4 pt-4 border-t border-wa-border flex flex-col gap-2 text-left">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-wa-muted" />
                <span className="text-xs text-wa-muted font-bold uppercase tracking-wider">
                  {t("chat.disappearing_messages") || "Disappearing messages"}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-wa-muted font-normal leading-normal">
                {t("chat.disappearing_messages_desc") || "For more privacy and storage, new messages will disappear from this chat for everyone after the selected duration."}
              </p>
              <div className="flex items-center gap-1 mt-1 bg-wa-hover/40 border border-wa-border/30 rounded-lg p-1 relative">
                {[
                  { label: t("chat.off") || "Off", value: 0 },
                  { label: "24h", value: 86400 },
                  { label: "7d", value: 604800 },
                  { label: "90d", value: 7776000 },
                ].map((opt) => {
                  const isSelected =
                    (activeChat.disappearingDuration || 0) === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() =>
                        handleUpdateDisappearingDuration(opt.value)
                      }
                      disabled={isUpdatingDuration}
                      className={cn(
                        "flex-1 text-center py-1.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer select-none",
                        isSelected
                          ? "bg-[#00a884] text-white shadow-xs"
                          : "text-wa-muted hover:bg-wa-active hover:text-wa-text",
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
                {isUpdatingDuration && (
                  <div className="absolute inset-0 bg-wa-header/80 backdrop-blur-xs flex items-center justify-center rounded-lg">
                    <Loader2 className="h-4 w-4 text-[#00a884] animate-spin" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Shared Media Lightbox */}
      <Modal
        isOpen={!!lightboxMedia}
        onClose={() => setLightboxMedia(null)}
        title={lightboxMedia?.fileName || (t("chat.media_preview") || "Media Preview")}
        className="max-w-4xl bg-black border-wa-border/20"
      >
        <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-black min-h-[60vh] relative group">
          {lightboxMedia && (
            <>
              {lightboxMedia.type === "image" ? (
                <img
                  src={lightboxMedia.mediaUrl}
                  alt={t("chat.fullscreen") || "Fullscreen"}
                  className="max-h-[75vh] max-w-full object-contain rounded"
                />
              ) : (
                <video
                  src={lightboxMedia.mediaUrl}
                  controls
                  autoPlay
                  className="max-h-[75vh] max-w-full object-contain rounded bg-black"
                />
              )}
              <div className="absolute top-2 right-2 flex gap-2">
                <button
                  onClick={() => window.open(lightboxMedia.mediaUrl, "_blank")}
                  className="p-2 rounded-full bg-black/50 hover:bg-black/80 text-white transition-colors"
                  title={t("chat.download_open_original") || "Download / Open Original"}
                >
                  <Download className="h-5 w-5" />
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Chat Lock Verification Modal */}
      {showLockVerifyModal && (
        <Modal
          isOpen={showLockVerifyModal}
          onClose={() => setShowLockVerifyModal(false)}
          title={lockActionType === "lock" ? (t("lock.lock_chat") || "Lock Chat") : (t("lock.unlock_chat") || "Unlock Chat")}
          className="max-w-2xl w-full"
        >
          <div className="py-2">
            <LockScreen
              layout="modal"
              mode="unlock"
              lockType={lockType}
              savedCode={lockType === "pin" ? savedPin : savedPattern}
              onSuccess={handleLockVerifySuccess}
              onCancel={() => setShowLockVerifyModal(false)}
              title={lockActionType === "lock" ? (t("lock.confirm_to_lock") || "Enter code to lock chat") : (t("lock.confirm_to_unlock") || "Enter code to unlock chat")}
            />
          </div>
        </Modal>
      )}

      {/* Chat Lock Setup Modal */}
      {showLockSetupModal && (
        <Modal
          isOpen={showLockSetupModal}
          onClose={() => setShowLockSetupModal(false)}
          title={t("lock.setup_chat_lock") || "Setup Chat Lock"}
          className="max-w-2xl w-full"
        >
          <div className="py-2">
            <LockScreen
              layout="modal"
              mode="setup"
              lockType="pin"
              onSuccess={handleLockSetupSuccess}
              onCancel={() => setShowLockSetupModal(false)}
              title={t("lock.create_pin_desc") || "Create a PIN to secure locked chats and this application."}
            />
          </div>
        </Modal>
      )}
    </header>
  );
}
