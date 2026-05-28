"use client";

import React, { useRef } from "react";
import { ArrowLeft, Plus, Type, CircleDashed } from "lucide-react";
import { StatusAvatar } from "./StatusAvatar";
import { cn } from "../../utils/cn";
import { useTranslation } from "../../hooks/useTranslation";
import { formatMessageTime } from "../../utils/dateUtils";

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
  onTriggerMediaSelect,
  className,
}) {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onTriggerMediaSelect(file);
      e.target.value = "";
    }
  };

  return (
    <aside className={cn("w-full md:w-[380px] lg:w-[400px] shrink-0 border-r border-wa-border flex flex-col h-full bg-wa-sidebar transition-colors duration-200", className)}>
      {/* Header */}
      <header className="flex items-center gap-6 px-4 py-4 bg-wa-header text-wa-text shrink-0">
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
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 flex flex-col gap-2">
        
        {/* MY STATUS ROW */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-wa-border bg-wa-sidebar">
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
                <div className="absolute -bottom-1 -right-1 bg-wa-primary text-white rounded-full p-1 border-2 border-wa-sidebar">
                  <Plus className="h-3.5 w-3.5 stroke-[3]" />
                </div>
              )}
            </div>

            <div className="flex flex-col text-left">
              <span className="text-sm font-medium text-wa-text">{t("status.my_status") || "My status"}</span>
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
          <div className="flex items-center gap-1">
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
            />
          </div>
        </div>

        {/* Privacy Link */}
        <div className="px-4 py-1.5 flex items-center justify-between">
          <span className="text-xs text-wa-muted">
            {t("status.privacy_set_to", { privacy }) || `Privacy is set to ${privacy}`}
          </span>
          <button
            onClick={onOpenPrivacy}
            className="text-xs text-wa-primary hover:underline font-semibold cursor-pointer"
          >
            {t("common.change") || "Change"}
          </button>
        </div>

        {/* RECENT UPDATES */}
        {recentUpdates.length > 0 && (
          <div className="flex flex-col">
            <span className="px-4 py-2 text-xs font-semibold text-wa-primary uppercase tracking-wider text-left">
              {t("status.recent_updates") || "Recent updates"}
            </span>
            {recentUpdates.map((group) => {
              const lastUpdate = group.statuses[group.statuses.length - 1];
              return (
                <div
                  key={group.userId}
                  onClick={() => onSelectGroup(group.userId)}
                  className="px-4 py-3 flex items-center gap-4 hover:bg-wa-hover cursor-pointer transition-colors"
                >
                  <StatusAvatar
                    src={group.avatar}
                    fallback={group.name?.[0] || "?"}
                    statuses={group.statuses}
                    size="lg"
                    uid={group.userId}
                  />
                  <div className="flex flex-col text-left">
                    <span className="text-sm font-medium text-wa-text">{group.name}</span>
                    <span className="text-xs text-wa-muted">
                      {formatMessageTime(lastUpdate.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* VIEWED UPDATES */}
        {viewedUpdates.length > 0 && (
          <div className="flex flex-col mt-2">
            <span className="px-4 py-2 text-xs font-semibold text-wa-muted uppercase tracking-wider text-left">
              {t("status.viewed_updates") || "Viewed updates"}
            </span>
            {viewedUpdates.map((group) => {
              const lastUpdate = group.statuses[group.statuses.length - 1];
              return (
                <div
                  key={group.userId}
                  onClick={() => onSelectGroup(group.userId)}
                  className="px-4 py-3 flex items-center gap-4 hover:bg-wa-hover cursor-pointer transition-colors opacity-70 hover:opacity-100"
                >
                  <StatusAvatar
                    src={group.avatar}
                    fallback={group.name?.[0] || "?"}
                    statuses={group.statuses}
                    size="lg"
                    uid={group.userId}
                  />
                  <div className="flex flex-col text-left">
                    <span className="text-sm font-medium text-wa-text">{group.name}</span>
                    <span className="text-xs text-wa-muted">
                      {formatMessageTime(lastUpdate.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {recentUpdates.length === 0 && viewedUpdates.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center text-wa-muted">
            <CircleDashed className="h-10 w-10 text-wa-muted/30 animate-pulse mb-3" />
            <span className="text-xs">{t("status.no_updates_from_contacts") || "No updates from your contacts"}</span>
          </div>
        )}

      </div>
    </aside>
  );
}
