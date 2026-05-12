"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Smile,
  Paperclip,
  Mic,
  Send,
  Image as ImageIcon,
  FileText,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "../../hooks/useRedux";
import { addMessage } from "../../redux/slices/messageSlice";
import { updateLastMessage } from "../../redux/slices/chatSlice";
import { cn } from "../../utils/cn";

export function ChatInput() {
  const dispatch = useAppDispatch();
  const activeChatId = useAppSelector((state) => state.chat.activeChatId);
  const chats = useAppSelector((state) => state.chat.chats);
  const activeChat = chats.find((c) => c.id === activeChatId);

  const [messageText, setMessageText] = useState("");
  const [showAttachments, setShowAttachments] = useState(false);
  const textareaRef = useRef(null);

  // Auto-grow textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [messageText]);

  const handleSend = (
    customType = "text",
    customMediaUrl = null,
    customText = null,
  ) => {
    const textToSend = customText !== null ? customText : messageText.trim();
    if (!textToSend && customType === "text") return;

    const timeString = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const newMsg = {
      id: "msg-" + Date.now(),
      text: textToSend,
      timestamp: timeString,
      isOutgoing: true,
      status: "sent",
      type: customType,
      mediaUrl: customMediaUrl,
    };

    dispatch(addMessage({ chatId: activeChatId, message: newMsg }));
    dispatch(
      updateLastMessage({
        chatId: activeChatId,
        text: customType === "image" ? "📷 Image" : textToSend,
        timestamp: timeString,
        isOutgoing: true,
        status: "sent",
      }),
    );

    if (customType === "text") {
      setMessageText("");
    }
    setShowAttachments(false);

    // Simulate auto-reply for demo engagement
    setTimeout(() => {
      const replyTime = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      const replyMsg = {
        id: "msg-reply-" + Date.now(),
        text: `Automated reply from ${activeChat?.name || "contact"}: Got your message! Let's connect soon. 👍`,
        timestamp: replyTime,
        isOutgoing: false,
        status: "read",
        type: "text",
      };

      dispatch(addMessage({ chatId: activeChatId, message: replyMsg }));
      dispatch(
        updateLastMessage({
          chatId: activeChatId,
          text: replyMsg.text,
          timestamp: replyTime,
          isOutgoing: false,
          status: "read",
        }),
      );
    }, 1500);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <footer className="relative flex items-end gap-1 sm:gap-2 px-1.5 sm:px-3 py-1.5 sm:py-2.5 bg-[#f0f2f5] dark:bg-[#202c33] border-t border-[#e9edef] dark:border-[#222d34] select-none z-20 w-full">
      {/* Attachment popout list */}
      {showAttachments && (
        <div className="absolute bottom-14 left-2 sm:left-4 flex flex-col gap-2 p-2 sm:p-3 bg-white dark:bg-[#233138] rounded-2xl shadow-xl border border-[#e9edef] dark:border-[#222d34] animate-fade-in max-w-[calc(100vw-32px)] z-50">
          <button
            onClick={() =>
              handleSend(
                "image",
                "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=600&auto=format&fit=crop&q=80",
                "Shared screenshot asset",
              )
            }
            className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl hover:bg-[#f0f2f5] dark:hover:bg-[#182229] transition-colors text-xs sm:text-sm text-[#111b21] dark:text-[#e9edef] w-full text-left"
          >
            <span className="p-2 bg-[#bf59cf] rounded-full text-white shrink-0">
              <ImageIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </span>
            <span className="truncate">Photos & Videos Placeholder</span>
          </button>

          <button
            onClick={() => handleSend("file", null, "Project-Summary.docx")}
            className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl hover:bg-[#f0f2f5] dark:hover:bg-[#182229] transition-colors text-xs sm:text-sm text-[#111b21] dark:text-[#e9edef] w-full text-left"
          >
            <span className="p-2 bg-[#53bdeb] rounded-full text-white shrink-0">
              <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </span>
            <span className="truncate">Document Placeholder</span>
          </button>
        </div>
      )}

      <div className="flex items-center gap-0.5 sm:gap-1 pb-1 sm:pb-1 text-[#54656f] dark:text-[#aebac1] shrink-0">
        <button
          className="p-1.5 sm:p-2 rounded-full hover:bg-[#e4e7eb] dark:hover:bg-[#2a3942] transition-colors"
          title="Emojis"
        >
          <Smile className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>

        <button
          onClick={() => setShowAttachments(!showAttachments)}
          className={cn(
            "p-1.5 sm:p-2 rounded-full hover:bg-[#e4e7eb] dark:hover:bg-[#2a3942] transition-colors",
            showAttachments && "bg-[#e4e7eb] dark:bg-[#2a3942] text-[#00a884]",
          )}
          title="Attach files"
        >
          <Paperclip className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
      </div>

      <div className="flex-1 min-w-0 relative">
        <textarea
          ref={textareaRef}
          rows={1}
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message"
          className="w-full resize-none rounded-lg bg-white dark:bg-[#2a3942] px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-[#111b21] dark:text-[#e9edef] placeholder:text-[#667781] dark:placeholder:text-[#8696a0] focus:outline-none max-h-24 block leading-relaxed"
        />
      </div>

      <div className="pb-0.5 sm:pb-1 shrink-0">
        {messageText.trim() ? (
          <button
            onClick={() => handleSend()}
            className="p-2 sm:p-2.5 rounded-full bg-[#00a884] text-white hover:bg-[#008f72] transition-colors shadow-sm flex items-center justify-center"
            title="Send Message"
          >
            <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-white" />
          </button>
        ) : (
          <button
            className="p-1.5 sm:p-2 rounded-full text-[#54656f] dark:text-[#aebac1] hover:bg-[#e4e7eb] dark:hover:bg-[#2a3942] transition-colors flex items-center justify-center"
            title="Voice Message"
          >
            <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        )}
      </div>
    </footer>
  );
}
