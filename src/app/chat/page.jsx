"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);

  // Synchronous React refs supporting un-recreated streaming closure pointers
  const activeChatIdRef = useRef(activeChatId);
  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  const chatsRef = useRef(chats);
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  const activeChat = chats.find((c) => c.id === activeChatId);
  const activeMessages = activeChatId ? messagesDict[activeChatId] || [] : [];

  // Redirect to login if user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, router]);

  const mobileScreenRef = useRef(mobileScreen);
  useEffect(() => {
    mobileScreenRef.current = mobileScreen;
  }, [mobileScreen]);

  // Instantly mark targeted unread sequences as read whenever actively viewing a thread
  useEffect(() => {
    const isAppVisible = typeof document !== "undefined" ? document.visibilityState === "visible" : true;
    const isChatActiveView = typeof window !== "undefined" && window.innerWidth < 768
      ? mobileScreen === "chat"
      : true;

    if (activeChatId && user?.id && isAppVisible && isChatActiveView) {
      messageService.markConversationMessagesAsRead(activeChatId, user.id);
    }
  }, [activeChatId, user?.id, mobileScreen]);

  // Load initial paginated records on chat switch cleanly
  useEffect(() => {
    if (!activeChatId || !user?.id) return;

    messageService.fetchMessages(activeChatId, null, 20, user.id).then((fetched) => {
      if (fetched && fetched.length > 0) {
        dispatch(setMessages({ chatId: activeChatId, messages: fetched }));
      }
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      }, 50);
    });
  }, [activeChatId, user?.id, dispatch]);

  // Unify absolute table-wide database message publication monitoring pipeline
  useEffect(() => {
    if (!user?.id) return;

    realtimeService.subscribeToUserGlobalMessages((eventType, incomingMsg) => {
      const isMine = incomingMsg.senderId === user.id;
      const targetChatId = incomingMsg.conversationId;

      if (eventType === "INSERT") {
        // 1. If payload targets actively open viewport:
        if (targetChatId === activeChatIdRef.current) {
          if (!isMine && incomingMsg.senderId) {
            profileService.getProfileById(incomingMsg.senderId).then((profile) => {
              dispatch(
                addMessage({
                  chatId: targetChatId,
                  message: {
                    ...incomingMsg,
                    isOutgoing: false,
                    senderName: profile?.name || "Member",
                    senderAvatar: profile?.avatar,
                  },
                })
              );
            });
          } else {
            dispatch(
              addMessage({
                chatId: targetChatId,
                message: {
                  ...incomingMsg,
                  isOutgoing: isMine,
                  senderName: user?.name,
                  senderAvatar: user?.avatar,
                },
              })
            );
          }

          if (!isMine) {
            const isAppVisible = typeof document !== "undefined" ? document.visibilityState === "visible" : true;
            const isChatActiveView = typeof window !== "undefined" && window.innerWidth < 768
              ? mobileScreenRef.current === "chat"
              : true;

            if (isAppVisible && isChatActiveView) {
              messageService.markConversationMessagesAsRead(targetChatId, user.id);
            } else {
              // Message targets thread but app is minimized or list layout is actively displayed on mobile screen
              dispatch(incrementUnread(targetChatId));
              if (incomingMsg.id) {
                messageService.updateStatus(incomingMsg.id, "delivered");
              }
            }
          }
        } else {
          // 2. If payload addresses background inactive tab/room:
          if (!isMine) {
            dispatch(incrementUnread(targetChatId));
            if (incomingMsg.id) {
              messageService.updateStatus(incomingMsg.id, "delivered");
            }
          }
        }

        // 3. Keep latest chat message preview strip dynamically synced table-wide
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

        // 4. If conversation item is completely missing from current client hierarchy, trigger refetch
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
        // Sync live updates for content, reactions, and deletions
        dispatch(
          updateMessage({
            chatId: targetChatId,
            message: incomingMsg,
          })
        );

        // Sync live read receipt updates onto active bubbles
        dispatch(
          updateMessageStatus({
            chatId: targetChatId,
            messageId: incomingMsg.id,
            status: incomingMsg.status,
          })
        );

        // Also sync corresponding sidebar preview strip parity
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
    });

    return () => {
      realtimeService.disconnectGlobalMessages();
    };
  }, [user?.id, dispatch]);

  // Tab restoration event monitoring sync engine
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible" && activeChatIdRef.current && user?.id) {
        const isChatActiveView = typeof window !== "undefined" && window.innerWidth < 768
          ? mobileScreenRef.current === "chat"
          : true;

        if (isChatActiveView) {
          messageService.markConversationMessagesAsRead(activeChatIdRef.current, user.id);
        }
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
      return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
  }, [user?.id]);

  // Lazy pagination execution when reaching view boundaries
  const handleScroll = async (e) => {
    const container = e.target;
    if (container.scrollTop === 0 && !isFetchingHistory && activeMessages.length >= 20) {
      const oldestMsg = activeMessages[0];
      if (!oldestMsg?.createdAt) return;

      setIsFetchingHistory(true);
      const previousScrollHeight = container.scrollHeight;

      try {
        const olderHistory = await messageService.fetchMessages(
          activeChatId,
          oldestMsg.createdAt,
          20,
          user.id
        );

        if (olderHistory && olderHistory.length > 0) {
          dispatch(prependMessages({ chatId: activeChatId, messages: olderHistory }));
          
          setTimeout(() => {
            if (scrollContainerRef.current) {
              const currentScrollHeight = scrollContainerRef.current.scrollHeight;
              scrollContainerRef.current.scrollTop = currentScrollHeight - previousScrollHeight;
            }
          }, 0);
        }
      } catch (err) {
        console.error("Pagination progressive query failed:", err);
      } finally {
        setIsFetchingHistory(false);
      }
    }
  };

  // Auto scroll functionality to keep most recent bubbles visible on standard posts
  useEffect(() => {
    if (scrollContainerRef.current) {
      const { scrollHeight, scrollTop, clientHeight } = scrollContainerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
      if (isNearBottom) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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

              <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-2 sm:px-6 py-4 wa-chat-bg relative select-text"
              >
                {isFetchingHistory && (
                  <div className="text-center py-2 text-xs text-wa-muted animate-pulse">
                    Loading older messages...
                  </div>
                )}

                <div className="flex justify-center mb-4 select-none">
                  <span className="bg-wa-encrypted text-wa-muted text-[11px] sm:text-xs px-3 py-1.5 rounded-md text-center max-w-md shadow-xs transition-colors">
                    🔒 Messages and calls are end-to-end encrypted. No one
                    outside of this chat can read or listen to them.
                  </span>
                </div>

                {activeMessages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}

                <div ref={messagesEndRef} className="h-1" />
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
