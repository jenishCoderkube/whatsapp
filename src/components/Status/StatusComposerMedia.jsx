"use client";

import React, { useState } from "react";
import { X, Send } from "lucide-react";
import { Input } from "../ui/Input";
import { motion } from "framer-motion";

export function StatusComposerMedia({ mediaFile, previewUrl, onCancel, onSubmit, uploading, uploadProgress }) {
  const [caption, setCaption] = useState("");

  const handleSend = () => {
    onSubmit(caption.trim());
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="absolute inset-0 z-20 flex flex-col bg-black"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/40 shrink-0">
        <button
          onClick={onCancel}
          className="p-2 rounded-full hover:bg-white/10 text-white cursor-pointer"
          title="Cancel"
        >
          <X className="h-6 w-6" />
        </button>
        <span className="text-sm font-semibold">Preview Status update</span>
        <div className="w-10 h-10" />
      </div>

      {/* Media Canvas */}
      <div className="flex-1 flex items-center justify-center p-2 relative overflow-hidden">
        {mediaFile?.type?.startsWith("video/") ? (
          <video
            src={previewUrl}
            className="max-h-full max-w-full object-contain rounded"
            controls
          />
        ) : (
          <img
            src={previewUrl}
            alt="Upload Preview"
            className="max-h-full max-w-full object-contain rounded"
          />
        )}
      </div>

      {/* Caption footer bar */}
      <div className="bg-black/60 p-4 flex flex-col gap-3 shrink-0">
        <div className="flex items-center gap-3 bg-[#2a3942] rounded-lg px-4 py-1">
          <Input
            type="text"
            placeholder="Add a caption..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="bg-transparent border-none text-white text-sm focus:ring-0 focus:outline-none flex-1 py-3"
          />
        </div>

        <div className="flex justify-end pt-1">
          {uploading ? (
            <div className="flex items-center gap-3 bg-[#00a884] text-white px-5 py-2.5 rounded-full shadow-md font-medium text-sm animate-pulse">
              <span>Uploading status media... ({uploadProgress}%)</span>
            </div>
          ) : (
            <button
              onClick={handleSend}
              className="h-14 w-14 rounded-full bg-[#00a884] text-white shadow-lg flex items-center justify-center cursor-pointer hover:bg-[#008f72] transition-colors"
              title="Upload status update"
            >
              <Send className="h-6 w-6 translate-x-0.5" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
