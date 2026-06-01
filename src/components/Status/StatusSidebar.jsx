"use client";

import React, { useRef, useState } from "react";
import { ArrowLeft, Plus, Type, CircleDashed, VolumeX, Volume2, ChevronDown, ChevronUp } from "lucide-react";
import { StatusAvatar } from "./StatusAvatar";
import { cn } from "../../utils/cn";
import { useTranslation } from "../../hooks/useTranslation";
import { formatMessageTime } from "../../utils/dateUtils";
import { useAppSelector, useAppDispatch } from "../../hooks/useRedux";
import { muteUser, unmuteUser } from "../../redux/slices/statusSlice";

export function StatusSidebar({
  user,
  myStatuses = [],
  recentUpdates = [],
  viewedUpdates = [],
  privacy = "contacts",
  onClose,
  onSelectMyStatus,
  onSelectGroup,
  onOpenPrivacy,
  onTriggerTextComposer,
  onTriggerMediaSelect, // Now receives array of Files
  className,
}) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const fileInputRef = useRef(null);

  // Muted updates accordion state
  const [mutedExpanded, setMutedExpanded] = useState(false);

  // Redux states
  const loading = useAppSelector((state) => state.status.loading);
  const mutedUsers = useAppSelector((state) => state.status.mutedUsers) || [];

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onTriggerMediaSelect(files);
      e.target.value = "";
    }
  };

  // Filter updates based on muted users
  const activeRecentUpdates = recentUpdates.filter((g) => !mutedUsers.includes(g.userId));
  const activeViewedUpdates = viewedUpdates.filter((g) => !mutedUsers.includes(g.userId));
  const mutedGroupUpdates = [
    ...recentUpdates.filter((g) => mutedUsers.includes(g.userId)),
    ...viewedUpdates.filter((g) => mutedUsers.includes(g.userId)),
  ];

  const handleMuteToggle = (userId, e) => {
    e.stopPropagation();
    if (mutedUsers.includes(userId)) {
      dispatch(unmuteUser(userId));
    } else {
      dispatch(muteUser(userId));
    }
  };

  return (
    <aside className={cn("w-full md:w-[380px] lg:w-[400px] shrink-0 border-r border-wa-border flex flex-col h-full bg-wa-sidebar transition-colors duration-200", className)}>
      {/* Header */}
      <header className="flex items-center gap-6 px-4 py-4 bg-wa-header text-wa-text shrink-0 border-b border-wa-border/5">
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-wa-hover transition-colors cursor-pointer text-wa-text"
          title={t("common.back") || "Back"}
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <span className="font-semibold text-base sm:text-lg text-wa-text">{t("status.status") || "Status"}</span>
      </header>

      {/* Scrollable Status Content Lists */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 flex flex-col">
        
        {/* MY STATUS ROW */}
        <div className="px-4 py-3.5 flex items-center justify-between border-b border-wa-border/40 bg-wa-sidebar/70">
          <div
            onClick={() => {
              if (myStatuses.length > 0) {
                onSelectMyStatus();
              }
            }}
            className={`flex items-center gap-4 flex-1 ${
              myStatuses.length > 0 ? "cursor-pointer" : ""
            }`}
          >
            <div className="relative">
              <StatusAvatar
                src={user?.avatar}
                fallback={user?.name?.[0] || "?"}
                statuses={myStatuses.map((s) => ({
                  ...s,
                  isSeen: true,
                }))}
                size="lg"
                uid={user?.id}
              />
              {myStatuses.length === 0 && (
                <div className="absolute -bottom-1 -right-1 bg-[#00a884] text-white rounded-full p-1 border-2 border-wa-sidebar shadow">
                  <Plus className="h-3.5 w-3.5 stroke-[3]" />
                </div>
              )}
            </div>

            <div className="flex flex-col text-left">
              <span className="text-sm font-semibold text-wa-text">{t("status.my_status") || "My status"}</span>
              <span className="text-xs text-wa-muted">
                {myStatuses.length > 0
                  ? t("status.last_updated", {
                      time: formatMessageTime(myStatuses[0].createdAt)
                    }) || `Last updated: ${formatMessageTime(myStatuses[0].createdAt)}`
                  : (t("status.tap_to_add") || "Tap to add status update")}
              </span>
            </div>
          </div>

          {/* Upload Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onTriggerTextComposer}
              className="p-2 rounded-full hover:bg-wa-hover text-wa-muted hover:text-wa-text transition-colors cursor-pointer"
              title={t("status.write_text_status") || "Write text status"}
            >
              <Type className="h-5 w-5" />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-full hover:bg-wa-hover text-wa-muted hover:text-wa-text transition-colors cursor-pointer"
              title={t("status.upload_photos_videos") || "Upload photos or videos"}
            >
              <Plus className="h-5 w-5" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*,video/*"
              className="hidden"
              multiple
            />
          </div>
        </div>

        {/* Privacy Settings link */}
        <div className="px-4 py-2 border-b border-wa-border/30 flex items-center justify-between text-xs bg-wa-sidebar/30">
          <span className="text-wa-muted font-medium">
            {t("status.privacy_set_to", { privacy }) || `Status privacy: ${privacy}`}
          </span>
          <button
            onClick={onOpenPrivacy}
            className="text-wa-primary hover:underline font-semibold cursor-pointer"
          >
            {t("common.change") || "Edit"}
          </button>
        </div>

        {/* LOADING SKELETON STATE */}
        {loading ? (
          <div className="flex flex-col gap-1 p-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="px-3 py-3.5 flex items-center gap-4 animate-pulse">
                <div className="h-12 w-12 rounded-full bg-wa-border/40 shrink-0" />
                <div className="flex-1 flex flex-col gap-2">
                  <div className="h-4 w-28 bg-wa-border/40 rounded" />
                  <div className="h-3 w-16 bg-wa-border/30 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-1.5 pt-2">
            
            {/* RECENT UPDATES */}
            {activeRecentUpdates.length > 0 && (
              <div className="flex flex-col">
                <span className="px-4 py-2.5 text-xs font-bold text-wa-primary uppercase tracking-wider text-left">
                  {t("status.recent_updates") || "Recent updates"}
                </span>
                {activeRecentUpdates.map((group) => {
                  const lastUpdate = group.statuses[group.statuses.length - 1];
                  return (
                    <div
                      key={group.userId}
                      onClick={() => onSelectGroup(group.userId)}
                      className="px-4 py-3 flex items-center gap-4 hover:bg-wa-hover cursor-pointer transition-colors relative group select-none"
                    >
                      <StatusAvatar
                        src={group.avatar}
                        fallback={group.name?.[0] || "?"}
                        statuses={group.statuses}
                        size="lg"
                        uid={group.userId}
                      />
                      <div className="flex flex-col text-left flex-1 min-w-0">
                        <span className="text-sm font-semibold text-wa-text truncate">{group.name}</span>
                        <span className="text-xs text-wa-muted">
                          {formatMessageTime(lastUpdate.createdAt)}
                        </span>
                      </div>

                      {/* Mute action hover button */}
                      <button
                        onClick={(e) => handleMuteToggle(group.userId, e)}
                        className="opacity-0 group-hover:opacity-100 p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-wa-muted hover:text-red-400 transition-all shrink-0 cursor-pointer"
                        title={t("status.mute_updates") || "Mute updates"}
                      >
                        <VolumeX className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* VIEWED UPDATES */}
            {activeViewedUpdates.length > 0 && (
              <div className="flex flex-col mt-2">
                <span className="px-4 py-2.5 text-xs font-bold text-wa-muted uppercase tracking-wider text-left">
                  {t("status.viewed_updates") || "Viewed updates"}
                </span>
                {activeViewedUpdates.map((group) => {
                  const lastUpdate = group.statuses[group.statuses.length - 1];
                  return (
                    <div
                      key={group.userId}
                      onClick={() => onSelectGroup(group.userId)}
                      className="px-4 py-3 flex items-center gap-4 hover:bg-wa-hover cursor-pointer transition-colors opacity-75 hover:opacity-100 relative group select-none"
                    >
                      <StatusAvatar
                        src={group.avatar}
                        fallback={group.name?.[0] || "?"}
                        statuses={group.statuses}
                        size="lg"
                        uid={group.userId}
                      />
                      <div className="flex flex-col text-left flex-1 min-w-0">
                        <span className="text-sm font-medium text-wa-text truncate">{group.name}</span>
                        <span className="text-xs text-wa-muted">
                          {formatMessageTime(lastUpdate.createdAt)}
                        </span>
                      </div>

                      {/* Mute action hover button */}
                      <button
                        onClick={(e) => handleMuteToggle(group.userId, e)}
                        className="opacity-0 group-hover:opacity-100 p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-wa-muted hover:text-red-400 transition-all shrink-0 cursor-pointer"
                        title={t("status.mute_updates") || "Mute updates"}
                      >
                        <VolumeX className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* COLLAPSIBLE MUTED UPDATES */}
            {mutedGroupUpdates.length > 0 && (
              <div className="flex flex-col mt-3 border-t border-wa-border/25">
                <button
                  onClick={() => setMutedExpanded(!mutedExpanded)}
                  className="px-4 py-3 flex items-center justify-between text-xs font-bold text-wa-muted uppercase tracking-wider hover:bg-wa-hover/30 transition-colors w-full cursor-pointer text-left"
                >
                  <span>{t("status.muted_updates_count", { count: mutedGroupUpdates.length }) || `Muted updates (${mutedGroupUpdates.length})`}</span>
                  {mutedExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {mutedExpanded && (
                  <div className="flex flex-col">
                    {mutedGroupUpdates.map((group) => {
                      const lastUpdate = group.statuses[group.statuses.length - 1];
                      return (
                        <div
                          key={group.userId}
                          onClick={() => onSelectGroup(group.userId)}
                          className="px-4 py-2.5 flex items-center gap-4 hover:bg-wa-hover cursor-pointer transition-colors opacity-50 hover:opacity-80 relative group select-none"
                        >
                          <StatusAvatar
                            src={group.avatar}
                            fallback={group.name?.[0] || "?"}
                            statuses={group.statuses}
                            size="lg"
                            uid={group.userId}
                            isMuted={true}
                          />
                          <div className="flex flex-col text-left flex-1 min-w-0">
                            <span className="text-sm font-medium text-wa-text truncate">{group.name}</span>
                            <span className="text-xs text-wa-muted">
                              {formatMessageTime(lastUpdate.createdAt)}
                            </span>
                          </div>

                          {/* Unmute action hover button */}
                          <button
                            onClick={(e) => handleMuteToggle(group.userId, e)}
                            className="opacity-0 group-hover:opacity-100 p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-wa-muted hover:text-wa-primary transition-all shrink-0 cursor-pointer"
                            title={t("status.unmute_updates") || "Unmute updates"}
                          >
                            <Volume2 className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Empty state */}
            {activeRecentUpdates.length === 0 &&
              activeViewedUpdates.length === 0 &&
              mutedGroupUpdates.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 px-6 text-center text-wa-muted select-none">
                  <div className="h-16 w-16 bg-wa-header/40 rounded-full flex items-center justify-center mb-4">
                    <CircleDashed className="h-8 w-8 text-wa-muted/40 animate-pulse" />
                  </div>
                  <h3 className="text-sm font-medium text-wa-text mb-1">{t("status.no_updates") || "No Status Updates"}</h3>
                  <p className="text-xs text-wa-muted max-w-xs leading-relaxed">
                    {t("status.status_updates_desc") || "Status updates from your contacts will appear here. Tap options above to add yours!"}
                  </p>
                </div>
              )}
          </div>
        )}
      </div>
    </aside>
  );
}
