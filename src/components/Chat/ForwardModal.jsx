"use client";

import React, { useState, useMemo } from "react";
import { Search, X, Send, Check } from "lucide-react";
import { useAppSelector, useAppDispatch } from "../../hooks/useRedux";
import { Avatar } from "../ui/Avatar";
import { messageService } from "../../services/messageService";
import { addMessage } from "../../redux/slices/messageSlice";
import { updateLastMessage } from "../../redux/slices/chatSlice";
import { cn } from "../../utils/cn";
import { useTranslation } from "../../hooks/useTranslation";

export function ForwardModal({ messageToForward, onClose }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const chats = useAppSelector((state) => state.chat.chats);
  const currentUser = useAppSelector((state) => state.auth.user);
  const activeChatId = useAppSelector((state) => state.chat.activeChatId);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChatIds, setSelectedChatIds] = useState([]);
  const [isSending, setIsSending] = useState(false);

  // Filter out archived or left chats for forwarding compatibility
  const activeChats = useMemo(() => {
    return chats.filter((c) => !c.isArchived && !c.isLeft);
  }, [chats]);

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return activeChats;
    const query = searchQuery.toLowerCase();
    return activeChats.filter((c) => c.name.toLowerCase().includes(query));
  }, [activeChats, searchQuery]);

  const toggleSelectChat = (chatId) => {
    setSelectedChatIds((prev) => {
      if (prev.includes(chatId)) {
        return prev.filter((id) => id !== chatId);
      } else {
        return [...prev, chatId];
      }
    });
  };

  const handleForwardSubmit = async () => {
    if (selectedChatIds.length === 0 || isSending) return;
    setIsSending(true);

    try {
      const timeString = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      // Forward to each target conversation sequentially
      for (const targetChatId of selectedChatIds) {
        // Clone message payload and inject isForwarded = true
        const confirmedRow = await messageService.sendMessage({
          conversationId: targetChatId,
          senderId: currentUser.id,
          text: messageToForward.text || "",
          type: messageToForward.type || "text",
          mediaUrl: messageToForward.mediaUrl,
          fileName: messageToForward.fileName,
          fileSize: messageToForward.fileSize,
          duration: messageToForward.duration,
          timestampString: timeString,
          isForwarded: true,
        });

        // If the forwarded target is the currently active chat, inject it into the Redux message stack natively
        if (targetChatId === activeChatId) {
          dispatch(
            addMessage({
              chatId: activeChatId,
              message: {
                ...confirmedRow,
                isOutgoing: true,
              },
            })
          );
        }

        // Update the last message preview in the sidebar for that chat
        dispatch(
          updateLastMessage({
            chatId: targetChatId,
            text:
              messageToForward.type === "image"
                ? "↪️ 📷 Photo"
                : messageToForward.type === "video"
                ? "↪️ 🎥 Video"
                : messageToForward.type === "voice"
                ? "↪️ 🎤 Voice Message"
                : messageToForward.type === "file"
                ? "↪️ 📎 Document"
                : `↪️ ${messageToForward.text}`,
            timestamp: timeString,
            isOutgoing: true,
            status: "sent",
          })
        );
      }

      onClose(true);
    } catch (e) {
      console.error("Message forwarding cloned stream exception:", e);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-xs select-none">
      <div 
        className="bg-wa-modal border border-wa-border rounded-xl shadow-2xl overflow-hidden w-full max-w-md h-[500px] flex flex-col relative animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 bg-wa-header border-b border-wa-border">
          <h3 className="text-sm sm:text-base font-semibold text-wa-text">
            {t("chat.forward_message_to") || "Forward message to"}
          </h3>
          <button 
            onClick={() => onClose(false)} 
            className="p-1.5 rounded-full hover:bg-wa-hover text-wa-muted hover:text-wa-text transition-colors"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-4 py-2 border-b border-wa-border bg-wa-sidebar flex items-center gap-2">
          <div className="flex-1 bg-wa-input border border-wa-border rounded-lg flex items-center px-2.5 py-1.5 gap-2.5 transition-colors focus-within:border-wa-primary focus-within:bg-wa-sidebar">
            <Search className="h-4.5 w-4.5 text-wa-muted shrink-0" />
            <input
              type="text"
              placeholder={t("chat.search_chats") || "Search chats"}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none text-xs sm:text-sm text-wa-text focus:outline-none w-full placeholder:text-wa-muted"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")} 
                className="text-wa-muted hover:text-wa-text"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Chats List */}
        <div className="flex-1 overflow-y-auto px-2 py-1 scrollbar-thin">
          {filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-wa-muted">
              <span className="text-xs sm:text-sm font-medium">
                {t("chat.no_results_found") || "No results found"}
              </span>
            </div>
          ) : (
            filteredChats.map((chat) => {
              const isSelected = selectedChatIds.includes(chat.id);
              return (
                <div
                  key={chat.id}
                  onClick={() => toggleSelectChat(chat.id)}
                  className={cn(
                    "flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors my-0.5",
                    isSelected ? "bg-wa-hover" : "hover:bg-wa-hover/60"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar 
                      src={chat.avatar} 
                      fallback={chat.name[0]} 
                      size="md" 
                      className="shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-wa-text truncate">{chat.name}</p>
                      <p className="text-[10px] sm:text-[11px] text-wa-muted truncate">
                        {chat.isGroup 
                          ? (t("chat.group_chat") || "Group Chat") 
                          : chat.phoneNumber || (t("chat.whatsapp_contact") || "WhatsApp Contact")}
                      </p>
                    </div>
                  </div>

                  {/* WhatsApp style selection circle */}
                  <div 
                    className={cn(
                      "h-5.5 w-5.5 rounded-full border flex items-center justify-center transition-all shrink-0",
                      isSelected 
                        ? "bg-wa-primary border-wa-primary text-white scale-110" 
                        : "border-wa-border bg-transparent"
                    )}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* FAB Send Button (WhatsApp Web Style) */}
        {selectedChatIds.length > 0 && (
          <button
            onClick={handleForwardSubmit}
            disabled={isSending}
            className="absolute bottom-6 right-6 h-12 w-12 rounded-full bg-wa-primary text-white hover:bg-wa-primary-hover shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 shrink-0 z-50 animate-scale-up"
            title={t("chat.forward_message_count", { count: selectedChatIds.length }) || `Forward message to ${selectedChatIds.length} chat${selectedChatIds.length > 1 ? "s" : ""}`}
          >
            {isSending ? (
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <Send className="h-5 w-5 fill-white ml-0.5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
