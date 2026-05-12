"use client";

import React, { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "../../components/Sidebar/Sidebar";
import { ChatHeader } from "../../components/Chat/ChatHeader";
import { MessageBubble } from "../../components/Chat/MessageBubble";
import { ChatInput } from "../../components/Chat/ChatInput";
import { EmptyState } from "../../components/Chat/EmptyState";
import { useAppSelector } from "../../hooks/useRedux";
import { cn } from "../../utils/cn";

export default function ChatPage() {
  const router = useRouter();
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const activeChatId = useAppSelector((state) => state.chat.activeChatId);
  const chats = useAppSelector((state) => state.chat.chats);
  const messagesDict = useAppSelector((state) => state.message.messages);
  const mobileScreen = useAppSelector((state) => state.ui.mobileScreen);

  const messagesEndRef = useRef(null);
  const activeChat = chats.find((c) => c.id === activeChatId);
  const activeMessages = activeChatId ? messagesDict[activeChatId] || [] : [];

  // Redirect to login if user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, router]);

  // Auto scroll functionality to keep most recent bubbles visible
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeMessages, activeChatId]);

  if (!isAuthenticated) return null;

  return (
    <div className="fixed inset-0 z-0 flex overflow-hidden bg-[#efeae2] dark:bg-[#0b141a]">
      {/* Main App Desktop Boundary mimicking actual desktop clients */}
      <main className="relative flex h-full w-full max-w-[1600px] mx-auto overflow-hidden z-10 bg-[#efeae2] dark:bg-[#0b141a]">
        {/* Left Sidebar column: visible on desktop, conditionally managed on mobile screens */}
        <div
          className={cn(
            "h-full w-full md:w-[380px] lg:w-[420px] shrink-0 border-r border-[#e9edef] dark:border-[#222d34] bg-white dark:bg-[#111b21]",
            mobileScreen === "chat" ? "hidden md:block" : "block",
          )}
        >
          <Sidebar />
        </div>

        {/* Right Active Conversation Section */}
        <div
          className={cn(
            "flex-1 flex flex-col h-full relative overflow-hidden bg-[#efeae2] dark:bg-[#0b141a]",
            mobileScreen === "list" ? "hidden md:flex" : "flex",
          )}
        >
          {activeChat ? (
            <>
              {/* Dynamic Action header strip */}
              <ChatHeader />

              {/* Scrollable messages background map */}
              <div className="flex-1 overflow-y-auto px-2 sm:px-6 py-4 wa-chat-bg relative select-text">
                {/* Secure warning bubble */}
                <div className="flex justify-center mb-4 select-none">
                  <span className="bg-[#ffeecd] dark:bg-[#182229] text-[#54656f] dark:text-[#aebac1] text-[11px] sm:text-xs px-3 py-1.5 rounded-md text-center max-w-md shadow-xs">
                    🔒 Messages and calls are end-to-end encrypted. No one
                    outside of this chat can read or listen to them.
                  </span>
                </div>

                {/* Render active record map */}
                {activeMessages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}

                {/* Anchor target marker for infinite auto-scrolling */}
                <div ref={messagesEndRef} className="h-1" />
              </div>

              {/* Bottom text bar layout console */}
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
