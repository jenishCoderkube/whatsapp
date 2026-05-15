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
  AlertCircle,
  Trash2,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "../../hooks/useRedux";
import {
  addMessage,
  replaceOptimisticMessage,
  updateMessageStatus,
} from "../../redux/slices/messageSlice";
import { updateLastMessage } from "../../redux/slices/chatSlice";
import { messageService } from "../../services/messageService";
import { storageService } from "../../services/storageService";
import { realtimeService } from "../../services/realtimeService";
import { cn } from "../../utils/cn";

const popularEmojis = [
  "😀",
  "😃",
  "😄",
  "😁",
  "😆",
  "😅",
  "😂",
  "🤣",
  "🥲",
  "😊",
  "😇",
  "🙂",
  "🙃",
  "😉",
  "😌",
  "😍",
  "🥰",
  "😘",
  "😗",
  "😙",
  "😚",
  "😋",
  "😛",
  "😝",
  "😜",
  "🤪",
  "🤨",
  "🧐",
  "🤓",
  "😎",
  "🤩",
  "🥳",
  "😏",
  "😒",
  "😞",
  "😔",
  "😟",
  "😕",
  "🙁",
  "☹️",
  "😣",
  "😖",
  "😫",
  "😩",
  "🥺",
  "😢",
  "😭",
  "😤",
  "😠",
  "😡",
  "🤬",
  "🤯",
  "😳",
  "🥵",
  "🥶",
  "😱",
  "😨",
  "😰",
  "😥",
  "😓",
  "🤗",
  "🤔",
  "🤭",
  "🤫",
  "🤥",
  "😶",
  "😐",
  "😑",
  "😬",
  "🙄",
  "😯",
  "😦",
  "😧",
  "😮",
  "😲",
  "🥱",
  "😴",
  "🤤",
  "😪",
  "😵",
  "🤐",
  "🥴",
  "🤢",
  "🤮",
  "🤧",
  "😷",
  "🤒",
  "🤕",
  "🤑",
  "🤠",
  "😈",
  "👿",
  "👹",
  "👺",
  "🤡",
  "💩",
  "👻",
  "💀",
  "👽",
  "👾",
  "🤖",
  "🎃",
  "❤️",
  "🧡",
  "💛",
  "💚",
  "💙",
  "💜",
  "🖤",
  "🤍",
  "🤎",
  "💔",
  "❣️",
  "💕",
  "💞",
  "💓",
  "💗",
  "💖",
  "💘",
  "💝",
  "👍",
  "👎",
  "👏",
  "🙌",
  "👐",
  "🤲",
  "🤝",
  "🙏",
  "💪",
  "✨",
  "🔥",
  "🎉",
  "💯",
  "🚀",
  "🌟",
];

export function ChatInput() {
  const dispatch = useAppDispatch();
  const activeChatId = useAppSelector((state) => state.chat.activeChatId);
  const user = useAppSelector((state) => state.auth.user);

  const [messageText, setMessageText] = useState("");
  const [showAttachments, setShowAttachments] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [toastError, setToastError] = useState("");

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const attachmentsRef = useRef(null);
  const emojiPickerRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      if (recordingIntervalRef.current)
        clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone permission denied or device error:", err);
      setToastError(
        "Microphone access denied. Please allow permissions to record voice notes.",
      );
    }
  };

  const cancelVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      try {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream
          .getTracks()
          .forEach((track) => track.stop());
      } catch (e) {}
    }
    if (recordingIntervalRef.current)
      clearInterval(recordingIntervalRef.current);
    setIsRecording(false);
    setRecordingDuration(0);
    audioChunksRef.current = [];
  };

  const sendVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = async () => {
        if (recordingIntervalRef.current)
          clearInterval(recordingIntervalRef.current);
        try {
          mediaRecorderRef.current.stream
            .getTracks()
            .forEach((track) => track.stop());
        } catch (e) {}

        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        setIsRecording(false);
        const finalDurationSeconds = recordingDuration;
        setRecordingDuration(0);
        audioChunksRef.current = [];

        if (audioBlob.size < 100 || finalDurationSeconds < 1) {
          setToastError("Voice recording too short.");
          return;
        }

        const mins = Math.floor(finalDurationSeconds / 60);
        const secs = finalDurationSeconds % 60;
        const durationStr = `${mins}:${secs < 10 ? "0" : ""}${secs}`;

        const voiceFile = new File(
          [audioBlob],
          `voice_note_${Date.now()}.webm`,
          { type: "audio/webm" },
        );

        const tempId = "msg-temp-voice-" + Date.now();
        const timeString = new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });

        const optimisticMsg = {
          id: tempId,
          text: "",
          timestamp: timeString,
          isOutgoing: true,
          status: "sent",
          type: "voice",
          duration: durationStr,
          senderId: user?.id,
          createdAt: new Date().toISOString(),
        };

        dispatch(addMessage({ chatId: activeChatId, message: optimisticMsg }));
        dispatch(
          updateLastMessage({
            chatId: activeChatId,
            text: "🎤 Voice Message",
            timestamp: timeString,
            isOutgoing: true,
            status: "sent",
          }),
        );

        try {
          const uploadedUrl = await storageService.uploadFile(
            voiceFile,
            "voice",
          );

          const confirmedRow = await messageService.sendMessage({
            conversationId: activeChatId,
            senderId: user?.id,
            text: "",
            type: "voice",
            mediaUrl: uploadedUrl,
            duration: durationStr,
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
            }),
          );
        } catch (err) {
          console.error("Voice file payload storage upload exception:", err);
          dispatch(
            updateMessageStatus({
              chatId: activeChatId,
              messageId: tempId,
              status: "failed",
            }),
          );
        }
      };

      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
  };

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current)
        clearInterval(recordingIntervalRef.current);
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        try {
          mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
        } catch (e) {}
      }
    };
  }, []);

  // Auto-close attachment/emoji dropdowns natively on outside clicks and Escape keystrokes
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (
        showAttachments &&
        attachmentsRef.current &&
        !attachmentsRef.current.contains(e.target)
      ) {
        setShowAttachments(false);
      }
      if (
        showEmojiPicker &&
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target)
      ) {
        setShowEmojiPicker(false);
      }
    };

    const handleEscKey = (e) => {
      if (e.key === "Escape") {
        setShowAttachments(false);
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscKey);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [showAttachments, showEmojiPicker]);

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
      realtimeService.broadcastTypingEvent(
        activeChatId,
        user.id,
        true,
        user.name,
      );

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        realtimeService.broadcastTypingEvent(
          activeChatId,
          user.id,
          false,
          user.name,
        );
      }, 2000);
    } else {
      realtimeService.broadcastTypingEvent(
        activeChatId,
        user.id,
        false,
        user.name,
      );
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

  // Support Reply action natively
  useEffect(() => {
    const handleReply = (e) => {
      const { text: replyText, senderName } = e.detail || {};
      if (replyText) {
        const snippet =
          replyText.length > 40
            ? replyText.substring(0, 40) + "..."
            : replyText;
        const prefix = `Replying to ${senderName || "peer"}: "${snippet}"\n`;
        setMessageText((prev) => (prev ? prev + "\n" + prefix : prefix));
        setTimeout(() => textareaRef.current?.focus(), 50);
      }
    };
    window.addEventListener("wa_reply_trigger", handleReply);
    return () => window.removeEventListener("wa_reply_trigger", handleReply);
  }, []);

  const formatBytes = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const processFiles = (files) => {
    const validExtensions = [
      "png",
      "jpg",
      "jpeg",
      "webp",
      "pdf",
      "doc",
      "docx",
      "zip",
      "txt",
      "mp4",
    ];
    const maxSizeBytes = 20 * 1024 * 1024;

    const processed = [];
    let hasOversized = false;
    let hasInvalidExt = false;

    Array.from(files).forEach((file) => {
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
        id:
          "file-" +
          Date.now() +
          "-" +
          Math.random().toString(36).substring(2, 7),
        file,
        type: resolvedType,
        previewUrl,
        sizeString: formatBytes(file.size),
        isUploading: false,
      });
    });

    if (hasOversized) {
      setToastError(
        "One or more files exceed the maximum allowed size of 20MB.",
      );
    } else if (hasInvalidExt) {
      setToastError(
        "Unsupported format. Allowed: Images, MP4, PDF, DOCX, ZIP, TXT.",
      );
    }

    if (processed.length > 0) {
      setSelectedFiles((prev) => [...prev, ...processed]);
    }
  };

  const handleFileSelectChange = (e) => {
    if (e.target.files?.length > 0) {
      processFiles(e.target.files);
      setShowAttachments(false);
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

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
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

  const handleSendSubmit = async () => {
    const textToSend = messageText.trim();
    const filesToSend = [...selectedFiles];

    if (!textToSend && filesToSend.length === 0) return;
    if (!activeChatId || !user?.id) return;

    const timeString = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    setMessageText("");
    setSelectedFiles([]);
    setShowAttachments(false);
    setShowEmojiPicker(false);
    realtimeService.broadcastTypingEvent(
      activeChatId,
      user.id,
      false,
      user.name,
    );

    for (const fileObj of filesToSend) {
      const tempId =
        "msg-temp-file-" +
        Date.now() +
        "-" +
        Math.random().toString(36).substring(2, 6);

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
          text:
            fileObj.type === "image"
              ? "📷 Photo"
              : fileObj.type === "video"
                ? "🎥 Video"
                : "📎 Document",
          timestamp: timeString,
          isOutgoing: true,
          status: "sent",
        }),
      );

      try {
        const uploadedAbsoluteUrl = await storageService.uploadFile(
          fileObj.file,
          fileObj.type + "s",
        );

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
          }),
        );
      } catch (err) {
        if (err.message === "OFFLINE_PENDING") {
          const pendingOfflineMsg = err.pendingMsg || { ...optimisticMsg, status: "pending" };
          
          dispatch(
            replaceOptimisticMessage({
              chatId: activeChatId,
              tempId,
              confirmedMessage: {
                ...pendingOfflineMsg,
                id: tempId, // Keep UI ID for now
                isOutgoing: true,
              },
            }),
          );
          
          import("../../services/indexedDBService").then(({ indexedDBService }) => {
             indexedDBService.savePendingMessage({ ...pendingOfflineMsg, uiId: tempId }, fileObj.file).catch(console.error);
          });
        } else {
          console.error("Storage document transfer failed:", err);
          dispatch(
            updateMessageStatus({
              chatId: activeChatId,
              messageId: tempId,
              status: "failed",
            }),
          );
        }
      }
    }

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
        }),
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
          }),
        );
      } catch (err) {
        if (err.message === "OFFLINE_PENDING") {
          const pendingOfflineMsg = err.pendingMsg || { ...optimisticMsg, status: "pending" };
          
          dispatch(
            replaceOptimisticMessage({
              chatId: activeChatId,
              tempId,
              confirmedMessage: {
                ...pendingOfflineMsg,
                id: tempId,
                isOutgoing: true,
              },
            }),
          );
          
          import("../../services/indexedDBService").then(({ indexedDBService }) => {
             indexedDBService.savePendingMessage({ ...pendingOfflineMsg, uiId: tempId }).catch(console.error);
          });
        } else {
          dispatch(
            updateMessageStatus({
              chatId: activeChatId,
              messageId: tempId,
              status: "failed",
            }),
          );
        }
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

  const activeChat = useAppSelector((state) =>
    state.chat.chats.find((c) => c.id === activeChatId),
  );
  const isLeft = activeChat?.isLeft;

  if (isLeft) {
    return (
      <footer className="relative flex items-center justify-center px-4 py-6 bg-wa-header border-t border-wa-border select-none z-20 w-full shrink-0">
        {/* <div className="bg-wa-active/50 px-4 py-2 rounded-lg border border-wa-border"> */}
        <p className="text-sm text-wa-muted font-medium italic">
          You are no longer a participant in this group
        </p>
        {/* </div> */}
      </footer>
    );
  }

  return (
    <footer
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative flex flex-col px-1.5 sm:px-3 py-1.5 sm:py-2.5 bg-wa-header border-t border-wa-border select-none z-20 w-full shrink-0 transition-colors duration-200"
    >
      {isDragging && (
        <div className="absolute inset-0 bg-wa-modal/90 backdrop-blur-xs border-2 border-dashed border-wa-primary rounded-lg m-1.5 z-50 flex flex-col items-center justify-center transition-all pointer-events-none">
          <UploadCloud className="h-10 w-10 text-wa-primary animate-bounce mb-2" />
          <span className="text-sm font-medium text-wa-text">
            Drop media or files here to upload
          </span>
          <span className="text-xs text-wa-muted mt-1">
            Maximum size limit: 20MB per item
          </span>
        </div>
      )}

      {toastError && (
        <div className="absolute -top-12 left-4 right-4 bg-red-600 text-white text-xs py-2 px-3 rounded-md shadow-md flex items-center gap-2 z-40 animate-fade-in">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="truncate flex-1">{toastError}</span>
          <button
            onClick={() => setToastError("")}
            className="hover:opacity-80 shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelectChange}
        multiple
        className="hidden"
      />

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
                <p className="text-[11px] font-medium text-wa-text truncate">
                  {fileObj.file.name}
                </p>
                <p className="text-[10px] text-wa-muted truncate">
                  {fileObj.sizeString}
                </p>
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

      <div className="flex items-end gap-1 sm:gap-2 w-full">
        {isRecording ? (
          <div className="flex items-center justify-between w-full px-2 py-1 select-none animate-fade-in gap-3">
            <div className="flex items-center gap-2.5">
              <span className="h-3 w-3 rounded-full bg-red-500 animate-pulse shrink-0" />
              <span className="text-xs sm:text-sm font-medium text-red-500 font-mono tracking-wider">
                Recording: {Math.floor(recordingDuration / 60)}:
                {recordingDuration % 60 < 10 ? "0" : ""}
                {recordingDuration % 60}
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <button
                onClick={cancelVoiceRecording}
                className="p-2 rounded-full text-wa-muted hover:bg-wa-hover hover:text-red-500 transition-colors flex items-center justify-center cursor-pointer"
                title="Discard recording"
              >
                <Trash2 className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
              </button>
              <button
                onClick={sendVoiceRecording}
                className="p-2 sm:p-2.5 rounded-full bg-wa-primary text-white hover:bg-wa-primary-hover transition-colors shadow-sm flex items-center justify-center cursor-pointer animate-scale-up"
                title="Send Voice Message"
              >
                <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-white" />
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-0.5 sm:gap-1 pb-1 sm:pb-1 text-wa-muted shrink-0">
              {/* EMOJI PICKER POPUP SYSTEM */}
              <div ref={emojiPickerRef} className="relative">
                <button
                  onClick={() => {
                    setShowEmojiPicker(!showEmojiPicker);
                    if (showAttachments) setShowAttachments(false);
                  }}
                  className={cn(
                    "p-1.5 sm:p-2 rounded-full hover:bg-wa-active transition-colors block",
                    showEmojiPicker && "bg-wa-active text-wa-primary",
                  )}
                  title="Emojis"
                >
                  <Smile className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>

                {showEmojiPicker && (
                  <div className="absolute bottom-12 left-0 w-72 sm:w-80 bg-wa-modal border border-wa-border rounded-2xl shadow-2xl p-3 z-50 animate-fade-in flex flex-col max-h-72 select-none">
                    <div className="text-xs font-semibold text-wa-muted mb-2 px-1">
                      Frequently Used Emojis
                    </div>
                    <div className="flex-1 overflow-y-auto grid grid-cols-7 gap-1.5 pr-1 rounded-lg">
                      {popularEmojis.map((emoji, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setMessageText((prev) => prev + emoji);
                            setTimeout(() => textareaRef.current?.focus(), 0);
                          }}
                          className="text-lg sm:text-xl hover:bg-wa-active rounded transition-transform hover:scale-125 flex items-center justify-center p-1 cursor-pointer"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ATTACHMENT POPOUT SYSTEM */}
              <div ref={attachmentsRef} className="relative">
                <button
                  onClick={() => {
                    setShowAttachments(!showAttachments);
                    if (showEmojiPicker) setShowEmojiPicker(false);
                  }}
                  className={cn(
                    "p-1.5 sm:p-2 rounded-full hover:bg-wa-active transition-colors block",
                    showAttachments && "bg-wa-active text-wa-primary",
                  )}
                  title="Attach files"
                >
                  <Paperclip className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>

                {showAttachments && (
                  <div className="absolute bottom-12 left-0 flex flex-col gap-2 p-2 sm:p-3 bg-wa-modal rounded-2xl shadow-xl border border-wa-border animate-fade-in w-52 z-50 transition-colors">
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
                      onClick={() =>
                        triggerFileInput(".pdf,.doc,.docx,.zip,.txt")
                      }
                      className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl hover:bg-wa-hover transition-colors text-xs sm:text-sm text-wa-text w-full text-left"
                    >
                      <span className="p-2 bg-[#53bdeb] rounded-full text-white shrink-0">
                        <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </span>
                      <span className="truncate">Document</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0 relative">
              <textarea
                ref={textareaRef}
                rows={1}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  selectedFiles.length > 0 ? "Add a caption..." : "Message"
                }
                className="w-full resize-none rounded-lg bg-wa-input px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-wa-text placeholder:text-wa-muted focus:outline-none max-h-24 block leading-normal transition-colors"
              />
            </div>

            <div className="pb-0.5 sm:pb-1 shrink-0">
              {messageText.trim() || selectedFiles.length > 0 ? (
                <button
                  onClick={handleSendSubmit}
                  className="p-2 sm:p-2.5 rounded-full bg-wa-primary text-white hover:bg-wa-primary-hover transition-colors shadow-sm flex items-center justify-center cursor-pointer"
                  title="Send Message"
                >
                  <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-white" />
                </button>
              ) : (
                <button
                  onClick={startVoiceRecording}
                  className="p-1.5 sm:p-2 rounded-full text-wa-muted hover:bg-wa-active transition-colors flex items-center justify-center cursor-pointer"
                  title="Voice Message"
                >
                  <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </footer>
  );
}
