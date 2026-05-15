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
import { setMessages, prependMessages, addMessage, updateMessageStatus, updateMessage } from "../../redux/slices/messageSlice";
import { updateLastMessage, incrementUnread, setChats } from "../../redux/slices/chatSlice";
import { messageService } from "../../services/messageService";
import { realtimeService } from "../../services/realtimeService";
import { profileService } from "../../services/profileService";
import { cn } from "../../utils/cn";
import { getChatDateLabel } from "../../utils/dateUtils";

export default function ChatPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const user = useAppSelector((state) => state.auth.user);
  const activeChatId = useAppSelector((state) => state.chat.activeChatId);
  const chats = useAppSelector((state) => state.chat.chats);
  const messagesDict = useAppSelector((state) => state.message.messages);
  const mobileScreen = useAppSelector((state) => state.ui.mobileScreen);

  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [localUnreadCount, setLocalUnreadCount] = useState(0);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const didInitialScrollRef = useRef(false);
  const isAtBottomRef = useRef(true);

  // Synchronous React refs supporting un-recreated streaming closure pointers
  const activeChatIdRef = useRef(activeChatId);
  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  const chatsRef = useRef(chats);
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  const mobileScreenRef = useRef(mobileScreen);
  useEffect(() => {
    mobileScreenRef.current = mobileScreen;
  }, [mobileScreen]);

  const messagesDictRef = useRef(messagesDict);
  useEffect(() => {
    messagesDictRef.current = messagesDict;
  }, [messagesDict]);

  const activeChat = chats.find((c) => c.id === activeChatId);
  const activeMessages = activeChatId ? messagesDict[activeChatId] || [] : [];

  // Grouped messages memoization to prevent expensive re-calculates
  const groupedItems = useMemo(() => {
    const items = [];
    let lastDate = null;

    activeMessages.forEach((msg) => {
      const msgDate = new Date(msg.createdAt || Date.now()).toDateString();
      if (msgDate !== lastDate) {
        items.push({
          type: "date_separator",
          date: msg.createdAt || Date.now(),
          id: `date-${msgDate}-${msg.id}`,
        });
        lastDate = msgDate;
      }
      items.push(msg);
    });
    return items;
  }, [activeMessages]);

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
    setLocalUnreadCount(0);
    // Important: Start as false and let the useLayoutEffect set it after positioning
    isAtBottomRef.current = false; 
    setShowScrollBottom(false);
  }, [activeChatId]);

  // Redirect to login if user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, router]);

  // Load initial paginated records on chat switch cleanly
  useEffect(() => {
    if (!activeChatId || !user?.id) return;

    messageService.fetchMessages(activeChatId, null, 30, user.id).then((fetched) => {
      if (fetched && fetched.length > 0) {
        dispatch(setMessages({ chatId: activeChatId, messages: fetched }));
        messageService.markConversationMessagesAsDelivered(activeChatId, user.id);
      } else {
        setHasMore(false);
      }
    });
  }, [activeChatId, user?.id, dispatch]);

  // Unify absolute table-wide database message publication monitoring pipeline
  useEffect(() => {
    if (!user?.id) return;

    messageService.syncAllPendingDeliveries(user.id);
    
    const handleOnline = async () => {
      messageService.syncAllPendingDeliveries(user.id);
      
      try {
        const { indexedDBService } = await import("../../services/indexedDBService");
        const { storageService } = await import("../../services/storageService");
        const pendingMsgs = await indexedDBService.getPendingMessages();
        
        for (const pMsg of pendingMsgs) {
          try {
            let uploadedUrl = pMsg.media_url;
            const file = await indexedDBService.getPendingFile(pMsg.id);
            if (file) {
              uploadedUrl = await storageService.uploadFile(file, pMsg.type + "s");
            }

            const confirmedRow = await messageService.sendMessage({
              conversationId: pMsg.conversation_id,
              senderId: pMsg.sender_id,
              text: pMsg.text,
              type: pMsg.type,
              mediaUrl: uploadedUrl,
              fileName: pMsg.file_name,
              fileSize: pMsg.file_size,
              duration: pMsg.duration,
              timestampString: pMsg.timestamp_string,
            });

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
      }
    };
    window.addEventListener("online", handleOnline);

    realtimeService.subscribeToUserGlobalMessages((eventType, incomingMsg) => {
      const isMine = incomingMsg.senderId === user.id;
      const targetChatId = incomingMsg.conversationId;

      if (eventType === "INSERT") {
        if (targetChatId === activeChatIdRef.current) {
          const processAndAdd = (profile = null) => {
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
            profileService.getProfileById(incomingMsg.senderId).then(processAndAdd);
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
        if (incomingMsg.type === "image") previewText = "📷 Photo";
        if (incomingMsg.type === "video") previewText = "🎥 Video";
        if (incomingMsg.type === "file") previewText = "📎 Document";
        if (incomingMsg.type === "voice") previewText = "🎤 Voice Message";

        dispatch(
          updateLastMessage({
            chatId: targetChatId,
            text: previewText,
            timestamp: incomingMsg.timestamp,
            isOutgoing: isMine,
            status: incomingMsg.status,
          })
        );

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
        const isLatest = messagesForChat.length === 0 || 
                         incomingMsg.id === messagesForChat[messagesForChat.length - 1].id ||
                         new Date(incomingMsg.createdAt) >= new Date(messagesForChat[messagesForChat.length - 1].createdAt);

        if (isLatest) {
          dispatch(
            updateLastMessage({
              chatId: targetChatId,
              text: incomingMsg.text,
              timestamp: incomingMsg.timestamp,
              isOutgoing: isMine,
              status: incomingMsg.status,
            })
          );
        }
      }
    });

    return () => {
      realtimeService.disconnectGlobalMessages();
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

    // Pagination logic
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
        } else {
          setHasMore(false);
        }
      } catch (err) {
        console.error("Pagination failed:", err);
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
            <>
              <ChatHeader />

              <div className="flex-1 relative overflow-hidden">
                <div
                  ref={scrollContainerRef}
                  onScroll={handleScroll}
                  className="h-full overflow-y-auto px-2 sm:px-6 py-4 wa-chat-bg relative select-text scroll-smooth-gpu"
                  style={{ overflowAnchor: "auto" }}
                >
                  {isFetchingHistory && (
                    <div className="flex justify-center sticky top-2 z-20">
                      <div className="bg-wa-sidebar/80 backdrop-blur-md px-3 py-1 rounded-full text-[10px] text-wa-muted shadow-sm border border-wa-border animate-pulse">
                        Loading history...
                      </div>
                    </div>
                  )}

                  <div className="flex justify-center mb-4 select-none">
                    <span className="bg-wa-encrypted text-wa-muted text-[11px] sm:text-xs px-3 py-1.5 rounded-md text-center max-w-md shadow-xs transition-colors">
                      🔒 Messages and calls are end-to-end encrypted. No one
                      outside of this chat can read or listen to them.
                    </span>
                  </div>

                  {groupedItems.map((item) => (
                    item.type === "date_separator" ? (
                      <div key={item.id} className="flex justify-center my-4 sticky top-0 z-10 select-none">
                        <span className="bg-[#d1f4cc]/90 dark:bg-wa-sidebar/90 backdrop-blur-md text-wa-muted text-[11px] sm:text-[12px] px-3 py-1.5 rounded-md shadow-xs uppercase tracking-tight font-medium border border-wa-border/30">
                          {getChatDateLabel(item.date)}
                        </span>
                      </div>
                    ) : (
                      <MessageBubble key={item.id} message={item} isGroup={activeChat.isGroup} />
                    )
                  ))}

                  <div ref={messagesEndRef} className="h-1" />
                </div>

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
          ) : (
            <EmptyState />
          )}
        </div>
      </main>
    </div>
  );
}
