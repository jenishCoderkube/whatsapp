"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { Avatar } from "../ui/Avatar";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { Search, X, UserMinus, UserPlus, ArrowLeft, Loader2 } from "lucide-react";
import { useAppDispatch, useAppSelector } from "../../hooks/useRedux";
import { useTranslation } from "../../hooks/useTranslation";
import { addBlockedUser, removeBlockedUser } from "../../redux/slices/chatSlice";
import { blockService } from "../../services/blockService";
import { profileService } from "../../services/profileService";
import { cn } from "../../utils/cn";

export function BlockedUsersModal({ isOpen, onClose }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const blockedIds = useAppSelector((state) => state.chat.blockedUsers || []);

  const [activeView, setActiveView] = useState("list"); // 'list' | 'add'
  const [blockedProfiles, setBlockedProfiles] = useState([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Add block view states
  const [profileSearchQuery, setProfileSearchQuery] = useState("");
  const [profileSearchResults, setProfileSearchResults] = useState([]);
  const [isSearchingProfiles, setIsSearchingProfiles] = useState(false);
  const [isActionPending, setIsActionPending] = useState(null); // stores user ID of pending block/unblock action

  // Fetch blocked profiles list
  const fetchBlockedProfiles = async () => {
    if (!user?.id) return;
    setIsLoadingList(true);
    try {
      const list = await blockService.getBlockedUsers(user.id);
      setBlockedProfiles(list || []);
    } catch (err) {
      console.warn("Failed fetching blocked profiles:", err);
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchBlockedProfiles();
      setActiveView("list");
      setSearchQuery("");
      setProfileSearchQuery("");
      setProfileSearchResults([]);
    }
  }, [isOpen, user?.id]);

  // Debounced search for profiles to block
  useEffect(() => {
    if (activeView !== "add" || !user?.id) return;
    
    const timer = setTimeout(async () => {
      setIsSearchingProfiles(true);
      try {
        const results = await profileService.searchProfiles(profileSearchQuery, user.id, 0, 15);
        // Exclude profiles that are already blocked
        const filtered = results.filter((p) => !blockedIds.includes(p.id));
        setProfileSearchResults(filtered);
      } catch (err) {
        console.warn("Profile search failed:", err);
      } finally {
        setIsSearchingProfiles(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [profileSearchQuery, activeView, user?.id, blockedIds]);

  const handleUnblock = async (targetUserId) => {
    if (!user?.id) return;
    setIsActionPending(targetUserId);
    try {
      await blockService.unblockUser(user.id, targetUserId);
      dispatch(removeBlockedUser(targetUserId));
      setBlockedProfiles((prev) => prev.filter((p) => p.id !== targetUserId));
    } catch (err) {
      console.error("Unblock failed:", err);
      alert("Failed to unblock user. Please try again.");
    } finally {
      setIsActionPending(null);
    }
  };

  const handleBlock = async (profile) => {
    if (!user?.id) return;
    setIsActionPending(profile.id);
    try {
      await blockService.blockUser(user.id, profile.id);
      dispatch(addBlockedUser(profile.id));
      setBlockedProfiles((prev) => [...prev, profile]);
      setActiveView("list");
      setProfileSearchQuery("");
    } catch (err) {
      console.error("Block failed:", err);
      alert("Failed to block user. Please try again.");
    } finally {
      setIsActionPending(null);
    }
  };

  // Filter blocked users by search query
  const filteredBlockedProfiles = blockedProfiles.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={activeView === "list" ? (t("sidebar.blocked_users") || "Blocked Contacts") : "Block a Contact"}
      className="md:max-w-md w-full"
    >
      <div className="flex flex-col h-[450px] select-none px-4 py-2">
        {activeView === "list" ? (
          // View 1: List of blocked contacts
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Search Input */}
            <div className="relative mb-3.5 p-0.5">
              <Input
                type="text"
                placeholder="Search blocked contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-wa-header border border-wa-border rounded-xl text-xs sm:text-sm py-2 focus:ring-1 focus:ring-wa-primary"
              />
              <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-wa-muted" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3.5 top-3.5 text-wa-muted hover:text-wa-text"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* List area */}
            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
              {isLoadingList ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-wa-muted animate-pulse">
                  <Loader2 className="h-6 w-6 animate-spin text-wa-primary" />
                  <span>Loading blocked contacts...</span>
                </div>
              ) : filteredBlockedProfiles.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  {filteredBlockedProfiles.map((profile) => (
                    <div
                      key={profile.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-wa-header/20 border border-wa-border/30 hover:bg-wa-hover/40 transition-all group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          src={profile.avatar}
                          fallback={profile.name[0]}
                          size="md"
                          uid={profile.id}
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-semibold text-wa-text truncate">
                            {profile.name}
                          </span>
                          <span className="text-[11px] text-wa-muted truncate">
                            {profile.email}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleUnblock(profile.id)}
                        disabled={isActionPending === profile.id}
                        className="p-2 text-wa-primary hover:text-red-500 dark:hover:text-red-400 rounded-xl hover:bg-red-500/10 transition-colors shrink-0 flex items-center justify-center"
                        title="Unblock User"
                      >
                        {isActionPending === profile.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UserMinus className="h-4.5 w-4.5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-16 text-center text-xs text-wa-muted italic">
                  {searchQuery.trim()
                    ? "No blocked contacts match your search."
                    : "No blocked contacts yet."}
                </div>
              )}
            </div>

            {/* Block a contact CTA */}
            <div className="pt-3 border-t border-wa-border mt-3 shrink-0">
              <Button
                onClick={() => setActiveView("add")}
                className="w-full flex items-center justify-center gap-2 rounded-xl text-xs sm:text-sm font-semibold py-2"
                variant="default"
              >
                <UserPlus className="h-4 w-4" />
                <span>Block a Contact</span>
              </Button>
            </div>
          </div>
        ) : (
          // View 2: Add Block (Search all profiles)
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Header back strip */}
            <div className="flex items-center gap-3.5 mb-3.5 shrink-0 select-none">
              <button
                onClick={() => setActiveView("list")}
                className="p-1 rounded-full hover:bg-wa-hover transition-colors text-wa-muted hover:text-wa-text cursor-pointer"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <span className="text-sm font-semibold text-wa-text">Select contact to block</span>
            </div>

            {/* Profile search input */}
            <div className="relative mb-3.5 p-0.5 shrink-0">
              <Input
                type="text"
                placeholder="Search profiles to block..."
                value={profileSearchQuery}
                onChange={(e) => setProfileSearchQuery(e.target.value)}
                className="pl-9 bg-wa-header border border-wa-border rounded-xl text-xs sm:text-sm py-2 focus:ring-1 focus:ring-wa-primary"
                autoFocus
              />
              <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-wa-muted" />
              {profileSearchQuery && (
                <button
                  onClick={() => setProfileSearchQuery("")}
                  className="absolute right-3.5 top-3.5 text-wa-muted hover:text-wa-text"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Results list */}
            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
              {isSearchingProfiles ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-wa-muted animate-pulse">
                  <Loader2 className="h-6 w-6 animate-spin text-wa-primary" />
                  <span>Searching directory...</span>
                </div>
              ) : profileSearchResults.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  {profileSearchResults.map((profile) => (
                    <div
                      key={profile.id}
                      onClick={() => handleBlock(profile)}
                      className={cn(
                        "flex items-center justify-between p-2.5 rounded-xl border border-transparent hover:border-wa-border/30 hover:bg-wa-hover cursor-pointer transition-all group",
                        isActionPending === profile.id && "pointer-events-none opacity-55"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          src={profile.avatar}
                          fallback={profile.name[0]}
                          size="md"
                          uid={profile.id}
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-semibold text-wa-text truncate">
                            {profile.name}
                          </span>
                          <span className="text-[11px] text-wa-muted truncate">
                            {profile.email}
                          </span>
                        </div>
                      </div>

                      <div className="p-2 text-red-500 rounded-xl hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isActionPending === profile.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UserPlus className="h-4.5 w-4.5" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-16 text-center text-xs text-wa-muted italic">
                  {profileSearchQuery.trim()
                    ? "No contacts found matching your search."
                    : "Type above to search contacts to block."}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
