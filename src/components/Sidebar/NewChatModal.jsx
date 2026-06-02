"use client";

import React from "react";
import { Modal } from "../ui/Modal";
import { Avatar } from "../ui/Avatar";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { Search, Check, Loader2 } from "lucide-react";
import { cn } from "../../utils/cn";
import { useTranslation } from "../../hooks/useTranslation";

export function NewChatModal({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  userSearchQuery,
  setUserSearchQuery,
  isSearching,
  searchResults = [],
  handleStartDirectChat,
  groupName,
  setGroupName,
  groupAvatar,
  handleRandomGroupAvatar,
  selectedMembers = [],
  toggleMemberSelection,
  handleCreateGroup,
  onlineMap = {},
  onLoadMore,
  hasMore,
  isSearchingMore,
}) {
  const { t } = useTranslation();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("sidebar.new_chat")}
    >
      <div className="flex flex-col h-[420px]">
        {/* Internal view switching strip */}
        <div className="flex border-b border-wa-border mb-3">
          <button
            onClick={() => setActiveTab("direct")}
            className={cn(
              "flex-1 py-2 text-xs font-medium text-center border-b-2 transition-colors block cursor-pointer",
              activeTab === "direct"
                ? "border-wa-primary text-wa-primary"
                : "border-transparent text-wa-muted hover:text-wa-text",
            )}
          >
            {t("sidebar.direct_chat")}
          </button>
          <button
            onClick={() => setActiveTab("group")}
            className={cn(
              "flex-1 py-2 text-xs font-medium text-center border-b-2 transition-colors block cursor-pointer",
              activeTab === "group"
                ? "border-wa-primary text-wa-primary"
                : "border-transparent text-wa-muted hover:text-wa-text",
            )}
          >
            {t("sidebar.create_group")}
          </button>
        </div>

        {/* Direct Chat search view */}
        {activeTab === "direct" ? (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="relative mb-3 p-0.5">
              <Input
                type="text"
                placeholder={t("sidebar.search_profiles")}
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="pl-9 bg-wa-header border border-wa-border rounded-lg text-xs sm:text-sm py-2 focus:ring-1 focus:ring-wa-primary"
              />
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-wa-muted" />
            </div>

            <div 
              className="flex-1 overflow-y-auto pr-1"
              onScroll={(e) => {
                const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
                if (scrollHeight - scrollTop - clientHeight < 20) {
                  onLoadMore();
                }
              }}
            >
              {isSearching ? (
                <div className="py-8 text-center text-xs text-wa-muted animate-pulse">
                  {t("sidebar.searching_profiles")}
                </div>
              ) : searchResults.length > 0 ? (
                <>
                  {searchResults.map((profile) => (
                    <div
                      key={profile.id}
                      onClick={() => handleStartDirectChat(profile)}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-wa-hover cursor-pointer transition-colors"
                    >
                      <Avatar
                        src={profile.avatar}
                        fallback={profile.name[0]}
                        size="md"
                        isOnline={!!onlineMap[profile.id]}
                        uid={profile.id}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-wa-text truncate">
                          {profile.name}
                        </div>
                        <div className="text-[11px] text-wa-muted truncate">
                          {profile.email}
                        </div>
                      </div>
                    </div>
                  ))}
                  {isSearchingMore && (
                    <div className="py-3 flex items-center justify-center gap-2 text-xs text-wa-muted animate-pulse">
                      <Loader2 className="h-4 w-4 animate-spin text-wa-primary" />
                      <span>{t("common.loading") || "Loading more..."}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-8 text-center text-xs text-wa-muted">
                  {userSearchQuery.trim()
                    ? t("sidebar.no_profiles_found")
                    : t("sidebar.type_to_discover")}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Multi-User Native Group Creation Layer */
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex items-center gap-3 mb-3">
              <div
                onClick={handleRandomGroupAvatar}
                className="cursor-pointer block"
                title={t("sidebar.generate_preset_icon")}
              >
                <Avatar
                  src={groupAvatar}
                  fallback="G"
                  size="lg"
                  className="border border-wa-border hover:opacity-80 transition-opacity"
                  uid={groupName || "group"}
                />
              </div>
              <div className="flex-1 p-0.5">
                <Input
                  className="bg-wa-header border border-wa-border rounded-lg text-xs sm:text-sm py-2 font-medium focus:ring-1 focus:ring-wa-primary"
                  type="text"
                  placeholder={t("sidebar.group_subject_placeholder")}
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                />
                <span className="text-[10px] text-wa-muted block mt-1">
                  {t("sidebar.click_placeholder_desc")}
                </span>
              </div>
            </div>

            <div className="text-xs font-medium text-wa-muted mb-1.5">
              {t("sidebar.select_participants")}
            </div>

            <div 
              className="flex-1 overflow-y-auto border border-wa-border rounded-md p-1.5 mb-3 bg-wa-sidebar"
              onScroll={(e) => {
                const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
                if (scrollHeight - scrollTop - clientHeight < 20) {
                  onLoadMore();
                }
              }}
            >
              {searchResults.length > 0 ? (
                <>
                  {searchResults.map((profile) => {
                    const isSelected = selectedMembers.includes(profile.id);
                    return (
                      <div
                        key={profile.id}
                        onClick={() => toggleMemberSelection(profile.id)}
                        className={cn(
                          "flex items-center gap-2 p-1.5 rounded hover:bg-wa-hover cursor-pointer transition-colors select-none",
                          isSelected && "bg-wa-active",
                        )}
                      >
                        <div
                          className={cn(
                            "flex items-center justify-center h-4 w-4 rounded border transition-colors shrink-0",
                            isSelected
                              ? "bg-wa-primary border-wa-primary text-white"
                              : "border-wa-muted",
                          )}
                        >
                          {isSelected && (
                            <Check className="h-3 w-3 stroke-[3]" />
                          )}
                        </div>
                        <Avatar
                          src={profile.avatar}
                          fallback={profile.name[0]}
                          size="sm"
                          uid={profile.id}
                        />
                        <span className="text-xs text-wa-text truncate flex-1">
                          {profile.name}
                        </span>
                      </div>
                    );
                  })}
                  {isSearchingMore && (
                    <div className="py-2.5 flex items-center justify-center gap-2 text-xs text-wa-muted animate-pulse border-t border-wa-border/10 mt-1.5">
                      <Loader2 className="h-4.5 w-4.5 animate-spin text-wa-primary" />
                      <span>{t("common.loading") || "Loading more..."}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-8 text-center text-xs text-wa-muted">
                  {t("sidebar.no_peers_desc")}
                </div>
              )}
            </div>

            <Button
              onClick={handleCreateGroup}
              disabled={!groupName.trim()}
              className="w-full"
              variant="default"
            >
              {t("sidebar.create_group_with_count", { count: selectedMembers.length })}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
