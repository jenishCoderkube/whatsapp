"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Avatar } from "../ui/Avatar";
import { useAppSelector } from "../../hooks/useRedux";
import { profileService } from "../../services/profileService";
import { Check, Search, X } from "lucide-react";
import { useTranslation } from "../../hooks/useTranslation";

export function StatusPrivacyModal({ isOpen, onClose, currentPrivacy, currentPrivacyList = [], onSave }) {
  const { t } = useTranslation();
  const user = useAppSelector((state) => state.auth.user);
  const [privacy, setPrivacy] = useState(currentPrivacy || "contacts");
  const [selectedUsers, setSelectedUsers] = useState(currentPrivacyList || []);
  const [searchQuery, setSearchQuery] = useState("");
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPrivacy(currentPrivacy || "contacts");
      setSelectedUsers(currentPrivacyList || []);
      setSearchQuery("");
      fetchProfiles();
    }
  }, [isOpen, currentPrivacy, currentPrivacyList]);

  const fetchProfiles = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const results = await profileService.searchProfiles("", user.id);
      setProfiles(results);
    } catch (e) {
      console.warn("Failed to fetch profiles for privacy modal:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (val) => {
    setSearchQuery(val);
    if (!user?.id) return;
    try {
      const results = await profileService.searchProfiles(val, user.id);
      setProfiles(results);
    } catch (e) {
      console.warn("Error searching profiles:", e);
    }
  };

  const toggleUserSelection = (userId) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSave = () => {
    onSave({
      privacy,
      privacyList: privacy === "selected" || privacy === "hide" ? selectedUsers : [],
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("status.status_privacy_settings") || "Status privacy settings"}>
      <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto px-1 select-none">
        <div className="text-xs text-wa-muted mb-2">
          {t("status.privacy_desc") || "Who can see your status updates:"}
        </div>

        {/* Option: My Contacts */}
        <label className="flex items-center justify-between p-3 rounded-lg hover:bg-wa-hover cursor-pointer border border-wa-border/50">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-wa-text">{t("status.my_status") || "My contacts"}</span>
            <span className="text-xs text-wa-muted">{t("status.updates_visible_desc") || "All your contacts on WhatsApp"}</span>
          </div>
          <input
            type="radio"
            name="privacy-option"
            checked={privacy === "contacts"}
            onChange={() => setPrivacy("contacts")}
            className="h-4 w-4 accent-wa-primary"
          />
        </label>

        {/* Option: Everyone */}
        <label className="flex items-center justify-between p-3 rounded-lg hover:bg-wa-hover cursor-pointer border border-wa-border/50">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-wa-text">{t("status.everyone") || "Everyone"}</span>
            <span className="text-xs text-wa-muted">{t("status.everyone_desc") || "Any authenticated user"}</span>
          </div>
          <input
            type="radio"
            name="privacy-option"
            checked={privacy === "everyone"}
            onChange={() => setPrivacy("everyone")}
            className="h-4 w-4 accent-wa-primary"
          />
        </label>

        {/* Option: Selected Contacts (whitelist) */}
        <label className="flex items-center justify-between p-3 rounded-lg hover:bg-wa-hover cursor-pointer border border-wa-border/50">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-wa-text">{t("status.only_share_with") || "Only share with..."}</span>
            <span className="text-xs text-wa-muted">{t("status.only_share_with_desc") || "Select specific contacts to share with"}</span>
          </div>
          <input
            type="radio"
            name="privacy-option"
            checked={privacy === "selected"}
            onChange={() => setPrivacy("selected")}
            className="h-4 w-4 accent-wa-primary"
          />
        </label>

        {/* Option: Hide from Specific Contacts (blacklist) */}
        <label className="flex items-center justify-between p-3 rounded-lg hover:bg-wa-hover cursor-pointer border border-wa-border/50">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-wa-text">{t("status.hide_from") || "Hide status from..."}</span>
            <span className="text-xs text-wa-muted">{t("status.hide_from_desc") || "Select contacts to exclude from seeing updates"}</span>
          </div>
          <input
            type="radio"
            name="privacy-option"
            checked={privacy === "hide"}
            onChange={() => setPrivacy("hide")}
            className="h-4 w-4 accent-wa-primary"
          />
        </label>

        {/* User Selection Area for Selected/Hide options */}
        {(privacy === "selected" || privacy === "hide") && (
          <div className="flex flex-col gap-2 mt-2 pt-3 border-t border-wa-border">
            <span className="text-xs font-semibold text-wa-primary uppercase tracking-wider mb-1">
              {privacy === "selected"
                ? (t("status.select_contacts_share") || "Select Contacts to Share With")
                : (t("status.select_contacts_exclude") || "Select Contacts to Exclude")}
            </span>

            {/* Search input */}
            <div className="relative flex items-center mb-2">
              <Search className="absolute left-3 h-4 w-4 text-wa-muted" />
              <Input
                type="text"
                placeholder={t("status.search_contacts") || "Search contacts..."}
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            {/* Profiles list */}
            <div className="flex flex-col gap-1 max-h-[30vh] overflow-y-auto">
              {loading ? (
                <div className="text-center py-4 text-xs text-wa-muted">{t("status.loading_contacts") || "Loading contacts..."}</div>
              ) : profiles.length > 0 ? (
                profiles.map((prof) => {
                  const isSelected = selectedUsers.includes(prof.id);
                  return (
                    <div
                      key={prof.id}
                      onClick={() => toggleUserSelection(prof.id)}
                      className="flex items-center justify-between p-2 rounded hover:bg-wa-hover cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar src={prof.avatar} fallback={prof.name?.[0] || "?"} size="sm" uid={prof.id} />
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-wa-text">{prof.name}</span>
                          <span className="text-[10px] text-wa-muted truncate max-w-[180px]">
                            {prof.email}
                          </span>
                        </div>
                      </div>
                      <div
                        className={`h-4 w-4 rounded flex items-center justify-center border ${
                          isSelected
                            ? "bg-wa-primary border-wa-primary text-white"
                            : "border-wa-border text-transparent"
                        }`}
                      >
                        <Check className="h-3 w-3 stroke-[3]" />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-4 text-xs text-wa-muted">{t("status.no_contacts_found") || "No contacts found"}</div>
              )}
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-wa-border shrink-0">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t("common.cancel") || "Cancel"}
          </Button>
          <Button size="sm" onClick={handleSave}>
            {t("status.save_privacy") || "Save privacy settings"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
