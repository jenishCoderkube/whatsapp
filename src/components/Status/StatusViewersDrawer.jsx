"use client";

import React from "react";
import { X, Eye, Award, Clock } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "../../hooks/useTranslation";
import { formatMessageTime } from "../../utils/dateUtils";
import { statusService } from "../../services/statusService";

export function StatusViewersDrawer({ isOpen, onClose, views = [], activeStatus = null }) {
  const { t } = useTranslation();

  // Decode status metadata to match poll vote IDs with option texts
  const getVoteLabel = (optionId) => {
    if (!activeStatus) return t("status.vote") || "Vote";
    const rawContent = activeStatus.type === "text" ? activeStatus.textContent : activeStatus.caption;
    const { metadata } = statusService.decodeMetadata(rawContent);
    const pollOptions = metadata?.poll?.options;
    if (!pollOptions) return t("status.voted") || "Voted";
    const found = pollOptions.find((o) => String(o.id) === String(optionId));
    return found ? `🗳️ ${found.text}` : (t("status.voted") || "Voted");
  };

  // Advanced Analytics: chronologically sorting to tag First and Last viewers
  const chronologicalViews = [...views].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const firstViewerId = chronologicalViews[0]?.viewerId;
  const lastViewerId = chronologicalViews[chronologicalViews.length - 1]?.viewerId;

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
          {/* Mobile floating views badge */}
          <div className="md:hidden absolute -top-4.5 left-1/2 -translate-x-1/2 bg-[#1f2c34] px-4 py-1.5 rounded-full border border-white/10 shadow-lg flex items-center gap-1.5 z-50">
            <Eye className="h-3.5 w-3.5 text-[#00a884] animate-pulse" />
            <span className="text-[11px] font-bold text-white/95">
              {views.length} {views.length === 1 ? (t("status.view") || "view") : (t("status.views") || "views")}
            </span>
          </div>

          {/* Header */}
          <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
            <span className="font-semibold text-[#e9edef] flex items-center gap-2">
              <span>{t("status.viewed_by") || "Viewed by"} ({views.length})</span>
              {views.length > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00a884]/20 text-[#00a884] font-bold uppercase tracking-wider">
                  {t("status.live_stats") || "Live stats"}
                </span>
              )}
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
                .map((vw, index) => {
                  const isFirst = vw.viewerId === firstViewerId && views.length > 1;
                  const isLast = vw.viewerId === lastViewerId && views.length > 1;

                  return (
                    <motion.div
                      key={vw.viewerId || index}
                      layout
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      className="flex items-center justify-between border-b border-white/5 pb-2.5 shrink-0"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={vw.avatar}
                          fallback={vw.name?.[0] || "?"}
                          size="sm"
                          uid={vw.viewerId}
                        />
                        <div className="flex flex-col text-left">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-white">
                              {vw.name}
                            </span>
                            {isFirst && (
                              <span className="flex items-center gap-0.5 text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <Award className="h-2.5 w-2.5" /> {t("status.first_viewer") || "First"}
                              </span>
                            )}
                            {isLast && (
                              <span className="flex items-center gap-0.5 text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                <Clock className="h-2.5 w-2.5" /> {t("status.newest_viewer") || "Newest"}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-white/50">
                            {formatMessageTime(vw.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Reaction / Reply / Poll Vote / Question Answer */}
                      <div className="flex items-center gap-2 max-w-[50%]">
                        {vw.voteOptionId && (
                          <span className="text-xs bg-[#202c33] text-[#00a884] rounded-lg px-2.5 py-1 border border-[#00a884]/20 font-medium truncate">
                            {getVoteLabel(vw.voteOptionId)}
                          </span>
                        )}
                        {vw.questionAnswer && (
                          <span className="text-xs bg-[#7f66ff]/10 text-[#a899ff] border border-[#7f66ff]/20 rounded-lg px-2.5 py-1 truncate max-w-[120px]" title={vw.questionAnswer}>
                            💬 "{vw.questionAnswer}"
                          </span>
                        )}
                        {vw.reaction && (
                          <span className="text-lg bg-[#2a3942] rounded-full p-1 leading-none shadow" title={t("chat.react") || "Reaction"}>
                            {vw.reaction}
                          </span>
                        )}
                        {vw.replyText && (
                          <span className="text-xs bg-[#2a3942] text-white/90 rounded px-2.5 py-1 truncate max-w-[120px]" title={vw.replyText}>
                            💬 {vw.replyText}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })
            ) : (
              <div className="text-center py-8 text-xs text-white/40">
                {t("status.no_views_desc") || "No views yet. Share updates to see viewers here."}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
