"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Smile,
  Paperclip,
  Mic,
  Send,
  Image as ImageIcon,
  FileText,
  X,
  UploadCloud,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "../../hooks/useRedux";
import { addMessage, replaceOptimisticMessage, updateMessageStatus } from "../../redux/slices/messageSlice";
import { updateLastMessage } from "../../redux/slices/chatSlice";
import { messageService } from "../../services/messageService";
import { storageService } from "../../services/storageService";
import { realtimeService } from "../../services/realtimeService";
import { cn } from "../../utils/cn";

export function ChatInput() {
  const dispatch = useAppDispatch();
  const activeChatId = useAppSelector((state) => state.chat.activeChatId);
  const user = useAppSelector((state) => state.auth.user);

  const [messageText, setMessageText] = useState("");
  const [showAttachments, setShowAttachments] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]); // [{ id, file, type, previewUrl, sizeString, isUploading }]
  const [isDragging, setIsDragging] = useState(false);
  const [toastError, setToastError] = useState("");

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Auto-grow textarea gracefully
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      if (messageText) {
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 100)}px`;
      }
    }
  }, [messageText]);

  // Handle keystroke typing broadcast triggers
  useEffect(() => {
    if (!activeChatId || !user?.id) return;

    if (messageText.trim()) {
      realtimeService.broadcastTypingEvent(activeChatId, user.id, true);

      // Debounce teardown
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        realtimeService.broadcastTypingEvent(activeChatId, user.id, false);
      }, 2000);
    } else {
      realtimeService.broadcastTypingEvent(activeChatId, user.id, false);
    }

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [messageText, activeChatId, user?.id]);

  // Clean error toasts
  useEffect(() => {
    if (toastError) {
      const timer = setTimeout(() => setToastError(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastError]);

  // Format bytes for beautiful preview sizes
  const formatBytes = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // Helper handling binary payloads mapping
  const processFiles = (files) => {
    const validExtensions = ["png", "jpg", "jpeg", "webp", "pdf", "doc", "docx", "zip", "txt", "mp4"];
    const maxSizeBytes = 20 * 1024 * 1024; // 20MB limit

    const processed = [];
    let hasOversized = false;
    let hasInvalidExt = false;

    Array.from(files).forEach((file) => {
      // Size check
      if (file.size > maxSizeBytes) {
        hasOversized = true;
        return;
      }

      const ext = file.name.split(".").pop().toLowerCase();
      if (!validExtensions.includes(ext)) {
        hasInvalidExt = true;
        return;
      }

      const isImage = ["png", "jpg", "jpeg", "webp"].includes(ext);
      const isVideo = ext === "mp4";
      const resolvedType = isImage ? "image" : isVideo ? "video" : "file";

      let previewUrl = null;
      if (isImage || isVideo) {
        previewUrl = URL.createObjectURL(file);
      }

      processed.push({
        id: "file-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
        file,
        type: resolvedType,
        previewUrl,
        sizeString: formatBytes(file.size),
        isUploading: false,
      });
    });

    if (hasOversized) {
      setToastError("One or more files exceed the maximum allowed size of 20MB.");
    } else if (hasInvalidExt) {
      setToastError("Unsupported format. Allowed: Images, MP4, PDF, DOCX, ZIP, TXT.");
    }

    if (processed.length > 0) {
      setSelectedFiles((prev) => [...prev, ...processed]);
    }
  };

  const handleFileSelectChange = (e) => {
    if (e.target.files?.length > 0) {
      processFiles(e.target.files);
      setShowAttachments(false);
      // Reset input ref context to trigger on identical file selections concurrently
      e.target.value = "";
    }
  };

  const removeSelectedFile = (targetId) => {
    setSelectedFiles((prev) => {
      const item = prev.find((f) => f.id === targetId);
      if (item?.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((f) => f.id !== targetId);
    });
  };

  // Drag and Drop framework management
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Verify mouse actually exited the footer strip before dismissing indicator layer
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files?.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  // Primary execution workflow handling simultaneous upload tasks and keystrokes
  const handleSendSubmit = async () => {
    const textToSend = messageText.trim();
    const filesToSend = [...selectedFiles];

    if (!textToSend && filesToSend.length === 0) return;
    if (!activeChatId || !user?.id) return;

    const timeString = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Clear buffer UI input items instantly for responsive user pacing
    setMessageText("");
    setSelectedFiles([]);
    setShowAttachments(false);
    realtimeService.broadcastTypingEvent(activeChatId, user.id, false);

    // 1. Process attachments concurrently via custom storage pipeline
    for (const fileObj of filesToSend) {
      const tempId = "msg-temp-file-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6);

      // Create preview UI fallback if binary asset hasn't generated string mapping
      const optimisticMsg = {
        id: tempId,
        text: fileObj.type === "file" ? fileObj.file.name : "",
        timestamp: timeString,
        isOutgoing: true,
        status: "sent",
        type: fileObj.type,
        mediaUrl: fileObj.previewUrl || null,
        fileName: fileObj.file.name,
        fileSize: fileObj.sizeString,
        senderId: user.id,
        createdAt: new Date().toISOString(),
      };

      dispatch(addMessage({ chatId: activeChatId, message: optimisticMsg }));
      dispatch(
        updateLastMessage({
          chatId: activeChatId,
          text: fileObj.type === "image" ? "📷 Photo" : fileObj.type === "video" ? "🎥 Video" : "📎 Document",
          timestamp: timeString,
          isOutgoing: true,
          status: "sent",
        })
      );

      try {
        // Direct stream insertion pipeline
        const uploadedAbsoluteUrl = await storageService.uploadFile(fileObj.file, fileObj.type + "s");

        const confirmedRow = await messageService.sendMessage({
          conversationId: activeChatId,
          senderId: user.id,
          text: fileObj.type === "file" ? fileObj.file.name : "",
          type: fileObj.type,
          mediaUrl: uploadedAbsoluteUrl,
          fileName: fileObj.file.name,
          fileSize: fileObj.sizeString,
          timestampString: timeString,
        });

        dispatch(
          replaceOptimisticMessage({
            chatId: activeChatId,
            tempId,
            confirmedMessage: {
              ...confirmedRow,
              isOutgoing: true,
            },
          })
        );
      } catch (err) {
        console.error("Storage document transfer failed:", err);
        dispatch(updateMessageStatus({ chatId: activeChatId, messageId: tempId, status: "failed" }));
      }
    }

    // 2. Submit standalone post text message payload if active
    if (textToSend) {
      const tempId = "msg-temp-text-" + Date.now();
      const optimisticMsg = {
        id: tempId,
        text: textToSend,
        timestamp: timeString,
        isOutgoing: true,
        status: "sent",
        type: "text",
        senderId: user.id,
        createdAt: new Date().toISOString(),
      };

      dispatch(addMessage({ chatId: activeChatId, message: optimisticMsg }));
      dispatch(
        updateLastMessage({
          chatId: activeChatId,
          text: textToSend,
          timestamp: timeString,
          isOutgoing: true,
          status: "sent",
        })
      );

      try {
        const confirmedRow = await messageService.sendMessage({
          conversationId: activeChatId,
          senderId: user.id,
          text: textToSend,
          type: "text",
          timestampString: timeString,
        });

        dispatch(
          replaceOptimisticMessage({
            chatId: activeChatId,
            tempId,
            confirmedMessage: {
              ...confirmedRow,
              isOutgoing: true,
            },
          })
        );
      } catch (err) {
        dispatch(updateMessageStatus({ chatId: activeChatId, messageId: tempId, status: "failed" }));
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendSubmit();
    }
  };

  const triggerFileInput = (acceptFilter) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = acceptFilter;
      fileInputRef.current.click();
    }
  };

  return (
    <footer
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative flex flex-col px-1.5 sm:px-3 py-1.5 sm:py-2.5 bg-wa-header border-t border-wa-border select-none z-20 w-full shrink-0 transition-colors duration-200"
    >
      {/* Glossy Drag and drop boundary layer indicator */}
      {isDragging && (
        <div className="absolute inset-0 bg-wa-modal/90 backdrop-blur-xs border-2 border-dashed border-wa-primary rounded-lg m-1.5 z-50 flex flex-col items-center justify-center transition-all pointer-events-none">
          <UploadCloud className="h-10 w-10 text-wa-primary animate-bounce mb-2" />
          <span className="text-sm font-medium text-wa-text">Drop media or files here to upload</span>
          <span className="text-xs text-wa-muted mt-1">Maximum size limit: 20MB per item</span>
        </div>
      )}

      {/* Warning toast alert strip */}
      {toastError && (
        <div className="absolute -top-12 left-4 right-4 bg-red-600 text-white text-xs py-2 px-3 rounded-md shadow-md flex items-center gap-2 z-40 animate-fade-in">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="truncate flex-1">{toastError}</span>
          <button onClick={() => setToastError("")} className="hover:opacity-80 shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Hidden custom multi-file dialog connection element */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelectChange}
        multiple
        className="hidden"
      />

      {/* Attachment popout selector list */}
      {showAttachments && (
        <div className="absolute bottom-14 left-2 sm:left-4 flex flex-col gap-2 p-2 sm:p-3 bg-wa-modal rounded-2xl shadow-xl border border-wa-border animate-fade-in max-w-[calc(100vw-32px)] z-50 transition-colors">
          <button
            onClick={() => triggerFileInput("image/*,video/mp4")}
            className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl hover:bg-wa-hover transition-colors text-xs sm:text-sm text-wa-text w-full text-left"
          >
            <span className="p-2 bg-[#bf59cf] rounded-full text-white shrink-0">
              <ImageIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </span>
            <span className="truncate">Photos & Videos</span>
          </button>

          <button
            onClick={() => triggerFileInput(".pdf,.doc,.docx,.zip,.txt")}
            className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl hover:bg-wa-hover transition-colors text-xs sm:text-sm text-wa-text w-full text-left"
          >
            <span className="p-2 bg-[#53bdeb] rounded-full text-white shrink-0">
              <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </span>
            <span className="truncate">Document</span>
          </button>
        </div>
      )}

      {/* Multiple File Preview Queue Header Strip */}
      {selectedFiles.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-2 border-b border-wa-border max-h-32 transition-all">
          {selectedFiles.map((fileObj) => (
            <div
              key={fileObj.id}
              className="relative flex items-center gap-2 bg-wa-input border border-wa-border rounded-lg p-1.5 shrink-0 max-w-[160px] sm:max-w-[200px]"
            >
              {fileObj.type === "image" || fileObj.type === "video" ? (
                <img
                  src={fileObj.previewUrl}
                  alt="preview"
                  className="h-10 w-10 object-cover rounded shrink-0 bg-black/10"
                />
              ) : (
                <div className="flex items-center justify-center h-10 w-10 rounded bg-wa-active text-wa-muted shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-wa-text truncate">{fileObj.file.name}</p>
                <p className="text-[10px] text-wa-muted truncate">{fileObj.sizeString}</p>
              </div>

              <button
                onClick={() => removeSelectedFile(fileObj.id)}
                className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-wa-active border border-wa-border text-wa-text hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center shadow-xs"
                title="Remove File"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Primary Bottom input control console */}
      <div className="flex items-end gap-1 sm:gap-2 w-full">
        <div className="flex items-center gap-0.5 sm:gap-1 pb-1 sm:pb-1 text-wa-muted shrink-0">
          <button className="p-1.5 sm:p-2 rounded-full hover:bg-wa-active transition-colors" title="Emojis">
            <Smile className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>

          <button
            onClick={() => setShowAttachments(!showAttachments)}
            className={cn(
              "p-1.5 sm:p-2 rounded-full hover:bg-wa-active transition-colors",
              showAttachments && "bg-wa-active text-wa-primary"
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
            placeholder={selectedFiles.length > 0 ? "Add a caption..." : "Message"}
            className="w-full resize-none rounded-lg bg-wa-input px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-wa-text placeholder:text-wa-muted focus:outline-none max-h-24 block leading-normal transition-colors"
          />
        </div>

        <div className="pb-0.5 sm:pb-1 shrink-0">
          {messageText.trim() || selectedFiles.length > 0 ? (
            <button
              onClick={handleSendSubmit}
              className="p-2 sm:p-2.5 rounded-full bg-wa-primary text-white hover:bg-wa-primary-hover transition-colors shadow-sm flex items-center justify-center"
              title="Send Message"
            >
              <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-white" />
            </button>
          ) : (
            <button
              className="p-1.5 sm:p-2 rounded-full text-wa-muted hover:bg-wa-active transition-colors flex items-center justify-center"
              title="Voice Message"
            >
              <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          )}
        </div>
      </div>
    </footer>
  );
}
