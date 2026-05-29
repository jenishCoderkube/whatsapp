"use client";

import React, { useEffect, useRef, useState, useMemo, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Sidebar } from "../../components/Sidebar/Sidebar";
import { ChatHeader } from "../../components/Chat/ChatHeader";
import { MessageBubble } from "../../components/Chat/MessageBubble";
import { ChatInput } from "../../components/Chat/ChatInput";
import { EmptyState } from "../../components/Chat/EmptyState";
import { useAppDispatch, useAppSelector } from "../../hooks/useRedux";
import { useTranslation } from "../../hooks/useTranslation";
import { setMessages, prependMessages, appendMessages, addMessage, updateMessageStatus, updateMessage, deleteMessage, updateSenderProfile } from "../../redux/slices/messageSlice";
import { updateLastMessage, incrementUnread, setChats, updatePeerProfile, setActiveChat } from "../../redux/slices/chatSlice";
import { setActiveSearchPanelOpen, setMobileScreen, setWallpaperModal, setReplyingMessage, setEditingMessage } from "../../redux/slices/uiSlice";
import { messageService } from "../../services/messageService";
import { chatService } from "../../services/chatService";
import { realtimeService } from "../../services/realtimeService";
import { profileService } from "../../services/profileService";
import { supabase } from "../../lib/supabaseClient";
import { cn } from "../../utils/cn";
import { getChatDateLabel } from "../../utils/dateUtils";
import { ForwardModal } from "../../components/Chat/ForwardModal";
import { MessageSearchPanel } from "../../components/Chat/MessageSearchPanel";
import { StatusPanel } from "../../components/Status/StatusPanel";
import { WallpaperModal } from "../../components/Chat/WallpaperModal";
import { LockScreen } from "../../components/Lock/LockScreen";
import { initializeLock, unlockApp, lockApp, updateLastUnlockedTime, authorizeChat } from "../../redux/slices/lockSlice";

export default function ChatPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const user = useAppSelector((state) => state.auth.user);
  const activeChatId = useAppSelector((state) => state.chat.activeChatId);
  const chats = useAppSelector((state) => state.chat.chats);
  const messagesDict = useAppSelector((state) => state.message.messages);
  const mobileScreen = useAppSelector((state) => state.ui.mobileScreen);
  const activeSearchPanelOpen = useAppSelector((state) => state.ui.activeSearchPanelOpen);
  const statusViewOpen = useAppSelector((state) => state.status.statusViewOpen);
  const globalWallpaper = useAppSelector((state) => state.ui.globalWallpaper);

  // Screen/Chat Lock States
  const {
    isAppLocked,
    isAppLockEnabled,
    lockType,
    savedPin,
    savedPattern,
    autoLockTimeout,
    lastUnlockedTime,
    lockedChatIds,
    authorizedChatIds,
  } = useAppSelector((state) => state.lock);

  // Initialize lock on mount
  useEffect(() => {
    dispatch(initializeLock());
  }, [dispatch]);

  // Track user activity to extend unlock session duration (auto-lock prevention)
  useEffect(() => {
    if (isAppLocked || !isAppLockEnabled) return;

    let timeoutId;
    const handleActivity = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        dispatch(updateLastUnlockedTime());
      }, 1000);
    };

    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("touchstart", handleActivity);
    window.addEventListener("click", handleActivity);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
      window.removeEventListener("click", handleActivity);
    };
  }, [isAppLocked, isAppLockEnabled, dispatch]);

  // Check periodically for idle timeout (auto-locking)
  useEffect(() => {
    if (!isAuthenticated || isAppLocked || !isAppLockEnabled) return;

    const checkTimeout = () => {
      if (lastUnlockedTime && autoLockTimeout > 0) {
        const elapsed = Date.now() - lastUnlockedTime;
        if (elapsed >= autoLockTimeout * 60 * 1000) {
          dispatch(lockApp());
        }
      }
    };

    const intervalId = setInterval(checkTimeout, 5000);
    return () => clearInterval(intervalId);
  }, [isAuthenticated, isAppLocked, isAppLockEnabled, lastUnlockedTime, autoLockTimeout, dispatch]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Don't run shortcuts if the app is locked
      if (isAppLocked) return;

      // Ctrl/Cmd + F to open chat search
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        if (activeChatId) {
          e.preventDefault();
          dispatch(setActiveSearchPanelOpen(true));
        }
      }

      // Esc to close panels, replying, editing message
      if (e.key === "Escape") {
        if (activeSearchPanelOpen) {
          dispatch(setActiveSearchPanelOpen(false));
        }
        dispatch(setReplyingMessage(null));
        dispatch(setEditingMessage(null));
        dispatch(setWallpaperModal({ open: false }));
        setForwardingMsg(null);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [isAppLocked, activeChatId, activeSearchPanelOpen, dispatch]);

  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [hasMoreNewer, setHasMoreNewer] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [localUnreadCount, setLocalUnreadCount] = useState(0);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [forwardingMsg, setForwardingMsg] = useState(null);
  const [groupMembers, setGroupMembers] = useState([]);
  
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const didInitialScrollRef = useRef(false);
  const isAtBottomRef = useRef(true);
  const isSyncingRef = useRef(false);

  // Synchronous React refs supporting un-recreated streaming closure pointers
  const activeChatIdRef = useRef(activeChatId);
  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  const chatsRef = useRef(chats);
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  const groupMembersRef = useRef([]);
  useEffect(() => {
    groupMembersRef.current = groupMembers;
  }, [groupMembers]);

  const mobileScreenRef = useRef(mobileScreen);
  useEffect(() => {
    mobileScreenRef.current = mobileScreen;
  }, [mobileScreen]);

  const messagesDictRef = useRef(messagesDict);
  useEffect(() => {
    messagesDictRef.current = messagesDict;
  }, [messagesDict]);

  const hasMoreNewerRef = useRef(hasMoreNewer);
  useEffect(() => {
    hasMoreNewerRef.current = hasMoreNewer;
  }, [hasMoreNewer]);

  const activeChat = chats.find((c) => c.id === activeChatId);
  const activeMessages = activeChatId ? messagesDict[activeChatId] || [] : [];

  const activeWallpaper = activeChat?.wallpaper || globalWallpaper;

  const wallpaperConfig = useMemo(() => {
    if (!activeWallpaper) return null;
    try {
      if (activeWallpaper.startsWith("{")) {
        return JSON.parse(activeWallpaper);
      }
    } catch (e) {
      console.warn("Parse wallpaper failed", e);
    }
    if (activeWallpaper.startsWith("linear-gradient") || activeWallpaper.startsWith("radial-gradient")) {
      return { type: "gradient", value: activeWallpaper, dim: 0 };
    }
    if (activeWallpaper.startsWith("http") || activeWallpaper.startsWith("url(")) {
      return { type: "gallery", value: activeWallpaper, dim: 0 };
    }
    return { type: "color", value: activeWallpaper, dim: 0 };
  }, [activeWallpaper]);

  const chatBackgroundStyle = useMemo(() => {
    if (!wallpaperConfig) return {};
    const { type, value } = wallpaperConfig;
    if (type === "color") {
      return { backgroundColor: value, backgroundImage: "none" };
    }
    if (type === "gradient") {
      return { backgroundImage: value };
    }
    if (type === "gallery" || type === "upload") {
      return {
        backgroundImage: `url(${value})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      };
    }
    return {};
  }, [wallpaperConfig]);

  const chatBgOverlayStyle = useMemo(() => {
    if (!wallpaperConfig) return {};
    const style = { backgroundColor: "transparent" };
    if (wallpaperConfig.type === "gallery" || wallpaperConfig.type === "upload") {
      style.backgroundImage = "none";
    }
    return style;
  }, [wallpaperConfig]);

  // Grouped messages memoization to prevent expensive re-calculates
  const groupedItems = useMemo(() => {
    const items = [];
    let lastDate = null;
    let currentImageGroup = null;

    let firstUnreadIndex = -1;
    if (activeChat && activeChat.unreadCount > 0) {
      firstUnreadIndex = activeMessages.findIndex(m => !m.isOutgoing && m.status !== "read");
    }

    activeMessages.forEach((msg, idx) => {
      const msgDate = new Date(msg.createdAt || Date.now()).toDateString();
      if (msgDate !== lastDate) {
        if (currentImageGroup) {
          items.push(currentImageGroup);
          currentImageGroup = null;
        }
        items.push({
          type: "date_separator",
          date: msg.createdAt || Date.now(),
          id: `date-${msgDate}-${msg.uiId || msg.id}`,
        });
        lastDate = msgDate;
      }

      if (idx === firstUnreadIndex) {
        if (currentImageGroup) {
          items.push(currentImageGroup);
          currentImageGroup = null;
        }
        items.push({
          type: "unread_separator",
          id: `unread-separator-${msg.uiId || msg.id}`,
        });
      }

      // Group consecutive image messages of the same sender sent within 1 minute of each other
      const isImg = msg.type === "image" && msg.mediaUrl && msg.status !== "failed" && msg.status !== "pending_delete" && msg.text !== "This message was deleted";
      
      if (isImg) {
        const msgTime = new Date(msg.createdAt || Date.now()).getTime();
        const canGroup = currentImageGroup &&
                         currentImageGroup.senderId === msg.senderId &&
                         (msgTime - new Date(currentImageGroup.createdAt || Date.now()).getTime()) < 60000;

        if (canGroup) {
          currentImageGroup.messages.push(msg);
        } else {
          if (currentImageGroup) {
            items.push(currentImageGroup);
          }
          currentImageGroup = {
            type: "image_group",
            id: `img-group-${msg.uiId || msg.id}`,
            senderId: msg.senderId,
            senderName: msg.senderName,
            senderAvatar: msg.senderAvatar,
            isOutgoing: msg.isOutgoing,
            createdAt: msg.createdAt,
            timestamp: msg.timestamp,
            status: msg.status,
            messages: [msg]
          };
        }
      } else {
        if (currentImageGroup) {
          items.push(currentImageGroup);
          currentImageGroup = null;
        }
        items.push(msg);
      }
    });

    if (currentImageGroup) {
      items.push(currentImageGroup);
    }
    return items;
  }, [activeMessages, activeChat]);

  // Instantly mark targeted unread sequences as read whenever actively viewing a thread
  const markAsReadIfAtBottom = () => {
    // Only proceed if window and document are defined (client-side)
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const isVisible = document.visibilityState === "visible";
    const isFocused = document.hasFocus();
    const isChatActiveView = window.innerWidth < 768
      ? mobileScreenRef.current === "chat"
      : true;

    // Strict WhatsApp conditions: Conversation must be the active one, 
    // tab must be focused/visible, and scroll must be at the bottom.
    if (
      activeChatIdRef.current && 
      user?.id && 
      isVisible && 
      isFocused && 
      isChatActiveView && 
      isAtBottomRef.current
    ) {
      messageService.markConversationMessagesAsRead(activeChatIdRef.current, user.id);
      setLocalUnreadCount(0);
    }
  };

  // Instantly scroll to bottom on first chat load without flickering
  useLayoutEffect(() => {
    if (activeChatId && activeMessages.length > 0 && !didInitialScrollRef.current) {
      if (scrollContainerRef.current) {
        // Use double RAF to ensure DOM has rendered and dimensions are stable
        const scroll = () => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
            didInitialScrollRef.current = true;
            isAtBottomRef.current = true;
          }
        };
        scroll();
        requestAnimationFrame(() => {
          scroll();
          // After positioning, trigger read receipts if conditions met
          setTimeout(markAsReadIfAtBottom, 100);
        });
      }
    }
  }, [activeChatId, activeMessages.length]);

  // Reset initial scroll ref when switching chats
  useEffect(() => {
    didInitialScrollRef.current = false;
    setHasMore(true);
    setHasMoreNewer(false);
    setHighlightedMessageId(null);
    setLocalUnreadCount(0);
    // Important: Start as false and let the useLayoutEffect set it after positioning
    isAtBottomRef.current = false; 
    setShowScrollBottom(false);
  }, [activeChatId]);

  useEffect(() => {
    if (activeChatId && activeChat?.isGroup) {
      chatService.getGroupMembers(activeChatId).then((members) => {
        setGroupMembers(members || []);
      }).catch(err => {
        console.warn("Failed to fetch group members for page:", err);
      });
    } else {
      setGroupMembers([]);
    }
  }, [activeChatId, activeChat?.isGroup]);

  useEffect(() => {
    const handleOpenDirectChat = async (e) => {
      const targetUser = e.detail?.user;
      if (!targetUser || !user?.id) return;

      try {
        const chatObj = await chatService.createOrOpenOneToOneChat(user.id, targetUser);
        const exists = chatsRef.current.some((c) => c.id === chatObj.id);
        if (!exists) {
          dispatch(setChats([chatObj, ...chatsRef.current]));
        }
        dispatch(setActiveChat(chatObj.id));
        dispatch(setMobileScreen("chat"));
      } catch (err) {
        console.error("Failed to open direct chat from mention click:", err);
      }
    };

    window.addEventListener("wa_open_direct_chat", handleOpenDirectChat);
    return () => window.removeEventListener("wa_open_direct_chat", handleOpenDirectChat);
  }, [user?.id, dispatch]);

  // Redirect to login if user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, router]);

  // Load initial paginated records on chat switch cleanly
  useEffect(() => {
    if (!activeChatId || !user?.id) return;

    const loadMessages = () => {
      messageService.fetchMessages(activeChatId, null, 30, user.id).then((fetched) => {
        if (fetched && fetched.length > 0) {
          dispatch(setMessages({ chatId: activeChatId, messages: fetched }));
          messageService.markConversationMessagesAsDelivered(activeChatId, user.id);
        } else {
          setHasMore(false);
        }
      });
    };

    supabase.rpc("cleanup_expired_messages")
      .then(() => loadMessages())
      .catch(() => loadMessages());
  }, [activeChatId, user?.id, dispatch]);

  // Unify absolute table-wide database message publication monitoring pipeline
  useEffect(() => {
    if (!user?.id) return;

    messageService.syncAllPendingDeliveries(user.id);
    
    const handleGlobalMessage = (eventType, incomingMsg) => {
      const isMine = incomingMsg.senderId === user.id;
      const targetChatId = incomingMsg.conversationId;

      if (eventType === "DELETE") {
        dispatch(
          deleteMessage({
            chatId: targetChatId,
            messageId: incomingMsg.id,
          })
        );

        const messagesForChat = messagesDictRef.current[targetChatId] || [];
        const wasLatest = messagesForChat.length > 0 && messagesForChat[messagesForChat.length - 1].id === incomingMsg.id;

        if (wasLatest) {
          const remainingMessages = messagesForChat.filter(m => m.id !== incomingMsg.id);

          if (remainingMessages.length > 0) {
            const newLatest = remainingMessages[remainingMessages.length - 1];
            let previewText = newLatest.text;
            if (newLatest.type === "image") previewText = t("chat.photo") || "Photo";
            if (newLatest.type === "video") previewText = t("chat.video") || "Video";
            if (newLatest.type === "file") previewText = t("chat.document") || "Document";
            if (newLatest.type === "voice") previewText = t("chat.voice_message") || "Voice Message";
            if (newLatest.type === "sticker") previewText = t("chat.sticker") || "Sticker";
            if (newLatest.type === "gif") previewText = t("chat.gif") || "GIF";

            dispatch(
              updateLastMessage({
                chatId: targetChatId,
                text: previewText,
                timestamp: newLatest.timestamp || new Date(newLatest.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }),
                isOutgoing: newLatest.senderId === user.id || newLatest.isOutgoing,
                status: newLatest.status,
                isForwarded: newLatest.isForwarded,
              })
            );
          } else {
            dispatch(
              updateLastMessage({
                chatId: targetChatId,
                text: "",
                timestamp: "",
                isOutgoing: false,
                status: null,
              })
            );
          }
        }
        return;
      }

      if (eventType === "INSERT") {
        if (targetChatId === activeChatIdRef.current) {
          const processAndAdd = (profile = null) => {
            if (!hasMoreNewerRef.current) {
              dispatch(
                addMessage({
                  chatId: targetChatId,
                  message: {
                    ...incomingMsg,
                    isOutgoing: isMine,
                    senderName: isMine ? user?.name : (profile?.name || "Member"),
                    senderAvatar: isMine ? user?.avatar : profile?.avatar,
                  },
                })
              );
            }

            if (!isMine) {
              // 1. ALWAYS send delivery acknowledgement immediately
              if (incomingMsg.id) {
                messageService.updateStatus(incomingMsg.id, "delivered", user.id);
              }
              
              // 2. Handle read status and unread counting separately
              if (isAtBottomRef.current) {
                // Defer read slightly to guarantee sequential Tick -> Double Tick -> Blue Tick flow
                setTimeout(() => {
                  markAsReadIfAtBottom();
                }, 500);
              } else {
                setLocalUnreadCount((prev) => prev + 1);
                dispatch(incrementUnread(targetChatId));
              }
            }
          };

          if (!isMine && incomingMsg.senderId) {
            let localProfile = null;
            const activeChat = chatsRef.current.find((c) => c.id === targetChatId);
            
            if (activeChat) {
              if (activeChat.isGroup) {
                localProfile = groupMembersRef.current.find(m => m.id === incomingMsg.senderId);
              } else {
                localProfile = {
                  name: activeChat.name,
                  avatar: activeChat.avatar
                };
              }
            }
            
            if (localProfile) {
              processAndAdd(localProfile);
            } else {
              profileService.getProfileById(incomingMsg.senderId).then(processAndAdd);
            }
          } else {
            processAndAdd();
          }
        } else {
          if (!isMine) {
            dispatch(incrementUnread(targetChatId));
            if (incomingMsg.id) {
              messageService.updateStatus(incomingMsg.id, "delivered", user.id);
            }
          }
        }

        let previewText = incomingMsg.text;
        if (incomingMsg.type === "image") previewText = "Photo";
        if (incomingMsg.type === "video") previewText = "Video";
        if (incomingMsg.type === "file") previewText = "Document";
        if (incomingMsg.type === "voice") previewText = "Voice Message";
        if (incomingMsg.type === "sticker") previewText = "Sticker";
        if (incomingMsg.type === "gif") previewText = "GIF";

        const dispatchUpdate = (profile = null) => {
          dispatch(
            updateLastMessage({
              chatId: targetChatId,
              text: previewText,
              timestamp: incomingMsg.timestamp,
              isOutgoing: isMine,
              status: incomingMsg.status,
              avatar: profile?.avatar,
              name: profile?.name,
              isForwarded: incomingMsg.isForwarded,
            })
          );
        };

        if (!isMine && incomingMsg.senderId) {
          const activeChat = chatsRef.current.find((c) => c.id === targetChatId);
          let localProfile = null;
          if (activeChat) {
            if (activeChat.isGroup) {
              localProfile = groupMembersRef.current.find(m => m.id === incomingMsg.senderId);
            } else {
              localProfile = {
                name: activeChat.name,
                avatar: activeChat.avatar
              };
            }
          }

          if (localProfile) {
            dispatchUpdate(localProfile);
            profileService.getProfileById(incomingMsg.senderId).then((latestProfile) => {
              if (latestProfile && (latestProfile.avatar !== localProfile.avatar || latestProfile.name !== localProfile.name)) {
                dispatchUpdate(latestProfile);
              }
            });
          } else {
            profileService.getProfileById(incomingMsg.senderId).then(dispatchUpdate);
          }
        } else {
          dispatchUpdate(null);
        }

        if (!chatsRef.current.some((c) => c.id === targetChatId)) {
          import("../../services/chatService").then(({ chatService }) => {
            chatService.getUserChats(user.id).then((fetched) => {
              if (fetched && fetched.length > 0) {
                dispatch(setChats(fetched));
              }
            });
          });
        }
      } else if (eventType === "UPDATE") {
        dispatch(
          updateMessage({
            chatId: targetChatId,
            message: incomingMsg,
          })
        );
        dispatch(
          updateMessageStatus({
            chatId: targetChatId,
            messageId: incomingMsg.id,
            status: incomingMsg.status,
          })
        );
        
        // Sync sidebar preview ONLY if this is actually the latest message in that conversation
        const messagesForChat = messagesDictRef.current[targetChatId] || [];
        const isLatest = messagesForChat.length > 0 && 
                         incomingMsg.id === messagesForChat[messagesForChat.length - 1].id;

        if (isLatest) {
          let previewText = incomingMsg.text;
          if (incomingMsg.type === "image") previewText = "Photo";
          if (incomingMsg.type === "video") previewText = "Video";
          if (incomingMsg.type === "file") previewText = "Document";
          if (incomingMsg.type === "voice") previewText = "Voice Message";
          if (incomingMsg.type === "sticker") previewText = "Sticker";
          if (incomingMsg.type === "gif") previewText = "GIF";

          dispatch(
            updateLastMessage({
              chatId: targetChatId,
              text: previewText,
              timestamp: incomingMsg.timestamp,
              isOutgoing: isMine,
              status: incomingMsg.status,
              isForwarded: incomingMsg.isForwarded,
            })
          );
        }
      }
    };

    const handleProfileUpdate = (updatedProfile) => {
      dispatch(
        updatePeerProfile({
          peerId: updatedProfile.id,
          name: updatedProfile.name,
          avatar: updatedProfile.avatar,
          online: updatedProfile.online,
          lastSeen: updatedProfile.last_seen,
        })
      );
      dispatch(
        updateSenderProfile({
          senderId: updatedProfile.id,
          name: updatedProfile.name,
          avatar: updatedProfile.avatar,
        })
      );
      if (activeChatIdRef.current) {
        setGroupMembers((prev) =>
          prev.map((m) =>
            m.id === updatedProfile.id
              ? { ...m, name: updatedProfile.name, avatar: updatedProfile.avatar, online: updatedProfile.online, lastSeen: updatedProfile.last_seen }
              : m
          )
        );
      }
    };

    const handleOnline = async () => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;

      // Force reconnect websocket channels to ensure zero stale connection references
      realtimeService.reconnectAll(
        user.id,
        handleGlobalMessage,
        handleProfileUpdate
      );

      messageService.syncAllPendingDeliveries(user.id);
      
      try {
        const { indexedDBService } = await import("../../services/indexedDBService");
        const { storageService } = await import("../../services/storageService");
        const pendingMsgs = await indexedDBService.getPendingMessages();
        
        for (const pMsg of pendingMsgs) {
          try {
            // Deduplication Check
            let existingConfirmedRow = null;
            try {
              // 1. Check using client_id column if migration is active
              const { data: dbCheckClientId } = await supabase
                .from("messages")
                .select("*")
                .eq("client_id", pMsg.id)
                .limit(1);

              if (dbCheckClientId && dbCheckClientId.length > 0) {
                existingConfirmedRow = dbCheckClientId[0];
              } else {
                // 2. Heuristic fallback matching for backward-compatibility
                const checkTimeBound = new Date(Date.now() - 10 * 60 * 1000).toISOString();
                let semanticQuery = supabase
                  .from("messages")
                  .select("*")
                  .eq("conversation_id", pMsg.conversation_id)
                  .eq("sender_id", pMsg.sender_id)
                  .eq("type", pMsg.type)
                  .gte("created_at", checkTimeBound);

                if (pMsg.type === "text") {
                  const { encodeMessageText } = await import("../../utils/messageParser");
                  const encoded = encodeMessageText(pMsg.text, pMsg.replyTo, pMsg.isForwarded, {}, pMsg.noPreview);
                  semanticQuery = semanticQuery.eq("text", encoded);
                } else if (pMsg.file_name) {
                  semanticQuery = semanticQuery.eq("file_name", pMsg.file_name);
                }

                const { data: dbCheckSemantic } = await semanticQuery.limit(1);
                if (dbCheckSemantic && dbCheckSemantic.length > 0) {
                  existingConfirmedRow = dbCheckSemantic[0];
                }
              }
            } catch (dedupErr) {
              console.warn("Sync deduplication query check failed:", dedupErr);
            }

            let confirmedRow = null;
            if (existingConfirmedRow) {
              const { parseMessageText } = await import("../../utils/messageParser");
              const { text: cleanText, reactions, replyTo: parsedReplyTo, isForwarded: parsedIsForward, noPreview: parsedNoPreview } = parseMessageText(existingConfirmedRow.text || "");
              
              confirmedRow = {
                id: existingConfirmedRow.id,
                conversationId: existingConfirmedRow.conversation_id,
                conversation_id: existingConfirmedRow.conversation_id,
                text: cleanText,
                rawText: existingConfirmedRow.text || "",
                reactions: {},
                replyTo: existingConfirmedRow.reply_to || parsedReplyTo,
                isForwarded: existingConfirmedRow.is_forwarded || parsedIsForward,
                noPreview: existingConfirmedRow.no_preview || parsedNoPreview,
                editedAt: existingConfirmedRow.edited_at,
                editHistory: existingConfirmedRow.edit_history,
                timestamp: existingConfirmedRow.timestamp_string,
                status: existingConfirmedRow.status,
                type: existingConfirmedRow.type,
                mediaUrl: existingConfirmedRow.media_url,
                fileName: existingConfirmedRow.file_name,
                fileSize: existingConfirmedRow.file_size,
                duration: existingConfirmedRow.duration,
                senderId: existingConfirmedRow.sender_id,
                sender_id: existingConfirmedRow.sender_id,
                isOutgoing: true,
                createdAt: existingConfirmedRow.created_at,
              };
            } else {
              let uploadedUrl = pMsg.media_url;
              const file = await indexedDBService.getPendingFile(pMsg.id);
              if (file) {
                uploadedUrl = await storageService.uploadFile(file, pMsg.type + "s");
              }

              confirmedRow = await messageService.sendMessage({
                conversationId: pMsg.conversation_id,
                senderId: pMsg.sender_id,
                text: pMsg.text,
                type: pMsg.type,
                mediaUrl: uploadedUrl,
                fileName: pMsg.file_name,
                fileSize: pMsg.file_size,
                duration: pMsg.duration,
                timestampString: pMsg.timestamp_string,
                clientId: pMsg.id,
              });
            }

            dispatch(
              replaceOptimisticMessage({
                chatId: pMsg.conversation_id,
                tempId: pMsg.uiId,
                confirmedMessage: { ...confirmedRow, isOutgoing: true },
              })
            );
            await indexedDBService.removePendingMessage(pMsg.id);
          } catch (e) {
            console.warn("Failed to sync offline msg:", e);
          }
        }
      } catch (e) {
        console.warn("Offline sync error:", e);
      } finally {
        isSyncingRef.current = false;
      }
    };

    window.addEventListener("online", handleOnline);

    realtimeService.subscribeToUserGlobalMessages(handleGlobalMessage);
    realtimeService.subscribeToProfileUpdates(handleProfileUpdate);

    return () => {
      realtimeService.disconnectGlobalMessages();
      realtimeService.disconnectProfileUpdates();
      window.removeEventListener("online", handleOnline);
    };
  }, [user?.id, dispatch]);

  // Tab restoration event monitoring sync engine
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = typeof document !== "undefined" && document.visibilityState === "visible";
      const isFocused = typeof document !== "undefined" && document.hasFocus();
      
      if (isVisible && isFocused && activeChatIdRef.current && user?.id) {
        markAsReadIfAtBottom();
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
      window.addEventListener("focus", handleVisibilityChange);
      return () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        window.removeEventListener("focus", handleVisibilityChange);
      };
    }
  }, [user?.id]);

  // Capture forward triggers and mount the forwarding dialog overlay
  useEffect(() => {
    const handleForwardTrigger = (e) => {
      const { message } = e.detail || {};
      if (message) {
        setForwardingMsg(message);
      }
    };
    window.addEventListener("wa_forward_trigger", handleForwardTrigger);
    return () => window.removeEventListener("wa_forward_trigger", handleForwardTrigger);
  }, []);

  // Infinite Scroll and Bottom Detection Handler
  const handleScroll = async (e) => {
    const container = e.target;
    const { scrollHeight, scrollTop, clientHeight } = container;
    
    // Bottom detection
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    isAtBottomRef.current = isAtBottom;
    setShowScrollBottom(!isAtBottom);

    if (isAtBottom && localUnreadCount > 0) {
      markAsReadIfAtBottom();
    }

    // Pagination logic: Scrolling UP (loads older messages)
    if (scrollTop < 200 && !isFetchingHistory && hasMore && activeMessages.length >= 20) {
      const oldestMsg = activeMessages[0];
      if (!oldestMsg?.createdAt) return;

      setIsFetchingHistory(true);
      const previousScrollHeight = scrollHeight;

      try {
        const olderHistory = await messageService.fetchMessages(
          activeChatId,
          oldestMsg.createdAt,
          30,
          user.id
        );

        if (olderHistory && olderHistory.length > 0) {
          dispatch(prependMessages({ chatId: activeChatId, messages: olderHistory }));
          if (olderHistory.length < 30) setHasMore(false);

          // Maintain scroll position after prepending
          setTimeout(() => {
            if (scrollContainerRef.current) {
              const diff = scrollContainerRef.current.scrollHeight - previousScrollHeight;
              scrollContainerRef.current.scrollTop += diff;
            }
          }, 0);
        } else {
          setHasMore(false);
        }
      } catch (err) {
        console.error("Pagination failed:", err);
      } finally {
        setIsFetchingHistory(false);
      }
    }

    // Pagination logic: Scrolling DOWN (loads newer messages)
    const isNearBottomForNewer = scrollHeight - scrollTop - clientHeight < 200;
    if (isNearBottomForNewer && !isFetchingHistory && hasMoreNewer && activeMessages.length >= 20) {
      const newestMsg = activeMessages[activeMessages.length - 1];
      if (!newestMsg?.createdAt) return;

      setIsFetchingHistory(true);

      try {
        const newerHistory = await messageService.fetchNewerMessages(
          activeChatId,
          newestMsg.createdAt,
          30,
          user.id
        );

        if (newerHistory && newerHistory.length > 0) {
          dispatch(appendMessages({ chatId: activeChatId, messages: newerHistory }));
          if (newerHistory.length < 30) {
            setHasMoreNewer(false);
          }
        } else {
          setHasMoreNewer(false);
        }
      } catch (err) {
        console.error("Fetching newer history failed:", err);
      } finally {
        setIsFetchingHistory(false);
      }
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    setLocalUnreadCount(0);
    isAtBottomRef.current = true;
    setShowScrollBottom(false);
    if (activeChatId && user?.id) {
      messageService.markConversationMessagesAsRead(activeChatId, user.id);
    }
  };

  const handleJumpToMessage = async (msgId) => {
    // Automatically close search panel and focus chat view on mobile/small screens
    if (window.innerWidth < 768) {
      dispatch(setActiveSearchPanelOpen(false));
      dispatch(setMobileScreen("chat"));
    }

    // 1. WhatsApp style visual flash highlight helper
    const triggerHighlight = (id) => {
      setHighlightedMessageId(id);
      setTimeout(() => {
        const el = document.getElementById(`msg-${id}`);
        if (el) {
          el.classList.add("wa-message-highlight");
          setTimeout(() => {
            el.classList.remove("wa-message-highlight");
            setHighlightedMessageId(null);
          }, 2500);
        }
      }, 50);
    };

    // 2. Check if the element is already in the loaded messages array in memory
    const existingElement = document.getElementById(`msg-${msgId}`);
    if (existingElement) {
      existingElement.scrollIntoView({ behavior: "smooth", block: "center" });
      triggerHighlight(msgId);
      return;
    }

    // 3. Not in memory: perform contextual database query
    setIsFetchingHistory(true);
    try {
      const contextMessages = await messageService.fetchMessageContext(
        msgId,
        20,
        user.id
      );

      if (contextMessages && contextMessages.length > 0) {
        dispatch(setMessages({ chatId: activeChatId, messages: contextMessages }));
        setHasMore(true);
        setHasMoreNewer(true);

        // Scroll to the element after DOM updates
        setTimeout(() => {
          const targetEl = document.getElementById(`msg-${msgId}`);
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: "auto", block: "center" });
            triggerHighlight(msgId);
          }
        }, 120);
      }
    } catch (e) {
      console.warn("Failed to jump and load message context:", e);
    } finally {
      setIsFetchingHistory(false);
    }
  };

  // Stable realtime auto-scroll
  useEffect(() => {
    if (scrollContainerRef.current && didInitialScrollRef.current) {
      const { scrollHeight, scrollTop, clientHeight } = scrollContainerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
      if (isNearBottom && isAtBottomRef.current) {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      }
    }
  }, [activeMessages.length]);

  if (!isAuthenticated || !user?.id) return null;

  if (isAppLocked) {
    return (
      <LockScreen
        mode="unlock"
        lockType={lockType}
        savedCode={lockType === "pin" ? savedPin : savedPattern}
        onSuccess={() => dispatch(unlockApp())}
        title={t("lock.app_locked_title") || "WhatsApp is locked"}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-0 flex overflow-hidden bg-wa-bg transition-colors duration-200">
      <main className="relative flex h-full w-full max-w-[1600px] mx-auto overflow-hidden z-10 bg-wa-bg">
        <div
          className={cn(
            "h-full w-full md:w-[380px] lg:w-[420px] shrink-0 border-r border-wa-border bg-wa-sidebar transition-colors duration-200",
            mobileScreen === "chat" ? "hidden md:block" : "block"
          )}
        >
          <Sidebar />
        </div>

        <div
          className={cn(
            "flex-1 flex flex-col h-full relative overflow-hidden bg-wa-bg",
            mobileScreen === "list" ? "hidden md:flex" : "flex"
          )}
        >
          {activeChat ? (
            lockedChatIds.includes(activeChat.id) && !authorizedChatIds.includes(activeChat.id) ? (
              <LockScreen
                mode="unlock"
                lockType={lockType}
                savedCode={lockType === "pin" ? savedPin : savedPattern}
                onSuccess={() => dispatch(authorizeChat(activeChat.id))}
                onCancel={mobileScreen === "chat" ? () => dispatch(setMobileScreen("list")) : null}
                title={t("lock.chat_locked_title") || "Chat Locked"}
              />
            ) : (
              <>
                <ChatHeader />

              <div className="flex-1 relative overflow-hidden" style={chatBackgroundStyle}>
                {/* Wallpaper Dimming Overlay */}
                {wallpaperConfig && wallpaperConfig.dim > 0 && (
                  <div 
                    className="absolute inset-0 bg-black pointer-events-none z-0 transition-opacity duration-200" 
                    style={{ opacity: wallpaperConfig.dim / 100 }}
                  />
                )}

                <div
                  ref={scrollContainerRef}
                  onScroll={handleScroll}
                  className="h-full overflow-y-auto px-2 sm:px-6 py-4 wa-chat-bg relative select-text scroll-smooth-gpu z-10"
                  style={{ overflowAnchor: "auto", ...chatBgOverlayStyle }}
                >
                  {isFetchingHistory && (
                    <div className="flex justify-center sticky top-2 z-20">
                      <div className="bg-wa-sidebar/80 backdrop-blur-md px-3 py-1 rounded-full text-[10px] text-wa-muted shadow-sm border border-wa-border animate-pulse">
                        {t("chat.loading_history")}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-center mb-4 select-none">
                    <span className="bg-wa-encrypted text-wa-muted text-[11px] sm:text-xs px-3 py-1.5 rounded-md text-center max-w-md shadow-xs transition-colors">
                      {t("common.encrypted")}
                    </span>
                  </div>

                  {groupedItems.map((item) => (
                    item.type === "date_separator" ? (
                      <div key={item.id} className="flex justify-center my-4 sticky top-0 z-10 select-none">
                        <span className="bg-[#d1f4cc]/90 dark:bg-wa-sidebar/90 backdrop-blur-md text-wa-muted text-[11px] sm:text-[12px] px-3 py-1.5 rounded-md shadow-xs uppercase tracking-tight font-medium border border-wa-border/30">
                          {getChatDateLabel(item.date)}
                        </span>
                      </div>
                    ) : item.type === "unread_separator" ? (
                      <div key={item.id} className="flex items-center justify-center my-5 select-none relative w-full">
                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                          <div className="w-full border-t border-red-500/25 dark:border-red-500/20"></div>
                        </div>
                        <span className="relative bg-red-500 dark:bg-red-600 text-white text-[10px] sm:text-[11px] px-3.5 py-1 rounded-full shadow-md font-semibold tracking-wider uppercase border border-red-500/30">
                          {t("chat.unread_messages") || "Unread Messages"}
                        </span>
                      </div>
                    ) : (
                      <MessageBubble key={item.uiId || item.id} message={item} isGroup={activeChat.isGroup} groupMembers={groupMembers} />
                    )
                  ))}

                  <div ref={messagesEndRef} className="h-1" />
                </div>

                {/* Floating "New Messages" indicator */}
                {localUnreadCount > 0 && showScrollBottom && (
                  <button
                    onClick={scrollToBottom}
                    className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-red-500 dark:bg-red-600 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 hover:bg-red-600 transition-all transform hover:scale-105 active:scale-95 z-30 animate-bounce select-none"
                  >
                    <ChevronDown className="h-4 w-4" />
                    {(t && t("chat.new_messages")) || "New Messages"} ({localUnreadCount})
                  </button>
                )}

                {/* WhatsApp-style Floating Unread Indicator */}
                {showScrollBottom && (
                  <button
                    onClick={scrollToBottom}
                    className="absolute bottom-4 right-4 sm:right-6 w-10 h-10 bg-wa-sidebar border border-wa-border rounded-full shadow-lg flex items-center justify-center text-wa-muted hover:text-wa-text transition-all animate-scale-up group z-30"
                  >
                    <ChevronDown className="h-6 w-6 group-hover:translate-y-0.5 transition-transform" />
                    {localUnreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-wa-primary text-white text-[10px] font-bold h-5 min-w-[20px] px-1.5 rounded-full flex items-center justify-center shadow-md animate-bounce-subtle">
                        {localUnreadCount}
                      </span>
                    )}
                  </button>
                )}
              </div>

              <ChatInput />
            </>
          ) ) : (
            <EmptyState />
          )}
        </div>

        {activeSearchPanelOpen && activeChat && (
          <MessageSearchPanel chat={activeChat} onJumpToMessage={handleJumpToMessage} />
        )}

        {forwardingMsg && (
          <ForwardModal 
            messageToForward={forwardingMsg} 
            onClose={() => setForwardingMsg(null)} 
          />
        )}

        {statusViewOpen && <StatusPanel />}

        <WallpaperModal />

        <style dangerouslySetInnerHTML={{__html: `
          @keyframes waHighlightFlash {
            0% {
              background-color: rgba(253, 224, 71, 0.45) !important;
            }
            100% {
              background-color: transparent !important;
            }
          }
          .wa-message-highlight {
            animation: waHighlightFlash 2.5s ease-out forwards !important;
            border-radius: 4px;
          }
        `}} />
      </main>
    </div>
  );
}
