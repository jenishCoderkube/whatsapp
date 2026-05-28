"use client";

import React from "react";
import { X, Eye } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "../../hooks/useTranslation";

export function StatusViewersDrawer({ isOpen, onClose, views = [] }) {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25 }}
          className="absolute inset-x-0 bottom-0 z-40 bg-[#1f2c34] rounded-t-2xl shadow-2xl border-t border-white/10 max-h-[50vh] flex flex-col select-none"
        >
          {/* Mobile floating views pill on top edge of drawer */}
          <div className="md:hidden absolute -top-4.5 left-1/2 -translate-x-1/2 bg-[#1f2c34] px-4 py-1 rounded-full border border-white/10 shadow-lg flex items-center gap-1.5 z-50">
            <Eye className="h-3.5 w-3.5 text-wa-primary animate-pulse" />
            <span className="text-[11px] font-bold text-white/95">
              {views.length} {views.length === 1 ? (t("status.view") || "view") : (t("status.views") || "views")}
            </span>
          </div>

          {/* Header */}
          <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
            <span className="font-semibold text-[#e9edef]">
              {t("status.viewed_by") || "Viewed by"} ({views.length})
            </span>
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-white/5 text-white cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Viewers List */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {views.length > 0 ? (
              [...views]
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .map((vw, index) => (
                  <motion.div
                    key={vw.viewerId || index}
                    layout
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="flex items-center justify-between border-b border-white/5 pb-2 shrink-0"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={vw.avatar}
                        fallback={vw.name?.[0] || "?"}
                        size="sm"
                        uid={vw.viewerId}
                      />
                      <div className="flex flex-col text-left">
                        <span className="text-xs font-semibold text-white">
                          {vw.name}
                        </span>
                        <span className="text-[10px] text-white/50">
                          {new Date(vw.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Reaction / Reply Text */}
                    <div className="flex items-center gap-2">
                      {vw.reaction && (
                        <span className="text-xl bg-[#2a3942] rounded-full p-1" title={t("chat.reaction") || "Reaction"}>
                          {vw.reaction}
                        </span>
                      )}
                      {vw.replyText && (
                        <span className="text-xs bg-[#2a3942] text-white/90 rounded px-2 py-1 max-w-[120px] truncate" title={vw.replyText}>
                          💬 {vw.replyText}
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))
            ) : (
              <div className="text-center py-6 text-xs text-white/40">
                {t("status.no_views_desc") || "No views yet. Share updates to see viewers here."}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
