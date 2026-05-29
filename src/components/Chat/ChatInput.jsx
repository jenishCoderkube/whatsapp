"use client";

import React, { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
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
  MapPin,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "../../hooks/useRedux";
import { useTranslation } from "../../hooks/useTranslation";
import {
  addMessage,
  replaceOptimisticMessage,
  updateMessageStatus,
  updateMessage,
} from "../../redux/slices/messageSlice";
import { updateLastMessage, setDraft, deleteDraft } from "../../redux/slices/chatSlice";
import { setEditingMessage, setReplyingMessage } from "../../redux/slices/uiSlice";
import { messageService } from "../../services/messageService";
import { storageService } from "../../services/storageService";
import { realtimeService } from "../../services/realtimeService";
import { cn } from "../../utils/cn";
import { chatService } from "../../services/chatService";
import { Avatar } from "../ui/Avatar";
import { locationService } from "../../services/locationService";
import LocationDurationModal from "./LocationDurationModal";
import { useAudioRecorder } from "../../hooks/useAudioRecorder";
import { indexedDBService } from "../../services/indexedDBService";

const EmojiPickerLoading = () => {
  const { t } = useTranslation();
  return (
    <div className="w-[320px] h-[380px] bg-wa-modal flex items-center justify-center text-xs text-wa-muted">
      {t("chat.loading_emojis")}
    </div>
  );
};

const EmojiPicker = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
  loading: EmojiPickerLoading,
});

const stickerPacks = {
  animals: [
    { id: "cat_hello", url: "https://media.giphy.com/media/C45B95c0l6lC0tD0Ld/giphy.gif", name: "Cat Hello" },
    { id: "dog_dance", url: "https://media.giphy.com/media/1zR6CTJa4LIW1bT2IB/giphy.gif", name: "Dog Dance" },
    { id: "panda_love", url: "https://media.giphy.com/media/KzDqCGEHsYu3hO3Msp/giphy.gif", name: "Panda Love" },
    { id: "bunny_wave", url: "https://media.giphy.com/media/Zdg7gcrPmev6K1n1vV/giphy.gif", name: "Bunny Wave" }
  ],
  expressions: [
    { id: "cool_shiba", url: "https://media.giphy.com/media/Svc9t699Kls0U8wJpx/giphy.gif", name: "Cool Shiba" },
    { id: "happy_blob", url: "https://media.giphy.com/media/TdfmKup2Fk4YxO1m9T/giphy.gif", name: "Happy Blob" },
    { id: "sad_pepe", url: "https://media.giphy.com/media/L95W4WdxnEKEz278wx/giphy.gif", name: "Sad Pepe" },
    { id: "angry_duck", url: "https://media.giphy.com/media/5t9wFB8dB09GnV1NRn/giphy.gif", name: "Angry Duck" }
  ],
  memes: [
    { id: "crying_cat", url: "https://media.giphy.com/media/d2lcHJTG5TGIg/giphy.gif", name: "Crying Cat" },
    { id: "spongebob_hearts", url: "https://media.giphy.com/media/yFQ0ywscgobJK/giphy.gif", name: "SpongeBob Hearts" },
    { id: "doge_spin", url: "https://media.giphy.com/media/HCTfY92mXJADm/giphy.gif", name: "Doge Spin" },
    { id: "thumbs_up_seal", url: "https://media.giphy.com/media/26tPplGWjC0CrVWsE/giphy.gif", name: "Thumbs Up Seal" }
  ]
};

const fetchGifs = async (query = "") => {
  try {
    const apiKey = "dc6zaTOxFJmzC"; // public Giphy API key
    const url = query
      ? `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=16`
      : `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=16`;
    const res = await fetch(url);
    const json = await res.json();
    if (json && json.data) {
      return json.data.map(item => ({
        id: item.id,
        url: item.images.fixed_height.url,
        title: item.title
      }));
    }
  } catch (e) {
    console.warn("Failed to fetch gifs from Giphy", e);
  }
  return [
    { id: "celebrate", url: "https://media.giphy.com/media/26tPplGWjC0CrVWsE/giphy.gif", title: "Celebrate" },
    { id: "wave", url: "https://media.giphy.com/media/3o7TKoWXm3okO1kgdW/giphy.gif", title: "Wave Hello" },
    { id: "laugh", url: "https://media.giphy.com/media/l8aCBaBuz5R6M/giphy.gif", title: "Laughing Dog" },
    { id: "mindblown", url: "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif", title: "Mind Blown" },
    { id: "popcorn", url: "https://media.giphy.com/media/hVTouqNm67IIfICKcH/giphy.gif", title: "Eating Popcorn" },
    { id: "happy", url: "https://media.giphy.com/media/l3q2zVr6cu95nF6O4/giphy.gif", title: "Happy Dance" }
  ];
};

function GifPickerPanel({ onSelect }) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const results = await fetchGifs(query);
      if (active) {
        setGifs(results);
        setLoading(false);
      }
    };
    const debounce = setTimeout(load, 300);
    return () => {
      active = false;
      clearTimeout(debounce);
    };
  }, [query]);

  return (
    <div className="flex flex-col h-full bg-wa-modal text-wa-text p-2">
      <div className="px-2 pb-2 shrink-0">
        <input
          type="text"
          placeholder="Search GIFs via Giphy..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-wa-input text-wa-text border border-wa-border rounded-lg px-3 py-1.5 text-xs sm:text-sm focus:outline-none focus:border-wa-primary"
        />
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 grid grid-cols-2 gap-1.5 p-1 select-none custom-scrollbar">
        {loading ? (
          <div className="col-span-2 text-center text-xs text-wa-muted py-8">Loading GIFs...</div>
        ) : gifs.length === 0 ? (
          <div className="col-span-2 text-center text-xs text-wa-muted py-8">No GIFs found</div>
        ) : (
          gifs.map((gif) => (
            <button
              key={gif.id}
              onClick={() => onSelect(gif.url)}
              className="relative aspect-video w-full rounded-md overflow-hidden hover:opacity-85 active:scale-95 transition-all bg-black/5"
            >
              <img
                src={gif.url}
                alt={gif.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function StickerPickerPanel({ onSelect }) {
  const [activeTab, setActiveTab] = useState("all"); 
  const [activePack, setActivePack] = useState("animals"); 
  const [recents, setRecents] = useState([]);
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    try {
      const storedRecents = JSON.parse(localStorage.getItem("wa_recent_stickers") || "[]");
      const storedFavs = JSON.parse(localStorage.getItem("wa_favorite_stickers") || "[]");
      setRecents(storedRecents);
      setFavorites(storedFavs);
    } catch (e) {
      console.warn("Failed to load local sticker states", e);
    }
  }, []);

  const handleSelectSticker = (url) => {
    try {
      const storedRecents = JSON.parse(localStorage.getItem("wa_recent_stickers") || "[]");
      const filtered = storedRecents.filter(x => x !== url);
      const newRecents = [url, ...filtered].slice(0, 24); 
      localStorage.setItem("wa_recent_stickers", JSON.stringify(newRecents));
      setRecents(newRecents);
    } catch (e) {}
    onSelect(url);
  };

  const toggleFavorite = (e, url) => {
    e.stopPropagation();
    try {
      const storedFavs = JSON.parse(localStorage.getItem("wa_favorite_stickers") || "[]");
      let newFavs;
      if (storedFavs.includes(url)) {
        newFavs = storedFavs.filter(x => x !== url);
      } else {
        newFavs = [url, ...storedFavs];
      }
      localStorage.setItem("wa_favorite_stickers", JSON.stringify(newFavs));
      setFavorites(newFavs);
    } catch (err) {}
  };

  return (
    <div className="flex flex-col h-full bg-wa-modal text-wa-text p-2">
      <div className="flex gap-1.5 px-2 pb-2 text-[10px] sm:text-[11px] font-bold border-b border-wa-border shrink-0 select-none">
        <button
          onClick={() => setActiveTab("all")}
          className={cn(
            "px-2.5 py-1 rounded-full border border-wa-border transition-colors",
            activeTab === "all" ? "bg-wa-primary text-white border-wa-primary" : "bg-transparent text-wa-muted hover:text-wa-text"
          )}
        >
          All Packs
        </button>
        <button
          onClick={() => setActiveTab("recent")}
          className={cn(
            "px-2.5 py-1 rounded-full border border-wa-border transition-colors flex items-center gap-1",
            activeTab === "recent" ? "bg-wa-primary text-white border-wa-primary" : "bg-transparent text-wa-muted hover:text-wa-text"
          )}
        >
          🕒 Recent
        </button>
        <button
          onClick={() => setActiveTab("favorites")}
          className={cn(
            "px-2.5 py-1 rounded-full border border-wa-border transition-colors flex items-center gap-1",
            activeTab === "favorites" ? "bg-wa-primary text-white border-wa-primary" : "bg-transparent text-wa-muted hover:text-wa-text"
          )}
        >
          ⭐ Favorites
        </button>
      </div>

      {activeTab === "all" && (
        <div className="flex gap-2 px-2 py-1.5 text-[9px] sm:text-[10px] uppercase tracking-wider shrink-0 select-none font-semibold">
          {Object.keys(stickerPacks).map((packName) => (
            <button
              key={packName}
              onClick={() => setActivePack(packName)}
              className={cn(
                "hover:text-wa-primary transition-colors",
                activePack === packName ? "text-wa-primary underline underline-offset-4 decoration-2" : "text-wa-muted"
              )}
            >
              {packName}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0 grid grid-cols-4 gap-2.5 p-2 select-none custom-scrollbar mt-1">
        {activeTab === "all" && (
          stickerPacks[activePack].map((sticker) => {
            const isStarred = favorites.includes(sticker.url);
            return (
              <div
                key={sticker.id}
                onClick={() => handleSelectSticker(sticker.url)}
                className="group/item relative aspect-square w-full rounded-lg hover:bg-wa-hover flex items-center justify-center p-1.5 cursor-pointer hover:scale-105 active:scale-95 transition-all"
              >
                <img
                  src={sticker.url}
                  alt={sticker.name}
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
                <button
                  onClick={(e) => toggleFavorite(e, sticker.url)}
                  className="absolute top-0.5 right-0.5 p-0.5 bg-black/40 text-white rounded-full opacity-0 group-hover/item:opacity-100 transition-opacity hover:scale-110"
                >
                  <span className="text-[9px] block leading-none">{isStarred ? "⭐" : "☆"}</span>
                </button>
              </div>
            );
          })
        )}

        {activeTab === "recent" && (
          recents.length === 0 ? (
            <div className="col-span-4 text-center text-xs text-wa-muted py-8 select-none">No recent stickers.</div>
          ) : (
            recents.map((url, idx) => {
              const isStarred = favorites.includes(url);
              return (
                <div
                  key={idx}
                  onClick={() => handleSelectSticker(url)}
                  className="group/item relative aspect-square w-full rounded-lg hover:bg-wa-hover flex items-center justify-center p-1.5 cursor-pointer hover:scale-105 active:scale-95 transition-all"
                >
                  <img
                    src={url}
                    alt="Recent Sticker"
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                  <button
                    onClick={(e) => toggleFavorite(e, url)}
                    className="absolute top-0.5 right-0.5 p-0.5 bg-black/40 text-white rounded-full opacity-0 group-hover/item:opacity-100 transition-opacity hover:scale-110"
                  >
                    <span className="text-[9px] block leading-none">{isStarred ? "⭐" : "☆"}</span>
                  </button>
                </div>
              );
            })
          )
        )}

        {activeTab === "favorites" && (
          favorites.length === 0 ? (
            <div className="col-span-4 text-center text-xs text-wa-muted py-8 select-none">No favorite stickers.</div>
          ) : (
            favorites.map((url, idx) => (
              <div
                key={idx}
                onClick={() => handleSelectSticker(url)}
                className="group/item relative aspect-square w-full rounded-lg hover:bg-wa-hover flex items-center justify-center p-1.5 cursor-pointer hover:scale-105 active:scale-95 transition-all"
              >
                <img
                  src={url}
                  alt="Favorite Sticker"
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
                <button
                  onClick={(e) => toggleFavorite(e, url)}
                  className="absolute top-0.5 right-0.5 p-0.5 bg-black/40 text-white rounded-full opacity-0 group-hover/item:opacity-100 transition-opacity hover:scale-110"
                >
                  <span className="text-[9px] block leading-none">⭐</span>
                </button>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}

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

const checkMention = (text, selectionEnd) => {
  const textBeforeCursor = text.slice(0, selectionEnd);
  const lastAtIdx = textBeforeCursor.lastIndexOf("@");
  
  if (lastAtIdx === -1) {
    return { isMentioning: false };
  }
  
  const textAfterAt = textBeforeCursor.slice(lastAtIdx + 1);
  const charBeforeAt = lastAtIdx > 0 ? textBeforeCursor[lastAtIdx - 1] : "";
  if (charBeforeAt && charBeforeAt !== " " && charBeforeAt !== "\n") {
    return { isMentioning: false };
  }
  
  if (textAfterAt.includes("\n")) {
    return { isMentioning: false };
  }
  
  return {
    isMentioning: true,
    query: textAfterAt,
    atIndex: lastAtIdx
  };
};

export function ChatInput() {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const activeChatId = useAppSelector((state) => state.chat.activeChatId);
  const user = useAppSelector((state) => state.auth.user);
  const theme = useAppSelector((state) => state.ui.theme);
  const replyingMessage = useAppSelector((state) => state.ui.replyingMessage);
  const editingMessage = useAppSelector((state) => state.ui.editingMessage);
  const activeChat = useAppSelector((state) =>
    state.chat.chats.find((c) => c.id === activeChatId),
  );

  const [messageText, setMessageText] = useState("");
  const [showAttachments, setShowAttachments] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pickerTab, setPickerTab] = useState("emoji"); // "emoji", "gif", "sticker"
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [toastError, setToastError] = useState("");
  const [showLocationDurationModal, setShowLocationDurationModal] = useState(false);

  const [groupMembers, setGroupMembers] = useState([]);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(0);
  const [mentionIndex, setMentionIndex] = useState(-1);
  const [inputLinkPreview, setInputLinkPreview] = useState(null);
  const [dismissedUrl, setDismissedUrl] = useState("");

  useEffect(() => {
    const urlMatch = messageText.match(/(https?:\/\/[^\s\n]+|www\.[^\s\n]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,5}(?:\/[^\s\n]*)?)/i);
    const url = urlMatch ? urlMatch[0] : null;

    if (!url) {
      setInputLinkPreview(null);
      return;
    }

    if (url === dismissedUrl) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const cleanUrl = url.trim();
        const res = await fetch(`/api/link-preview?url=${encodeURIComponent(cleanUrl)}`);
        if (res.ok) {
          const data = await res.json();
          if (data && !data.error) {
            setInputLinkPreview(data);
          }
        }
      } catch (err) {
        console.warn("Failed to load input link preview:", err);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [messageText, dismissedUrl]);

  useEffect(() => {
    if (!messageText.trim()) {
      setDismissedUrl("");
      setInputLinkPreview(null);
    }
  }, [messageText]);

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const attachmentsRef = useRef(null);
  const emojiPickerRef = useRef(null);

  const {
    isRecording,
    recordingDuration,
    startVoiceRecording,
    cancelVoiceRecording,
    sendVoiceRecording,
  } = useAudioRecorder({
    t,
    onSend: (voiceFile, durationStr) => handleSendVoiceFile(voiceFile, durationStr),
    onError: (errMessage) => setToastError(errMessage),
  });

  const handleSendVoiceFile = async (voiceFile, durationStr) => {
    const tempId = "msg-temp-voice-" + Date.now();
    const timeString = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
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
        text: "🎤 " + t("chat.voice_message"),
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
        clientId: tempId,
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
        if (editingMessage) {
          dispatch(setEditingMessage(null));
          setMessageText("");
        }
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscKey);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [showAttachments, showEmojiPicker, editingMessage, dispatch]);

  const isRestoringRef = useRef(false);
  const prevChatIdRef = useRef(activeChatId);

  // Restore and Save drafts when switching activeChatId
  useEffect(() => {
    const prevChatId = prevChatIdRef.current;
    
    // Save draft for previous activeChatId if switching
    if (prevChatId && prevChatId !== activeChatId) {
      const textToSave = messageText;
      const filesToSave = selectedFiles.map(f => ({
        id: f.id,
        file: f.file,
        type: f.type,
        sizeString: f.sizeString
      }));
      const replyToToSave = replyingMessage;

      if (textToSave.trim() || filesToSave.length > 0) {
        const draftObj = {
          text: textToSave,
          replyTo: replyToToSave,
          files: filesToSave
        };
        indexedDBService.saveDraft(prevChatId, draftObj);
        dispatch(setDraft({ chatId: prevChatId, draft: draftObj }));
      } else {
        indexedDBService.removeDraft(prevChatId);
        dispatch(deleteDraft(prevChatId));
      }
    }

    prevChatIdRef.current = activeChatId;

    // Restore draft for the new activeChatId
    if (activeChatId) {
      isRestoringRef.current = true;
      const loadAndRestore = async () => {
        try {
          const d = await indexedDBService.getDraft(activeChatId);
          if (d) {
            setMessageText(d.text || "");
            if (d.replyTo) {
              dispatch(setReplyingMessage(d.replyTo));
            } else {
              dispatch(setReplyingMessage(null));
            }
            if (d.files && d.files.length > 0) {
              const restored = d.files.map(f => {
                let previewUrl = null;
                if (f.type === "image" || f.type === "video") {
                  previewUrl = URL.createObjectURL(f.file);
                }
                return {
                  id: f.id,
                  file: f.file,
                  type: f.type,
                  previewUrl,
                  sizeString: f.sizeString,
                  isUploading: false,
                };
              });
              setSelectedFiles(restored);
            } else {
              setSelectedFiles([]);
            }
          } else {
            setMessageText("");
            dispatch(setReplyingMessage(null));
            setSelectedFiles([]);
          }
        } catch (e) {
          console.warn("Failed to restore draft:", e);
        } finally {
          setTimeout(() => {
            isRestoringRef.current = false;
          }, 50);
        }
      };
      loadAndRestore();
    } else {
      setMessageText("");
      dispatch(setReplyingMessage(null));
      setSelectedFiles([]);
      isRestoringRef.current = false;
    }
  }, [activeChatId, dispatch]);

  // Debounced auto-save draft for the current activeChatId
  useEffect(() => {
    if (!activeChatId || isRestoringRef.current) return;

    const timer = setTimeout(() => {
      if (isRestoringRef.current) return;
      
      const textToSave = messageText;
      const filesToSave = selectedFiles.map(f => ({
        id: f.id,
        file: f.file,
        type: f.type,
        sizeString: f.sizeString
      }));
      const replyToToSave = replyingMessage;

      if (textToSave.trim() || filesToSave.length > 0) {
        const draftObj = {
          text: textToSave,
          replyTo: replyToToSave,
          files: filesToSave
        };
        indexedDBService.saveDraft(activeChatId, draftObj);
        dispatch(setDraft({ chatId: activeChatId, draft: draftObj }));
      } else {
        indexedDBService.removeDraft(activeChatId);
        dispatch(deleteDraft(activeChatId));
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [messageText, selectedFiles, replyingMessage, activeChatId, dispatch]);

  // Load message text when entering edit mode
  useEffect(() => {
    if (editingMessage) {
      setMessageText(editingMessage.text || "");
      setSelectedFiles([]);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [editingMessage]);

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

  // Auto-focus input when replying to a message
  useEffect(() => {
    if (replyingMessage) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [replyingMessage]);

  // Load group members for mentions suggestion list
  useEffect(() => {
    if (activeChatId && activeChat?.isGroup) {
      chatService.getGroupMembers(activeChatId)
        .then((members) => {
          setGroupMembers(members || []);
        })
        .catch((err) => {
          console.warn("Failed to load group members for mentions:", err);
        });
    } else {
      setGroupMembers([]);
    }
    setShowMentionSuggestions(false);
  }, [activeChatId, activeChat?.isGroup]);


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
        t("chat.file_too_large"),
      );
    } else if (hasInvalidExt) {
      setToastError(
        t("chat.invalid_file_format"),
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

  const handleSendSticker = async (url) => {
    if (!activeChatId || !user?.id) return;
    setShowEmojiPicker(false);

    const tempId = "msg-temp-sticker-" + Date.now();
    const timeString = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const activeReplyPayload = replyingMessage ? {
      id: replyingMessage.id,
      text: replyingMessage.text,
      senderName: replyingMessage.senderName,
      type: replyingMessage.type,
      mediaUrl: replyingMessage.mediaUrl,
    } : null;

    if (replyingMessage) {
      dispatch(setReplyingMessage(null));
    }

    const optimisticMsg = {
      id: tempId,
      text: "",
      timestamp: timeString,
      isOutgoing: true,
      status: "sent",
      type: "sticker",
      mediaUrl: url,
      senderId: user?.id,
      replyTo: activeReplyPayload,
      createdAt: new Date().toISOString(),
    };

    dispatch(addMessage({ chatId: activeChatId, message: optimisticMsg }));
    dispatch(
      updateLastMessage({
        chatId: activeChatId,
        text: "🎨 " + (t("chat.sticker") || "Sticker"),
        timestamp: timeString,
        isOutgoing: true,
        status: "sent",
      }),
    );

    try {
      const confirmedRow = await messageService.sendMessage({
        conversationId: activeChatId,
        senderId: user?.id,
        text: "",
        type: "sticker",
        mediaUrl: url,
        timestampString: timeString,
        clientId: tempId,
        replyTo: activeReplyPayload,
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
      console.error("Sticker send error:", err);
      dispatch(
        updateMessageStatus({
          chatId: activeChatId,
          messageId: tempId,
          status: "failed",
        }),
      );
    }
  };

  const handleSendGif = async (url) => {
    if (!activeChatId || !user?.id) return;
    setShowEmojiPicker(false);

    const tempId = "msg-temp-gif-" + Date.now();
    const timeString = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const activeReplyPayload = replyingMessage ? {
      id: replyingMessage.id,
      text: replyingMessage.text,
      senderName: replyingMessage.senderName,
      type: replyingMessage.type,
      mediaUrl: replyingMessage.mediaUrl,
    } : null;

    if (replyingMessage) {
      dispatch(setReplyingMessage(null));
    }

    const optimisticMsg = {
      id: tempId,
      text: "",
      timestamp: timeString,
      isOutgoing: true,
      status: "sent",
      type: "gif",
      mediaUrl: url,
      senderId: user?.id,
      replyTo: activeReplyPayload,
      createdAt: new Date().toISOString(),
    };

    dispatch(addMessage({ chatId: activeChatId, message: optimisticMsg }));
    dispatch(
      updateLastMessage({
        chatId: activeChatId,
        text: "🎬 " + (t("chat.gif") || "GIF"),
        timestamp: timeString,
        isOutgoing: true,
        status: "sent",
      }),
    );

    try {
      const confirmedRow = await messageService.sendMessage({
        conversationId: activeChatId,
        senderId: user?.id,
        text: "",
        type: "gif",
        mediaUrl: url,
        timestampString: timeString,
        clientId: tempId,
        replyTo: activeReplyPayload,
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
      console.error("GIF send error:", err);
      dispatch(
        updateMessageStatus({
          chatId: activeChatId,
          messageId: tempId,
          status: "failed",
        }),
      );
    }
  };

  const handleSendSubmit = async () => {
    const textToSend = messageText.trim();
    const filesToSend = [...selectedFiles];

    if (!textToSend && filesToSend.length === 0) return;
    if (!activeChatId || !user?.id) return;

    if (editingMessage) {
      if (!textToSend) return;
      
      const currentEditing = editingMessage;
      setMessageText("");
      dispatch(setEditingMessage(null));
      
      try {
        const updatedMsg = await messageService.editMessage(currentEditing.id, textToSend, user.id);
        if (updatedMsg) {
          dispatch(
            updateMessage({
              chatId: activeChatId,
              message: updatedMsg,
            })
          );
        }
      } catch (err) {
        console.error("Failed to edit message:", err);
        setToastError(err.message || t("chat.edit_failed") || "Failed to edit message.");
      }
      return;
    }

    const timeString = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    setMessageText("");
    setInputLinkPreview(null);
    setDismissedUrl("");
    setSelectedFiles([]);
    setShowAttachments(false);
    setShowEmojiPicker(false);
    
    // Clear draft immediately upon sending
    indexedDBService.removeDraft(activeChatId);
    dispatch(deleteDraft(activeChatId));
    realtimeService.broadcastTypingEvent(
      activeChatId,
      user.id,
      false,
      user.name,
    );

    // Capture reply message payload and clear state instantly
    const activeReplyPayload = replyingMessage ? {
      id: replyingMessage.id,
      text: replyingMessage.text,
      senderName: replyingMessage.senderName,
      type: replyingMessage.type,
      mediaUrl: replyingMessage.mediaUrl,
    } : null;

    if (replyingMessage) {
      dispatch(setReplyingMessage(null));
    }

    for (const fileObj of filesToSend) {
      const tempId =
        "msg-temp-file-" +
        Date.now() +
        "-" +
        Math.random().toString(36).substring(2, 6);

      let finalFile = fileObj.file;
      let finalSizeString = fileObj.sizeString;
      let finalPreviewUrl = fileObj.previewUrl;

      if (fileObj.type === "image") {
        try {
          const { compressImage } = await import("../../utils/mediaCompressor");
          const compressed = await compressImage(fileObj.file);
          if (compressed !== fileObj.file) {
            finalFile = compressed;
            const kb = compressed.size / 1024;
            finalSizeString = kb > 1024 
              ? `${(kb / 1024).toFixed(1)} MB` 
              : `${Math.round(kb)} KB`;
            
            // Clean up original preview and generate a compressed preview
            if (fileObj.previewUrl && fileObj.previewUrl.startsWith("blob:")) {
              try {
                URL.revokeObjectURL(fileObj.previewUrl);
              } catch (e) {}
            }
            finalPreviewUrl = URL.createObjectURL(compressed);
          }
        } catch (compressErr) {
          console.warn("Failed to compress image:", compressErr);
        }
      }

      const optimisticMsg = {
        id: tempId,
        text: fileObj.type === "file" ? finalFile.name : "",
        timestamp: timeString,
        isOutgoing: true,
        status: "pending",
        type: fileObj.type,
        mediaUrl: finalPreviewUrl || null,
        fileName: finalFile.name,
        fileSize: finalSizeString,
        senderId: user.id,
        createdAt: new Date().toISOString(),
        replyTo: activeReplyPayload,
      };

      dispatch(addMessage({ chatId: activeChatId, message: optimisticMsg }));
      dispatch(
        updateLastMessage({
          chatId: activeChatId,
          text:
            fileObj.type === "image"
              ? "📷 " + t("chat.photo")
              : fileObj.type === "video"
                ? "🎥 " + t("chat.video")
                : "📎 " + t("chat.document"),
          timestamp: timeString,
          isOutgoing: true,
          status: "pending",
        }),
      );

      // Save to IndexedDB queue first so we have the file blob for any retries
      const offlinePayload = {
        ...optimisticMsg,
        conversation_id: activeChatId,
        sender_id: user.id,
        timestamp_string: timeString,
        file_name: finalFile.name,
        file_size: finalSizeString,
        uiId: tempId
      };
      
      try {
        await indexedDBService.savePendingMessage(offlinePayload, finalFile);

        const uploadedAbsoluteUrl = await storageService.uploadFile(
          finalFile,
          fileObj.type + "s",
        );

        const confirmedRow = await messageService.sendMessage({
          conversationId: activeChatId,
          senderId: user.id,
          text: fileObj.type === "file" ? finalFile.name : "",
          type: fileObj.type,
          mediaUrl: uploadedAbsoluteUrl,
          fileName: finalFile.name,
          fileSize: finalSizeString,
          timestampString: timeString,
          replyTo: activeReplyPayload,
          clientId: tempId,
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
        
        // Remove from pending store on success
        await indexedDBService.removePendingMessage(tempId);
      } catch (err) {
        if (err.message === "OFFLINE_PENDING") {
          // Already saved to IndexedDB, leave it as pending
          console.log("Device is offline, message stored in pending queue.");
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
      const urlMatch = textToSend.match(/(https?:\/\/[^\s\n]+|www\.[^\s\n]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,5}(?:\/[^\s\n]*)?)/i);
      const hasUrl = !!urlMatch;
      const noPreview = hasUrl && !inputLinkPreview;

      const tempId = "msg-temp-text-" + Date.now();
      const optimisticMsg = {
        id: tempId,
        text: textToSend,
        timestamp: timeString,
        isOutgoing: true,
        status: "pending",
        type: "text",
        senderId: user.id,
        createdAt: new Date().toISOString(),
        replyTo: activeReplyPayload,
        noPreview: noPreview,
      };

      dispatch(addMessage({ chatId: activeChatId, message: optimisticMsg }));
      dispatch(
        updateLastMessage({
          chatId: activeChatId,
          text: textToSend,
          timestamp: timeString,
          isOutgoing: true,
          status: "pending",
        }),
      );

      const offlinePayload = {
        ...optimisticMsg,
        conversation_id: activeChatId,
        sender_id: user.id,
        timestamp_string: timeString,
        uiId: tempId
      };

      try {
        await indexedDBService.savePendingMessage(offlinePayload);

        const confirmedRow = await messageService.sendMessage({
          conversationId: activeChatId,
          senderId: user.id,
          text: textToSend,
          type: "text",
          timestampString: timeString,
          replyTo: activeReplyPayload,
          noPreview: noPreview,
          clientId: tempId,
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

        // Remove from pending store on success
        await indexedDBService.removePendingMessage(tempId);
      } catch (err) {
        if (err.message === "OFFLINE_PENDING") {
          // Already saved to IndexedDB, leave it as pending
          console.log("Device is offline, text message stored in pending queue.");
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

  const insertMention = (member) => {
    if (!textareaRef.current) return;
    
    const text = messageText;
    const cursorPosition = textareaRef.current.selectionEnd || 0;
    
    const textBefore = text.slice(0, mentionIndex);
    const textAfter = text.slice(cursorPosition);
    
    const mentionText = `@${member.name} `;
    const newText = textBefore + mentionText + textAfter;
    
    setMessageText(newText);
    setShowMentionSuggestions(false);
    
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPos = mentionIndex + mentionText.length;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 50);
  };

  const handleKeyDown = (e) => {
    if (showMentionSuggestions && mentionSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveSuggestionIdx((prev) => (prev + 1) % mentionSuggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveSuggestionIdx((prev) => (prev - 1 + mentionSuggestions.length) % mentionSuggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(mentionSuggestions[activeSuggestionIdx]);
        return;
      }
    }

    if (e.key === "Escape") {
      let handled = false;
      if (showMentionSuggestions) {
        setShowMentionSuggestions(false);
        handled = true;
      }
      if (showEmojiPicker) {
        setShowEmojiPicker(false);
        handled = true;
      }
      if (showAttachments) {
        setShowAttachments(false);
        handled = true;
      }
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendSubmit();
    }
  };

  const handleShareLocation = async (durationMs) => {
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
      });
      const { latitude, longitude } = position.coords;
      const expiresAt = new Date(Date.now() + durationMs).toISOString();

      const tempId = "msg-temp-loc-" + Date.now();
      const timeString = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
      const optimisticMsg = {
        id: tempId,
        text: "📍 " + t("chat.shared_live_location"),
        timestamp: timeString,
        isOutgoing: true,
        status: "sent",
        type: "live_location",
        senderId: user.id,
        createdAt: new Date().toISOString(),
        mediaUrl: `${latitude},${longitude}`,
        fileName: expiresAt,
        duration: Math.round(durationMs / 1000),
      };

      dispatch(addMessage({ chatId: activeChatId, message: optimisticMsg }));
      dispatch(
        updateLastMessage({
          chatId: activeChatId,
          text: "📍 " + t("chat.shared_live_location"),
          timestamp: timeString,
          isOutgoing: true,
          status: "sent",
        }),
      );

      const confirmedRow = await locationService.startSharing(activeChatId, user?.id, durationMs, position.coords);

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
      console.error("Location share error:", err);
      setToastError(err.message || t("chat.location_permission_denied"));
    }
  };

  const handleSendStaticLocation = async () => {
    setShowAttachments(false);
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
      });
      const { latitude, longitude } = position.coords;

      const tempId = "msg-temp-loc-static-" + Date.now();
      const timeString = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
      const optimisticMsg = {
        id: tempId,
        text: "📍 " + t("chat.current_location"),
        timestamp: timeString,
        isOutgoing: true,
        status: "sent",
        type: "location",
        senderId: user.id,
        createdAt: new Date().toISOString(),
        mediaUrl: `${latitude},${longitude}`,
      };

      dispatch(addMessage({ chatId: activeChatId, message: optimisticMsg }));
      dispatch(
        updateLastMessage({
          chatId: activeChatId,
          text: "📍 " + t("chat.current_location"),
          timestamp: timeString,
          isOutgoing: true,
          status: "sent",
        }),
      );

      const confirmedRow = await locationService.sendStaticCurrentLocation(activeChatId, user?.id, position.coords);

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
      console.error("Location snapshot error:", err);
      setToastError(err.message || t("chat.location_permission_denied"));
    }
  };

  const triggerFileInput = (acceptFilter) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = acceptFilter;
      fileInputRef.current.click();
    }
  };

  const isLeft = activeChat?.isLeft;

  if (isLeft) {
    return (
      <footer className="relative flex items-center justify-center px-4 py-6 bg-wa-header border-t border-wa-border select-none z-20 w-full shrink-0">
        {/* <div className="bg-wa-active/50 px-4 py-2 rounded-lg border border-wa-border"> */}
        <p className="text-sm text-wa-muted font-medium italic">
          {t("chat.not_participant")}
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
            {t("chat.drop_files")}
          </span>
          <span className="text-xs text-wa-muted mt-1">
            {t("chat.max_file_size")}
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
                title={t("chat.remove_file")}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {inputLinkPreview && (
        <div className="flex items-center justify-between bg-black/5 dark:bg-white/5 border-l-4 border-wa-primary p-2 mb-2 rounded text-xs select-none animate-fade-in relative gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {inputLinkPreview.image && (
              <img
                src={inputLinkPreview.image}
                alt="Preview"
                className="h-10 w-10 object-cover rounded shrink-0 bg-black/10"
              />
            )}
            <div className="flex-1 min-w-0">
              <span className="text-[10px] text-wa-muted font-sans font-medium uppercase tracking-wider block truncate">
                {inputLinkPreview.siteName || inputLinkPreview.domain || t("chat.link_preview")}
              </span>
              <p className="font-semibold text-wa-primary truncate">
                {inputLinkPreview.title}
              </p>
              {inputLinkPreview.description && (
                <p className="text-wa-muted truncate text-[11px]">
                  {inputLinkPreview.description}
                </p>
              )}
            </div>
          </div>
          <button 
            onClick={() => {
              setDismissedUrl(inputLinkPreview.url);
              setInputLinkPreview(null);
            }}
            className="p-1 text-wa-muted hover:text-wa-text rounded-full hover:bg-wa-hover transition-colors shrink-0"
            title={t("chat.remove_link_preview")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {editingMessage && (
        <div className="flex items-center justify-between bg-wa-sidebar/80 dark:bg-wa-sidebar/95 backdrop-blur-md border-l-[4px] border-wa-primary px-3 sm:px-4 py-2 sm:py-2.5 mb-2.5 rounded-lg text-xs select-none animate-scale-up relative gap-3 shadow-sm border border-wa-border/30">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="flex items-center justify-center h-8 w-8 rounded bg-wa-primary/10 text-wa-primary shrink-0">
              <svg viewBox="0 0 24 24" width="15" height="15" className="fill-none stroke-current stroke-2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z" />
              </svg>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-wa-primary truncate text-[11px] sm:text-xs">
                {t("chat.edit_message")}
              </span>
              <span className="text-wa-muted truncate text-[11px] sm:text-xs leading-normal">
                {editingMessage.text}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button 
              onClick={() => {
                dispatch(setEditingMessage(null));
                setMessageText("");
              }}
              className="h-6 w-6 rounded-full text-wa-muted hover:text-wa-text hover:bg-wa-hover transition-colors flex items-center justify-center cursor-pointer"
              title={t("chat.cancel_edit")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {replyingMessage && (
        <div className="flex items-center justify-between bg-wa-sidebar/80 dark:bg-wa-sidebar/95 backdrop-blur-md border-l-[4px] border-wa-primary px-3 sm:px-4 py-2 sm:py-2.5 mb-2.5 rounded-lg text-xs select-none animate-scale-up relative gap-3 shadow-sm border border-wa-border/30">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="flex items-center justify-center h-8 w-8 rounded bg-wa-primary/10 text-wa-primary shrink-0">
              {replyingMessage.type === "image" ? (
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5.04-6.71l-2.75 3.54-1.96-2.36L6.5 17h11l-3.54-4.71z"/>
                </svg>
              ) : replyingMessage.type === "video" ? (
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                </svg>
              ) : replyingMessage.type === "sticker" ? (
                <span className="text-sm">🎨</span>
              ) : replyingMessage.type === "gif" ? (
                <span className="text-sm">🎬</span>
              ) : replyingMessage.type === "voice" ? (
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                </svg>
              ) : replyingMessage.type === "file" ? (
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                </svg>
              ) : (
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/>
                </svg>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-wa-primary truncate text-[11px] sm:text-xs">
                {t("chat.replying_to", { name: replyingMessage.senderName })}
              </span>
              <span className="text-wa-muted truncate text-[11px] sm:text-xs leading-normal">
                {replyingMessage.text || (
                  replyingMessage.type === "image" ? t("chat.photo") :
                  replyingMessage.type === "video" ? t("chat.video") :
                  replyingMessage.type === "voice" ? t("chat.voice_message") :
                  replyingMessage.type === "file" ? t("chat.document") :
                  replyingMessage.type === "sticker" ? t("chat.sticker") :
                  replyingMessage.type === "gif" ? t("chat.gif") :
                  replyingMessage.type === "live_location" ? t("chat.live_location") :
                  replyingMessage.type === "location" ? t("chat.location") : t("chat.attachment")
                )}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2.5 shrink-0">
            {replyingMessage.mediaUrl && (replyingMessage.type === "image" || replyingMessage.type === "video" || replyingMessage.type === "sticker" || replyingMessage.type === "gif") && (
              <img 
                src={replyingMessage.mediaUrl} 
                alt="thumbnail" 
                className="h-8 w-8 object-cover rounded bg-black/10 select-none border border-wa-border/30 shrink-0"
              />
            )}
            <button 
              onClick={() => dispatch(setReplyingMessage(null))}
              className="h-6 w-6 rounded-full text-wa-muted hover:text-wa-text hover:bg-wa-hover transition-colors flex items-center justify-center cursor-pointer"
              title={t("chat.cancel_reply")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="flex items-end gap-1 sm:gap-2 w-full">
        {isRecording ? (
          <div className="flex items-center justify-between w-full px-2 py-1 select-none animate-fade-in gap-3">
            <div className="flex items-center gap-2.5">
              <span className="h-3 w-3 rounded-full bg-red-500 animate-pulse shrink-0" />
              <span className="text-xs sm:text-sm font-medium text-red-500 font-mono tracking-wider">
                {t("chat.recording")}: {Math.floor(recordingDuration / 60)}:
                {recordingDuration % 60 < 10 ? "0" : ""}
                {recordingDuration % 60}
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <button
                onClick={cancelVoiceRecording}
                className="p-2 rounded-full text-wa-muted hover:bg-wa-hover hover:text-red-500 transition-colors flex items-center justify-center cursor-pointer"
                title={t("chat.discard_recording")}
              >
                <Trash2 className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
              </button>
              <button
                onClick={sendVoiceRecording}
                className="p-2 sm:p-2.5 rounded-full bg-wa-primary text-white hover:bg-wa-primary-hover transition-colors shadow-sm flex items-center justify-center cursor-pointer animate-scale-up"
                title={t("chat.send_voice_message")}
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
                  title={t("chat.emojis")}
                >
                  <Smile className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>

                {showEmojiPicker && (
                  <div className="absolute bottom-12 left-0 z-50 shadow-2xl rounded-2xl border border-wa-border bg-wa-modal overflow-hidden animate-fade-in select-none w-[320px] h-[430px] flex flex-col">
                    {/* Picker Tabs */}
                    <div className="flex bg-wa-header border-b border-wa-border shrink-0 select-none text-xs font-semibold">
                      <button
                        onClick={() => setPickerTab("emoji")}
                        className={cn(
                          "flex-1 py-2.5 text-center border-b-2 transition-all cursor-pointer",
                          pickerTab === "emoji" ? "border-wa-primary text-wa-primary bg-wa-sidebar/50" : "border-transparent text-wa-muted hover:text-wa-text"
                        )}
                      >
                        😊 {t("chat.emojis") || "Emojis"}
                      </button>
                      <button
                        onClick={() => setPickerTab("gif")}
                        className={cn(
                          "flex-1 py-2.5 text-center border-b-2 transition-all cursor-pointer",
                          pickerTab === "gif" ? "border-wa-primary text-wa-primary bg-wa-sidebar/50" : "border-transparent text-wa-muted hover:text-wa-text"
                        )}
                      >
                        🎬 {t("chat.gifs") || "GIFs"}
                      </button>
                      <button
                        onClick={() => setPickerTab("sticker")}
                        className={cn(
                          "flex-1 py-2.5 text-center border-b-2 transition-all cursor-pointer",
                          pickerTab === "sticker" ? "border-wa-primary text-wa-primary bg-wa-sidebar/50" : "border-transparent text-wa-muted hover:text-wa-text"
                        )}
                      >
                        🎨 {t("chat.stickers") || "Stickers"}
                      </button>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 min-h-0 bg-wa-modal">
                      {pickerTab === "emoji" && (
                        <EmojiPicker
                          theme={theme === "dark" ? "dark" : "light"}
                          onEmojiClick={(emojiData) => {
                            setMessageText((prev) => prev + emojiData.emoji);
                            setTimeout(() => textareaRef.current?.focus(), 0);
                          }}
                          width="100%"
                          height="100%"
                          skinTonesDisabled
                          previewConfig={{ showPreview: false }}
                        />
                      )}
                      {pickerTab === "gif" && (
                        <GifPickerPanel onSelect={handleSendGif} />
                      )}
                      {pickerTab === "sticker" && (
                        <StickerPickerPanel onSelect={handleSendSticker} />
                      )}
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
                  title={t("chat.attach_files")}
                >
                  <Paperclip className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>

                {showAttachments && (
                  <div className="absolute bottom-12 left-0 grid grid-cols-2 gap-x-2.5 gap-y-1.5 p-2.5 bg-wa-modal rounded-2xl shadow-xl border border-wa-border animate-fade-in w-72 sm:w-80 md:w-96 z-50 transition-colors">
                    <button
                      onClick={() => triggerFileInput("image/*,video/mp4")}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-wa-hover transition-colors text-xs sm:text-sm text-wa-text w-full text-left"
                    >
                      <span className="w-7.5 h-7.5 bg-[#bf59cf] rounded-full text-white flex items-center justify-center shrink-0">
                        <ImageIcon className="h-3.5 w-3.5" />
                      </span>
                      <span className="truncate font-medium text-wa-text">{t("chat.photos_and_videos")}</span>
                    </button>
 
                    <button
                      onClick={() =>
                        triggerFileInput(".pdf,.doc,.docx,.zip,.txt")
                      }
                      className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-wa-hover transition-colors text-xs sm:text-sm text-wa-text w-full text-left"
                    >
                      <span className="w-7.5 h-7.5 bg-[#53bdeb] rounded-full text-white flex items-center justify-center shrink-0">
                        <FileText className="h-3.5 w-3.5" />
                      </span>
                      <span className="truncate font-medium text-wa-text">{t("chat.document")}</span>
                    </button>
 
                    <button
                      onClick={() => {
                        setShowLocationDurationModal(true);
                        setShowAttachments(false);
                      }}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-wa-hover transition-colors text-xs sm:text-sm text-wa-text w-full text-left"
                    >
                      <span className="w-7.5 h-7.5 bg-[#00a884] rounded-full text-white flex items-center justify-center shrink-0">
                        <MapPin className="h-3.5 w-3.5" />
                      </span>
                      <span className="truncate font-medium text-wa-text">{t("chat.live_location")}</span>
                    </button>
 
                    <button
                      onClick={handleSendStaticLocation}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-wa-hover transition-colors text-xs sm:text-sm text-wa-text w-full text-left"
                    >
                      <span className="w-7.5 h-7.5 bg-[#25d366] rounded-full text-white flex items-center justify-center shrink-0">
                        <MapPin className="h-3.5 w-3.5" />
                      </span>
                      <span className="truncate font-medium text-wa-text">{t("chat.current_location")}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0 relative">
              {showMentionSuggestions && mentionSuggestions.length > 0 && (
                <div className="absolute bottom-full left-0 w-full bg-wa-modal border border-wa-border rounded-xl shadow-2xl overflow-hidden z-50 mb-2.5 animate-scale-up max-h-48 overflow-y-auto">
                  {mentionSuggestions.map((member, idx) => (
                    <button
                      key={member.id}
                      onClick={() => insertMention(member)}
                      onMouseEnter={() => setActiveSuggestionIdx(idx)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 text-left cursor-pointer transition-colors border-none outline-none",
                        idx === activeSuggestionIdx ? "bg-wa-active" : "hover:bg-wa-hover"
                      )}
                    >
                      <Avatar src={member.avatar} fallback={member.name[0]} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-wa-text truncate">
                          {member.name}
                        </p>
                        <p className="text-[10px] text-wa-muted truncate">
                          {member.email || t("chat.group_participant")}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <textarea
                ref={textareaRef}
                rows={1}
                value={messageText}
                onChange={(e) => {
                  setMessageText(e.target.value);
                  const { isMentioning, query, atIndex } = checkMention(e.target.value, e.target.selectionEnd || 0);
                  if (isMentioning && activeChat?.isGroup) {
                    const filtered = groupMembers.filter(member => 
                      member.name.toLowerCase().includes(query.toLowerCase()) ||
                      (member.email && member.email.toLowerCase().includes(query.toLowerCase()))
                    );
                    setMentionSuggestions(filtered);
                    setMentionIndex(atIndex);
                    setShowMentionSuggestions(filtered.length > 0);
                    setActiveSuggestionIdx(0);
                  } else {
                    setShowMentionSuggestions(false);
                  }
                }}
                onSelect={(e) => {
                  const { isMentioning, query, atIndex } = checkMention(e.target.value, e.target.selectionEnd || 0);
                  if (isMentioning && activeChat?.isGroup) {
                    const filtered = groupMembers.filter(member => 
                      member.name.toLowerCase().includes(query.toLowerCase()) ||
                      (member.email && member.email.toLowerCase().includes(query.toLowerCase()))
                    );
                    setMentionSuggestions(filtered);
                    setMentionIndex(atIndex);
                    setShowMentionSuggestions(filtered.length > 0);
                  } else {
                    setShowMentionSuggestions(false);
                  }
                }}
                onKeyDown={handleKeyDown}
                placeholder={
                  selectedFiles.length > 0 ? t("chat.add_caption") : t("chat.message_placeholder")
                }
                className="w-full resize-none rounded-lg bg-wa-input px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-wa-text placeholder:text-wa-muted focus:outline-none max-h-24 block leading-normal transition-colors"
              />
            </div>

            <div className="pb-0.5 sm:pb-1 shrink-0">
              {messageText.trim() || selectedFiles.length > 0 ? (
                <button
                  onClick={handleSendSubmit}
                  className="p-2 sm:p-2.5 rounded-full bg-wa-primary text-white hover:bg-wa-primary-hover transition-colors shadow-sm flex items-center justify-center cursor-pointer"
                  title={t("chat.send_message")}
                >
                  <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-white" />
                </button>
              ) : (
                <button
                  onClick={startVoiceRecording}
                  className="p-1.5 sm:p-2 rounded-full text-wa-muted hover:bg-wa-active transition-colors flex items-center justify-center cursor-pointer"
                  title={t("chat.voice_message")}
                >
                  <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              )}
            </div>
          </>
        )}
      </div>
      {showLocationDurationModal && (
        <LocationDurationModal
          onClose={() => setShowLocationDurationModal(false)}
          onShare={handleShareLocation}
        />
      )}
    </footer>
  );
}
