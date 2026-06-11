"use client";

import React, { useState, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../../hooks/useRedux";
import { useTranslation } from "../../hooks/useTranslation";
import { Search, X, UserMinus, UserPlus, ArrowLeft, Loader2, ChevronRight } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { blockService } from "../../services/blockService";
import { profileService } from "../../services/profileService";
import { addBlockedUser, removeBlockedUser } from "../../redux/slices/chatSlice";

export function PrivacySection({ user }) {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const blockedIds = useAppSelector((state) => state.chat.blockedUsers || []);

  const [privacySubView, setPrivacySubView] = useState("main"); // 'main' | 'blocked' | 'blocked-add'
  const [blockedProfiles, setBlockedProfiles] = useState([]);
  const [isLoadingBlocked, setIsLoadingBlocked] = useState(false);
  const [blockedSearchQuery, setBlockedSearchQuery] = useState("");
  const [directorySearchQuery, setDirectorySearchQuery] = useState("");
  const [directorySearchResults, setDirectorySearchResults] = useState([]);
  const [isSearchingDirectory, setIsSearchingDirectory] = useState(false);
  const [isActionPending, setIsActionPending] = useState(null);

  // Mock Privacy options
  const [privacyReadReceipts, setPrivacyReadReceipts] = useState(true);
  const [privacyLastSeen, setPrivacyLastSeen] = useState("contacts");
  const [privacyPhoto, setPrivacyPhoto] = useState("everyone");
  const [privacyAbout, setPrivacyAbout] = useState("everyone");

  useEffect(() => {
    const fetchBlocked = async () => {
      if (!user?.id || privacySubView === "main") return;
      setIsLoadingBlocked(true);
      try {
        const list = await blockService.getBlockedUsers(user.id);
        setBlockedProfiles(list || []);
      } catch (err) {
        console.warn("Failed fetching blocked profiles:", err);
      } finally {
        setIsLoadingBlocked(false);
      }
    };
    fetchBlocked();
  }, [privacySubView, user?.id]);

  useEffect(() => {
    if (privacySubView !== "blocked-add" || !user?.id) return;
    const timer = setTimeout(async () => {
      setIsSearchingDirectory(true);
      try {
        const results = await profileService.searchProfiles(directorySearchQuery, user.id, 0, 15);
        const filtered = results.filter((p) => !blockedIds.includes(p.id));
        setDirectorySearchResults(filtered);
      } catch (err) {
        console.warn("Directory search failed:", err);
      } finally {
        setIsSearchingDirectory(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [directorySearchQuery, privacySubView, user?.id, blockedIds]);

  const handleUnblock = async (targetUserId) => {
    if (!user?.id) return;
    setIsActionPending(targetUserId);
    try {
      await blockService.unblockUser(user.id, targetUserId);
      dispatch(removeBlockedUser(targetUserId));
      setBlockedProfiles((prev) => prev.filter((p) => p.id !== targetUserId));
    } catch (err) {
      console.error(err);
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
      setPrivacySubView("blocked");
      setDirectorySearchQuery("");
    } catch (err) {
      console.error(err);
    } finally {
      setIsActionPending(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {privacySubView === "main" ? (
        <div className="bg-wa-sidebar p-5 border border-wa-border/50 rounded-2xl space-y-6">
          <span className="text-[10px] text-wa-primary font-bold uppercase tracking-wider block">
            {t("settings.privacy_safeguards") || "Privacy Safeguards"}
          </span>
          
          <div className="flex items-center justify-between py-2 border-b border-wa-border/20">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-wa-text">{t("settings.read_receipts") || "Read Receipts"}</span>
              <span className="text-xs text-wa-muted">
                {t("settings.read_receipts_desc") || "If turned off, you won't send or receive Read receipts. Read receipts are always sent for group chats."}
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={privacyReadReceipts}
                onChange={(e) => setPrivacyReadReceipts(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-wa-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-wa-muted peer-checked:after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-wa-primary"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-wa-border/20">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-wa-text">{t("chat.last_seen") || "Last Seen"}</span>
              <span className="text-xs text-wa-muted">
                {t("settings.last_seen_desc") || "Choose who can see when you were last active."}
              </span>
            </div>
            <select
              value={privacyLastSeen}
              onChange={(e) => setPrivacyLastSeen(e.target.value)}
              className="h-9 px-3 bg-wa-header border border-wa-border text-wa-text rounded-xl text-xs focus:outline-none cursor-pointer font-semibold"
            >
              <option value="everyone">{t("settings.everyone") || "Everyone"}</option>
              <option value="contacts">{t("settings.my_contacts") || "My Contacts"}</option>
              <option value="nobody">{t("settings.nobody") || "Nobody"}</option>
            </select>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-wa-border/20">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-wa-text">{t("sidebar.profile_info") || "Profile Photo"}</span>
              <span className="text-xs text-wa-muted">
                {t("settings.profile_photo_desc") || "Choose who can view your profile picture."}
              </span>
            </div>
            <select
              value={privacyPhoto}
              onChange={(e) => setPrivacyPhoto(e.target.value)}
              className="h-9 px-3 bg-wa-header border border-wa-border text-wa-text rounded-xl text-xs focus:outline-none cursor-pointer font-semibold"
            >
              <option value="everyone">{t("settings.everyone") || "Everyone"}</option>
              <option value="contacts">{t("settings.my_contacts") || "My Contacts"}</option>
              <option value="nobody">{t("settings.nobody") || "Nobody"}</option>
            </select>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-wa-border/20">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-wa-text">{t("sidebar.about") || "About"}</span>
              <span className="text-xs text-wa-muted">
                {t("settings.about_desc") || "Choose who can view your About description status."}
              </span>
            </div>
            <select
              value={privacyAbout}
              onChange={(e) => setPrivacyAbout(e.target.value)}
              className="h-9 px-3 bg-wa-header border border-wa-border text-wa-text rounded-xl text-xs focus:outline-none cursor-pointer font-semibold"
            >
              <option value="everyone">{t("settings.everyone") || "Everyone"}</option>
              <option value="contacts">{t("settings.my_contacts") || "My Contacts"}</option>
              <option value="nobody">{t("settings.nobody") || "Nobody"}</option>
            </select>
          </div>

          <button
            onClick={() => setPrivacySubView("blocked")}
            className="w-full flex items-center justify-between py-2 cursor-pointer text-left hover:text-wa-primary group"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-wa-text group-hover:text-wa-primary transition-colors">
                {t("sidebar.blocked_users") || "Blocked Contacts"}
              </span>
              <span className="text-xs text-wa-muted">
                {blockedIds.length} {t("sidebar.blocked_users").toLowerCase() || "contacts blocked"}
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-wa-muted/40 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      ) : privacySubView === "blocked" ? (
        <div className="bg-wa-sidebar p-5 border border-wa-border/50 rounded-2xl space-y-4">
          <div className="flex items-center gap-3.5 mb-2 shrink-0">
            <button
              onClick={() => setPrivacySubView("main")}
              className="p-1 rounded-full hover:bg-wa-hover transition-colors text-wa-muted hover:text-wa-text cursor-pointer"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="text-sm font-bold text-wa-text">{t("sidebar.blocked_users") || "Blocked Contacts"}</span>
          </div>

          <div className="relative mb-3 p-0.5">
            <Input
              type="text"
              placeholder={t("settings.search_blocked") || "Search blocked contacts..."}
              value={blockedSearchQuery}
              onChange={(e) => setBlockedSearchQuery(e.target.value)}
              className="pl-9 bg-wa-header border border-wa-border rounded-xl text-xs sm:text-sm py-2"
            />
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-wa-muted" />
            {blockedSearchQuery && (
              <button onClick={() => setBlockedSearchQuery("")} className="absolute right-3.5 top-3.5 text-wa-muted">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-2">
            {isLoadingBlocked ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-wa-muted animate-pulse">
                <Loader2 className="h-5 w-5 animate-spin text-wa-primary" />
                <span>{t("common.loading") || "Loading..."}</span>
              </div>
            ) : blockedProfiles.filter(p => p.name.toLowerCase().includes(blockedSearchQuery.toLowerCase())).length > 0 ? (
              blockedProfiles
                .filter(p => p.name.toLowerCase().includes(blockedSearchQuery.toLowerCase()))
                .map((profile) => (
                  <div key={profile.id} className="flex items-center justify-between p-2.5 rounded-xl bg-wa-header/20 border border-wa-border/30 hover:bg-wa-hover/40 transition-all">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar src={profile.avatar} fallback={profile.name[0]} size="md" uid={profile.id} />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs sm:text-sm font-semibold text-wa-text truncate">{profile.name}</span>
                        <span className="text-[10px] text-wa-muted truncate">{profile.email}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnblock(profile.id)}
                      disabled={isActionPending === profile.id}
                      className="p-2 text-wa-primary hover:text-red-500 rounded-xl hover:bg-red-500/10 cursor-pointer flex items-center justify-center"
                      title={t("chat.unblock_contact") || "Unblock"}
                    >
                      {isActionPending === profile.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
                    </button>
                  </div>
                ))
            ) : (
              <div className="py-12 text-center text-xs text-wa-muted italic">
                {t("settings.no_blocked_found") || "No blocked contacts found."}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-wa-border mt-3">
            <Button
              onClick={() => {
                setPrivacySubView("blocked-add");
                setDirectorySearchQuery("");
              }}
              className="w-full flex items-center justify-center gap-2 rounded-xl text-xs sm:text-sm py-2 cursor-pointer"
              variant="default"
            >
              <UserPlus className="h-4 w-4" />
              <span>{t("settings.block_contact") || "Block a Contact"}</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-wa-sidebar p-5 border border-wa-border/50 rounded-2xl space-y-4">
          <div className="flex items-center gap-3.5 mb-2 shrink-0">
            <button
              onClick={() => setPrivacySubView("blocked")}
              className="p-1 rounded-full hover:bg-wa-hover transition-colors text-wa-muted hover:text-wa-text cursor-pointer"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="text-sm font-bold text-wa-text">
              {t("settings.select_contact_block") || "Select contact to block"}
            </span>
          </div>

          <div className="relative mb-3 p-0.5">
            <Input
              type="text"
              placeholder={t("sidebar.search_profiles") || "Search profiles..."}
              value={directorySearchQuery}
              onChange={(e) => setDirectorySearchQuery(e.target.value)}
              className="pl-9 bg-wa-header border border-wa-border rounded-xl text-xs sm:text-sm py-2"
              autoFocus
            />
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-wa-muted" />
            {directorySearchQuery && (
              <button onClick={() => setDirectorySearchQuery("")} className="absolute right-3.5 top-3.5 text-wa-muted">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-2">
            {isSearchingDirectory ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-wa-muted animate-pulse">
                <Loader2 className="h-5 w-5 animate-spin text-wa-primary" />
                <span>{t("common.loading") || "Searching..."}</span>
              </div>
            ) : directorySearchResults.length > 0 ? (
              directorySearchResults.map((profile) => (
                <div
                  key={profile.id}
                  onClick={() => handleBlock(profile)}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-transparent hover:bg-wa-hover hover:border-wa-border/30 cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar src={profile.avatar} fallback={profile.name[0]} size="md" uid={profile.id} />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs sm:text-sm font-semibold text-wa-text truncate">{profile.name}</span>
                      <span className="text-[10px] text-wa-muted truncate">{profile.email}</span>
                    </div>
                  </div>
                  <div className="p-2 text-red-500 rounded-xl hover:bg-red-500/10 shrink-0">
                    {isActionPending === profile.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-xs text-wa-muted italic">
                {t("sidebar.no_profiles_found") || "No profiles found. Type above to search."}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
