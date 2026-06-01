"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Send, Crop, Plus, Trash2, Smile, ArrowLeft } from "lucide-react";
import { Input } from "../ui/Input";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { useTranslation } from "../../hooks/useTranslation";
import { useAppSelector } from "../../hooks/useRedux";
import { ImageCropper } from "./ImageCropper";
import { MentionSuggestions } from "./MentionSuggestions";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
  loading: () => (
    <div className="h-[350px] w-full flex items-center justify-center bg-[#233138] rounded-lg">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-wa-primary"></div>
    </div>
  ),
});

export function StatusComposerMedia({
  mediaFiles, // Array of File objects passed from selector
  onCancel,
  onSubmit, // Callback(drafts)
  uploading,
  uploadProgress,
}) {
  const { t } = useTranslation();
  const chats = useAppSelector((state) => state.chat.chats);

  // Drafts array: [{ id, file, previewUrl, caption, mentions: [] }]
  const [drafts, setDrafts] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);

  // Crop overlay trigger state
  const [croppingImage, setCroppingImage] = useState(null); // { id, previewUrl } or null

  // UI state overlays
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [mentionQuery, setMentionQuery] = useState(null);

  // References
  const emojiContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const captionInputRef = useRef(null);

  // Derive unique contacts for @mentions from chats
  const contacts = Array.from(
    new Map(
      chats
        .filter((c) => !c.isGroup && c.peerId)
        .map((c) => [c.peerId, { id: c.peerId, name: c.name, avatar: c.avatar }])
    ).values()
  );

  // Initialize drafts when mediaFiles changes
  useEffect(() => {
    if (mediaFiles && mediaFiles.length > 0) {
      const initialDrafts = mediaFiles.map((file, idx) => ({
        id: `draft-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        caption: "",
        mentions: [],
      }));
      setDrafts(initialDrafts);
      setActiveIndex(0);

      // Clean up object URLs on unmount
      return () => {
        initialDrafts.forEach((d) => URL.revokeObjectURL(d.previewUrl));
      };
    }
  }, [mediaFiles]);

  const activeDraft = drafts[activeIndex];

  // Close emojis on click outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (showEmojiPicker && emojiContainerRef.current && !emojiContainerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showEmojiPicker]);

  const handleCaptionChange = (e) => {
    const val = e.target.value;
    updateActiveDraft({ caption: val });

    // Cursor position search for @mentions
    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.substring(0, cursor);
    const match = textBeforeCursor.match(/@(\w*)$/);
    if (match) {
      setMentionQuery(match[1]);
    } else {
      setMentionQuery(null);
    }
  };

  const updateActiveDraft = (fields) => {
    setDrafts((prev) =>
      prev.map((d, idx) => (idx === activeIndex ? { ...d, ...fields } : d))
    );
  };

  const handleSelectMention = (contact) => {
    if (!captionInputRef.current || !activeDraft) return;
    const cursor = captionInputRef.current.selectionStart;
    const val = activeDraft.caption;
    const textBeforeCursor = val.substring(0, cursor);
    const textAfterCursor = val.substring(cursor);

    const match = textBeforeCursor.match(/@(\w*)$/);
    if (match) {
      const startIndex = match.index;
      const newTextBefore = val.substring(0, startIndex) + `@${contact.name} `;
      const newCaption = newTextBefore + textAfterCursor;
      
      updateActiveDraft({
        caption: newCaption,
        mentions: [...(activeDraft.mentions || []), { id: contact.id, name: contact.name }],
      });
      setMentionQuery(null);

      setTimeout(() => {
        captionInputRef.current?.focus();
        const newCursorPos = newTextBefore.length;
        captionInputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
      }, 50);
    }
  };

  const handleEmojiClick = (emojiObj) => {
    if (!activeDraft) return;
    updateActiveDraft({ caption: activeDraft.caption + emojiObj.emoji });
  };

  const handleAddMoreFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newDrafts = files.map((file, idx) => ({
      id: `draft-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      caption: "",
      mentions: [],
    }));

    setDrafts((prev) => [...prev, ...newDrafts]);
    setActiveIndex(drafts.length); // Switch to first new file added
  };

  const handleDeleteDraft = (indexToDelete, e) => {
    e.stopPropagation();
    if (drafts.length <= 1) {
      onCancel();
      return;
    }

    const item = drafts[indexToDelete];
    URL.revokeObjectURL(item.previewUrl);

    const updated = drafts.filter((_, idx) => idx !== indexToDelete);
    setDrafts(updated);

    if (activeIndex >= updated.length) {
      setActiveIndex(updated.length - 1);
    }
  };

  const handleCropComplete = (croppedBlob) => {
    if (!activeDraft) return;
    
    // Revoke old object URL to prevent memory leaks
    URL.revokeObjectURL(activeDraft.previewUrl);

    const croppedFile = new File([croppedBlob], activeDraft.file.name, {
      type: croppedBlob.type,
      lastModified: Date.now(),
    });

    updateActiveDraft({
      file: croppedFile,
      previewUrl: URL.createObjectURL(croppedBlob),
    });

    setCroppingImage(null);
  };

  const handleSend = () => {
    if (drafts.length === 0) return;

    const submittedDrafts = drafts.map((d) => ({
      file: d.file,
      caption: d.caption.trim(),
      metadata: {
        mentions: d.mentions.filter((m) => d.caption.includes(`@${m.name}`)),
      },
    }));

    onSubmit(submittedDrafts);
  };

  if (!activeDraft) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="absolute inset-0 z-20 flex flex-col bg-black text-white overflow-hidden select-none"
    >
      {/* Crop Interface Modal Overlay */}
      <AnimatePresence>
        {croppingImage && (
          <ImageCropper
            imageUrl={croppingImage.previewUrl}
            onCrop={handleCropComplete}
            onCancel={() => setCroppingImage(null)}
          />
        )}
      </AnimatePresence>

      {/* Header toolbar */}
      <div className="flex items-center justify-between p-4 bg-black/40 shrink-0 border-b border-white/5">
        <button
          onClick={onCancel}
          className="p-2 rounded-full hover:bg-white/10 text-white cursor-pointer"
          title={t("common.cancel") || "Cancel"}
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <span className="text-sm font-semibold">
          {t("status.preview_status") || "Preview Status"} ({activeIndex + 1}/{drafts.length})
        </span>

        <div className="flex items-center gap-2">
          {activeDraft.file.type.startsWith("image/") && (
            <button
              onClick={() => setCroppingImage({ id: activeDraft.id, previewUrl: activeDraft.previewUrl })}
              className="p-2.5 rounded-full hover:bg-white/10 text-white cursor-pointer"
              title={t("status.crop_image") || "Crop Image"}
            >
              <Crop className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Main selected item media canvas */}
      <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden bg-[#0c1317]">
        {activeDraft.file.type.startsWith("video/") ? (
          <video
            key={activeDraft.id}
            src={activeDraft.previewUrl}
            className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
            controls
            autoPlay
            muted
          />
        ) : (
          <img
            key={activeDraft.id}
            src={activeDraft.previewUrl}
            alt="Upload Preview"
            className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
          />
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

      {/* Drafts Carousel Thumbnails strip */}
      {drafts.length > 0 && (
        <div className="bg-[#111b21] px-4 py-2 border-t border-white/5 flex items-center gap-3 overflow-x-auto shrink-0 select-none">
          {drafts.map((d, index) => (
            <div
              key={d.id}
              onClick={() => {
                setActiveIndex(index);
                setShowEmojiPicker(false);
              }}
              className={`h-14 w-14 rounded-lg overflow-hidden border-2 relative shrink-0 cursor-pointer transition-all ${
                index === activeIndex ? "border-[#00a884] scale-105" : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              {d.file.type.startsWith("video/") ? (
                <video src={d.previewUrl} className="h-full w-full object-cover pointer-events-none" />
              ) : (
                <img src={d.previewUrl} className="h-full w-full object-cover pointer-events-none" alt="thumb" />
              )}
              
              {/* Delete thumb button */}
              <button
                onClick={(e) => handleDeleteDraft(index, e)}
                className="absolute top-0.5 right-0.5 bg-black/75 hover:bg-red-500 rounded p-1 text-white transition-all shadow"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}

          {/* Add more button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="h-14 w-14 rounded-lg border-2 border-dashed border-white/20 hover:border-white/40 flex items-center justify-center shrink-0 cursor-pointer transition-colors text-white/50 hover:text-white"
            title={t("status.add_more_files") || "Add more files"}
          >
            <Plus className="h-6 w-6" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAddMoreFiles}
            accept="image/*,video/*"
            className="hidden"
            multiple
          />
        </div>
      )}

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
              height={300}
              skinTonesDisabled
              searchDisabled={false}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Caption bar & send button */}
      <div className="bg-[#111b21] p-4 flex flex-col gap-3 shrink-0 border-t border-white/5">
        <div className="flex items-center gap-3 bg-[#2a3942] rounded-lg px-4 py-1 relative">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className={`p-1.5 rounded-full hover:bg-white/5 text-white/70 hover:text-white cursor-pointer ${
              showEmojiPicker ? "text-white" : ""
            }`}
            title={t("status.emoji_picker") || "Emoji Picker"}
          >
            <Smile className="h-5 w-5" />
          </button>

          <Input
            ref={captionInputRef}
            type="text"
            placeholder={t("chat.add_caption") || "Add a caption..."}
            value={activeDraft.caption}
            onChange={handleCaptionChange}
            className="bg-transparent border-none text-white text-sm focus:ring-0 focus:outline-none flex-1 py-3"
          />
        </div>

        <div className="flex justify-end pt-1">
          {uploading ? (
            <div className="flex items-center gap-3 bg-[#00a884] text-white px-5 py-2.5 rounded-full shadow-md font-medium text-sm animate-pulse">
              <span>{t("status.uploading_media", { progress: uploadProgress }) || `Uploading status media... (${uploadProgress}%)`}</span>
            </div>
          ) : (
            <button
              onClick={handleSend}
              className="h-14 w-14 rounded-full bg-[#00a884] text-white shadow-lg flex items-center justify-center cursor-pointer hover:bg-[#008f72] transition-colors"
              title={t("status.upload_status_update") || "Upload status update"}
            >
              <Send className="h-6 w-6 translate-x-0.5" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
