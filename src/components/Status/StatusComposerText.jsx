"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Send, Palette, Smile, HelpCircle, Calendar, MapPin, Music, BarChart2, Plus, Type } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { useTranslation } from "../../hooks/useTranslation";
import { useAppSelector } from "../../hooks/useRedux";
import { MentionSuggestions } from "./MentionSuggestions";
import { Loader } from "../ui/Loader";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
  loading: () => (
    <div className="h-[350px] w-full flex items-center justify-center bg-[#233138] rounded-lg">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-wa-primary"></div>
    </div>
  ),
});

const TEXT_BG_COLORS = [
  "#005c4b", // WhatsApp Green
  "#7f66ff", // Purple
  "#f35369", // Coral/Red
  "#128c7e", // Teal
  "#34b7f1", // Blue
  "linear-gradient(135deg, #12c2e9, #c471ed, #f64f59)", // Vibrant Gradient
  "linear-gradient(135deg, #ff7e5f, #feb47b)", // Sunset Gradient
  "linear-gradient(135deg, #0f2027, #203a43, #2c5364)", // Dark Slate Gradient
  "linear-gradient(135deg, #11998e, #38ef7d)", // Mint Gradient
  "linear-gradient(135deg, #3f2b96, #a8c0ff)", // Indigo Blue
];

const FONT_STYLES = [
  { name: "sans", family: "system-ui, -apple-system, sans-serif" },
  { name: "serif", family: "Georgia, Cambria, serif" },
  { name: "mono", family: "Courier New, Courier, monospace" },
  { name: "handwriting", family: "'Caveat', cursive, sans-serif" },
];

export function StatusComposerText({ onCancel, onSubmit, uploading, uploadProgress }) {
  const { t } = useTranslation();
  const chats = useAppSelector((state) => state.chat.chats);

  // Core Status Editing States
  const [textContent, setTextContent] = useState("");
  const [textBgColor, setTextBgColor] = useState(TEXT_BG_COLORS[0]);
  const [textStyleIndex, setTextStyleIndex] = useState(0);

  // Feature Toggles & States
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showStickerMenu, setShowStickerMenu] = useState(false);

  // Mentions State
  const [mentionQuery, setMentionQuery] = useState(null); // String search or null
  const [mentions, setMentions] = useState([]); // List of { id, name }

  // Link Preview States
  const [detectedUrl, setDetectedUrl] = useState("");
  const [linkPreview, setLinkPreview] = useState(null);
  const [fetchingLink, setFetchingLink] = useState(false);

  // Active Sticker State
  const [activeSticker, setActiveSticker] = useState(null); // 'music' | 'poll' | 'question' | 'countdown' | 'location'
  const [stickerData, setStickerData] = useState({});

  // Elements Refs
  const textareaRef = useRef(null);
  const emojiContainerRef = useRef(null);
  const stickerMenuRef = useRef(null);
  const colorPickerRef = useRef(null);

  // Derive unique contacts for @mentions from chats
  const contacts = Array.from(
    new Map(
      chats
        .filter((c) => !c.isGroup && c.peerId)
        .map((c) => [c.peerId, { id: c.peerId, name: c.name, avatar: c.avatar }])
    ).values()
  );

  // Handle @mentions search triggers as text changes
  const handleTextChange = (e) => {
    const val = e.target.value;
    setTextContent(val);

    // Auto-resize text area height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }

    // Detect if cursor is after '@'
    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.substring(0, cursor);
    const match = textBeforeCursor.match(/@(\w*)$/);
    if (match) {
      setMentionQuery(match[1]);
    } else {
      setMentionQuery(null);
    }

    // Detect URLs for link previews
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const matches = val.match(urlRegex);
    if (matches && matches[0]) {
      const foundUrl = matches[0];
      if (foundUrl !== detectedUrl) {
        setDetectedUrl(foundUrl);
        fetchLinkMetadata(foundUrl);
      }
    } else {
      setDetectedUrl("");
      setLinkPreview(null);
    }
  };

  const fetchLinkMetadata = async (url) => {
    setFetchingLink(true);
    try {
      const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const data = await res.json();
        if (!data.error) {
          setLinkPreview(data);
        }
      }
    } catch (e) {
      console.warn("Failed fetching link metadata preview:", e);
    } finally {
      setFetchingLink(false);
    }
  };

  // Close popup menus on outside clicks
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (showEmojiPicker && emojiContainerRef.current && !emojiContainerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
      if (showStickerMenu && stickerMenuRef.current && !stickerMenuRef.current.contains(e.target)) {
        setShowStickerMenu(false);
      }
      if (showColorPicker && colorPickerRef.current && !colorPickerRef.current.contains(e.target)) {
        setShowColorPicker(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showEmojiPicker, showStickerMenu, showColorPicker]);

  const handleSelectMention = (contact) => {
    if (!textareaRef.current) return;
    const cursor = textareaRef.current.selectionStart;
    const val = textContent;
    const textBeforeCursor = val.substring(0, cursor);
    const textAfterCursor = val.substring(cursor);

    const match = textBeforeCursor.match(/@(\w*)$/);
    if (match) {
      const startIndex = match.index;
      const newTextBefore = val.substring(0, startIndex) + `@${contact.name} `;
      setTextContent(newTextBefore + textAfterCursor);
      setMentions((prev) => [...prev, { id: contact.id, name: contact.name }]);
      setMentionQuery(null);
      
      // Reset focus & cursor
      setTimeout(() => {
        textareaRef.current.focus();
        const newCursorPos = newTextBefore.length;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }, 50);
    }
  };

  const handleEmojiClick = (emojiObj) => {
    setTextContent((prev) => prev + emojiObj.emoji);
  };

  const handleSend = () => {
    if (!textContent.trim() && !activeSticker) return;

    // Assemble metadata payload containing links, active stickers, and @mentions
    const metadata = {
      mentions: mentions.filter((m) => textContent.includes(`@${m.name}`)),
    };

    if (linkPreview) {
      metadata.linkPreview = linkPreview;
    }

    if (activeSticker) {
      metadata[activeSticker] = stickerData;
    }

    onSubmit({
      textContent: textContent.trim(),
      bgColor: textBgColor,
      textStyle: FONT_STYLES[textStyleIndex].name,
      metadata,
    });
  };

  // Sticker creation configurations
  const initSticker = (type) => {
    setActiveSticker(type);
    setShowStickerMenu(false);
    if (type === "music") {
      setStickerData({
        title: "Shape of You",
        artist: "Ed Sheeran",
        coverUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=150&auto=format&fit=crop&q=80",
        audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", // Free demo audio link
      });
    } else if (type === "poll") {
      setStickerData({
        question: "What's the best framework?",
        options: [
          { id: 1, text: "React" },
          { id: 2, text: "Vue" },
        ],
        votes: {},
      });
    } else if (type === "question") {
      setStickerData({
        prompt: "Ask me a question!",
      });
    } else if (type === "countdown") {
      const targetDate = new Date();
      targetDate.setHours(targetDate.getHours() + 24);
      setStickerData({
        title: "Countdown to event!",
        targetDate: targetDate.toISOString(),
      });
    } else if (type === "location") {
      // Prompt GPS
      setStickerData({ name: "Surat, Gujarat, India", lat: 21.1702, lng: 72.8311 });
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const { latitude, longitude } = pos.coords;
            try {
              const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
              if (res.ok) {
                const data = await res.json();
                const placeName = data.address.city || data.address.town || data.address.village || data.address.suburb || "Current Location";
                setStickerData({
                  name: `${placeName}, ${data.address.state || ""}`,
                  lat: latitude,
                  lng: longitude,
                });
              }
            } catch (err) {
              setStickerData({ name: "Current GPS Location", lat: latitude, lng: longitude });
            }
          },
          () => {}
        );
      }
    }
  };

  const handleRemoveSticker = () => {
    setActiveSticker(null);
    setStickerData({});
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="absolute inset-0 z-20 flex flex-col overflow-hidden"
      style={{ background: textBgColor }}
    >
      {/* Header controls */}
      <div className="flex items-center justify-between p-4 bg-black/10 shrink-0 text-white z-20">
        <button
          onClick={onCancel}
          className="p-2 rounded-full hover:bg-black/10 cursor-pointer"
          title={t("common.cancel") || "Cancel"}
        >
          <X className="h-6 w-6" />
        </button>

        <div className="flex items-center gap-3 relative">
          {/* Sticker Add Menu */}
          <div ref={stickerMenuRef}>
            <button
              onClick={() => setShowStickerMenu(!showStickerMenu)}
              className={`p-2.5 rounded-full border border-white/20 transition-all ${
                activeSticker ? "bg-[#00a884] border-transparent" : "hover:bg-black/10"
              }`}
              title="Add Sticker"
            >
              <HelpCircle className="h-5 w-5" />
            </button>

            {showStickerMenu && (
              <div className="absolute right-0 top-12 bg-[#233138] border border-white/10 rounded-lg shadow-xl w-48 py-1 z-30 text-white flex flex-col text-sm">
                <button onClick={() => initSticker("poll")} className="px-4 py-2 hover:bg-white/5 text-left flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-[#00a884]" /> {t("status.poll_widget") || "Poll Widget"}
                </button>
                <button onClick={() => initSticker("question")} className="px-4 py-2 hover:bg-white/5 text-left flex items-center gap-2">
                  <Smile className="h-4 w-4 text-[#7f66ff]" /> {t("status.question_card") || "Question Card"}
                </button>
                <button onClick={() => initSticker("music")} className="px-4 py-2 hover:bg-white/5 text-left flex items-center gap-2">
                  <Music className="h-4 w-4 text-[#f35369]" /> {t("status.background_music") || "Background Music"}
                </button>
                <button onClick={() => initSticker("countdown")} className="px-4 py-2 hover:bg-white/5 text-left flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#34b7f1]" /> {t("status.countdown_timer") || "Countdown Timer"}
                </button>
                <button onClick={() => initSticker("location")} className="px-4 py-2 hover:bg-white/5 text-left flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#4f772d]" /> {t("status.location_tag") || "Location Tag"}
                </button>
              </div>
            )}
          </div>

          {/* Font style cycle */}
          <button
            onClick={() => setTextStyleIndex((prev) => (prev + 1) % FONT_STYLES.length)}
            className="p-2.5 rounded-full hover:bg-black/10 cursor-pointer flex items-center justify-center font-bold text-sm h-10 w-10 border border-white/20"
            title={t("status.font_style") || "Font style"}
            style={{ fontFamily: FONT_STYLES[textStyleIndex].family }}
          >
            T
          </button>

          {/* Color Palette dropdown */}
          <div ref={colorPickerRef}>
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="p-2.5 rounded-full hover:bg-black/10 cursor-pointer flex items-center justify-center h-10 w-10 border border-white/20"
              title={t("status.bg_color") || "Background color"}
            >
              <Palette className="h-5 w-5" />
            </button>

            {showColorPicker && (
              <div className="absolute right-0 top-12 bg-[#233138] border border-white/10 rounded-lg shadow-xl p-3 z-30 grid grid-cols-5 gap-2 w-48">
                {TEXT_BG_COLORS.map((bg, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setTextBgColor(bg);
                      setShowColorPicker(false);
                    }}
                    className="h-6 w-6 rounded-full border border-white/20"
                    style={{ background: bg }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Editor Main composition canvas */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-12 py-4 relative overflow-y-auto">
        <textarea
          ref={textareaRef}
          className="w-full max-w-2xl bg-transparent border-none text-white text-center font-medium focus:ring-0 focus:outline-none resize-none overflow-hidden placeholder-white/30"
          placeholder={t("status.type_status_update") || "Type a status update..."}
          value={textContent}
          onChange={handleTextChange}
          rows={2}
          maxLength={400}
          style={{
            fontFamily: FONT_STYLES[textStyleIndex].family,
            fontSize: "clamp(1.5rem, 4.5vw, 2.2rem)",
            lineHeight: "1.4",
          }}
          autoFocus
        />

        {/* Dynamic Sticker Previews */}
        <AnimatePresence>
          {activeSticker && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 10 }}
              className="mt-8 relative"
            >
              {/* Sticker Close button */}
              <button
                onClick={handleRemoveSticker}
                className="absolute -top-3 -right-3 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-md z-10 cursor-pointer"
                title={t("status.remove_sticker") || "Remove Sticker"}
              >
                <X className="h-3.5 w-3.5" />
              </button>

              {activeSticker === "poll" && (
                <div className="bg-[#2a3942] border border-white/10 rounded-xl p-4 w-72 text-white shadow-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart2 className="h-5 w-5 text-[#00a884]" />
                    <input
                      type="text"
                      className="bg-transparent border-b border-white/20 focus:border-[#00a884] focus:outline-none flex-1 text-sm font-semibold py-0.5"
                      value={stickerData.question || ""}
                      onChange={(e) => setStickerData({ ...stickerData, question: e.target.value })}
                      placeholder={t("status.ask_question_placeholder") || "Ask a question..."}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    {stickerData.options?.map((opt, i) => (
                      <div key={opt.id} className="flex items-center gap-2">
                        <span className="text-xs text-white/40">{i + 1}</span>
                        <input
                          type="text"
                          className="bg-white/5 hover:bg-white/10 rounded px-2.5 py-1 text-xs focus:bg-white/10 focus:outline-none flex-1 text-white"
                          value={opt.text}
                          onChange={(e) => {
                            const newOptions = [...stickerData.options];
                            newOptions[i] = { ...opt, text: e.target.value };
                            setStickerData({ ...stickerData, options: newOptions });
                          }}
                          placeholder={t("status.option_count", { count: i + 1 }) || `Option ${i + 1}`}
                        />
                      </div>
                    ))}
                    {stickerData.options?.length < 4 && (
                      <button
                        onClick={() => {
                          const newOpts = [...stickerData.options, { id: Date.now(), text: "" }];
                          setStickerData({ ...stickerData, options: newOpts });
                        }}
                        className="text-[11px] text-[#00a884] font-semibold text-left flex items-center gap-1 mt-1 hover:underline cursor-pointer"
                      >
                        <Plus className="h-3 w-3" /> {t("status.add_option") || "Add option"}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {activeSticker === "question" && (
                <div className="bg-[#7f66ff] border border-white/10 rounded-xl p-4 w-72 text-white shadow-xl flex flex-col items-center">
                  <Smile className="h-7 w-7 mb-2" />
                  <input
                    type="text"
                    className="bg-white/10 hover:bg-white/20 rounded px-3 py-1.5 text-center text-sm font-bold placeholder-white/60 focus:outline-none w-full"
                    value={stickerData.prompt || ""}
                    onChange={(e) => setStickerData({ ...stickerData, prompt: e.target.value })}
                    placeholder={t("status.ask_me_question_placeholder") || "Ask me a question!"}
                  />
                  <div className="bg-white text-black/60 rounded px-3 py-2 w-full mt-3 text-xs text-center select-none font-medium">
                    {t("status.type_something") || "Type something..."}
                  </div>
                </div>
              )}

              {activeSticker === "music" && (
                <div className="bg-gradient-to-r from-[#f35369] to-[#ff7e5f] border border-white/10 rounded-xl p-3.5 w-64 text-white shadow-xl flex items-center gap-3">
                  <div className="h-12 w-12 rounded bg-black/30 flex items-center justify-center shrink-0 animate-spin" style={{ animationDuration: "6s" }}>
                    <Music className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate leading-snug">{stickerData.title}</p>
                    <p className="text-xs text-white/80 truncate leading-snug">{stickerData.artist}</p>
                  </div>
                </div>
              )}

              {activeSticker === "countdown" && (
                <div className="bg-[#233138] border border-white/10 rounded-xl p-4 w-72 text-white shadow-xl flex flex-col items-center">
                  <input
                    type="text"
                    className="bg-transparent text-center border-b border-white/15 focus:border-[#34b7f1] focus:outline-none text-sm font-semibold w-full pb-1 mb-3"
                    value={stickerData.title || ""}
                    onChange={(e) => setStickerData({ ...stickerData, title: e.target.value })}
                    placeholder={t("status.countdown_title_placeholder") || "Countdown Title..."}
                  />
                  <div className="flex gap-2">
                    <div className="bg-white/5 border border-white/10 rounded p-2 text-center min-w-[50px]">
                      <div className="text-lg font-bold">24</div>
                      <div className="text-[9px] text-white/50 uppercase">{t("status.hrs") || "Hrs"}</div>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded p-2 text-center min-w-[50px]">
                      <div className="text-lg font-bold">00</div>
                      <div className="text-[9px] text-white/50 uppercase">{t("status.mins") || "Mins"}</div>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded p-2 text-center min-w-[50px]">
                      <div className="text-lg font-bold">00</div>
                      <div className="text-[9px] text-white/50 uppercase">{t("status.secs") || "Secs"}</div>
                    </div>
                  </div>
                  <input
                    type="datetime-local"
                    className="bg-white/5 hover:bg-white/10 text-white rounded p-1.5 text-xs w-full mt-3 focus:outline-none border-none"
                    value={stickerData.targetDate ? stickerData.targetDate.slice(0, 16) : ""}
                    onChange={(e) => setStickerData({ ...stickerData, targetDate: new Date(e.target.value).toISOString() })}
                  />
                </div>
              )}

              {activeSticker === "location" && (
                <div className="bg-[#2a3942] border border-white/10 rounded-full px-4 py-2.5 text-white shadow-xl flex items-center gap-2 text-sm font-semibold max-w-xs truncate cursor-pointer hover:bg-[#32444f] transition-all">
                  <MapPin className="h-4 w-4 text-[#4f772d] shrink-0" />
                  <span className="truncate">{stickerData.name}</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Real-time Link Preview Card */}
        {linkPreview && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md bg-[#222e35] border border-white/10 rounded-xl overflow-hidden shadow-xl mt-6 flex items-stretch text-white text-left text-xs"
          >
            {linkPreview.image && (
              <img
                src={linkPreview.image}
                alt="Link Preview"
                className="w-24 object-cover shrink-0 border-r border-white/10 bg-black/20"
              />
            )}
            <div className="p-3 flex-1 flex flex-col justify-center min-w-0">
              <span className="text-[10px] uppercase font-bold text-white/50 tracking-wider truncate mb-0.5">{linkPreview.domain || linkPreview.siteName}</span>
              <p className="font-bold truncate leading-snug text-white/95">{linkPreview.title}</p>
              {linkPreview.description && (
                <p className="text-white/60 line-clamp-2 leading-relaxed mt-0.5">{linkPreview.description}</p>
              )}
            </div>
          </motion.div>
        )}

        {fetchingLink && (
          <div className="mt-4 flex items-center gap-2 text-white/60 text-xs">
            <div className="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-white"></div>
            {t("chat.loading_link_preview") || "Loading link preview..."}
          </div>
        )}

        {/* Mentions dropdown list */}
        {mentionQuery !== null && (
          <MentionSuggestions
            query={mentionQuery}
            contacts={contacts}
            onSelect={handleSelectMention}
          />
        )}
      </div>

      {/* Emoji picker container */}
      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div
            ref={emojiContainerRef}
            initial={{ y: 350 }}
            animate={{ y: 0 }}
            exit={{ y: 350 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="w-full max-w-md bg-[#233138] border-t border-white/10 z-30 shrink-0 self-center rounded-t-xl overflow-hidden"
          >
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              theme="dark"
              width="100%"
              height={320}
              skinTonesDisabled
              searchDisabled={false}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer controls & Send */}
      <div className="p-4 sm:p-6 bg-black/10 flex justify-between items-center shrink-0 z-20">
        <button
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className={`p-2.5 rounded-full hover:bg-black/10 text-white cursor-pointer ${
            showEmojiPicker ? "bg-black/20" : ""
          }`}
          title={t("status.add_emoji") || "Add Emoji"}
        >
          <Smile className="h-6 w-6" />
        </button>

        {uploading ? (
          <div className="flex items-center gap-3 bg-[#00a884] text-white px-5 py-2.5 rounded-full shadow-md font-medium text-sm">
            <Loader size="sm" className="border-white" />
            <span>{t("status.uploading_percentage", { progress: uploadProgress }) || `Uploading... (${uploadProgress}%)`}</span>
          </div>
        ) : (
          <button
            onClick={handleSend}
            disabled={!textContent.trim() && !activeSticker}
            className="h-14 w-14 rounded-full bg-[#00a884] text-white shadow-lg flex items-center justify-center cursor-pointer hover:bg-[#008f72] disabled:bg-[#00a884]/40 disabled:text-white/40 disabled:cursor-not-allowed transition-all"
            title={t("status.send_status_update") || "Send status update"}
          >
            <Send className="h-6 w-6 translate-x-0.5" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
