"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAppDispatch } from "../../hooks/useRedux";
import { useTranslation } from "../../hooks/useTranslation";
import { Upload, Check, X, Edit2, Loader2 } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Input } from "../ui/Input";
import { updateProfile } from "../../redux/slices/authSlice";
import { profileService } from "../../services/profileService";
import { storageService } from "../../services/storageService";

export function ProfileSection({ user }) {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const [tempName, setTempName] = useState(user?.name || "");
  const [tempStatus, setTempStatus] = useState(user?.status || "Available");
  const [editingName, setEditingName] = useState(false);
  const [editingStatus, setEditingStatus] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const profileFileInputRef = useRef(null);

  useEffect(() => {
    if (user) {
      setTempName(user.name || "");
      setTempStatus(user.status || "Available");
    }
  }, [user]);

  const handleSaveName = async () => {
    if (!user?.id || !tempName.trim()) return;
    setIsUpdatingProfile(true);
    setProfileMessage("");
    try {
      const updated = await profileService.updateProfileData(user.id, {
        name: tempName.trim()
      });
      if (updated) {
        dispatch(updateProfile({ name: updated.name }));
        setEditingName(false);
        setProfileMessage("Name updated successfully.");
      }
    } catch (err) {
      setProfileMessage("Failed to update name.");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleSaveStatus = async () => {
    if (!user?.id || !tempStatus.trim()) return;
    setIsUpdatingProfile(true);
    setProfileMessage("");
    try {
      const updated = await profileService.updateProfileData(user.id, {
        status: tempStatus.trim()
      });
      if (updated) {
        dispatch(updateProfile({ status: updated.status }));
        setEditingStatus(false);
        setProfileMessage("About updated successfully.");
      }
    } catch (err) {
      setProfileMessage("Failed to update status.");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleProfileAvatarSelectChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    if (file.size > 5 * 1024 * 1024) {
      setProfileMessage("Maximum image size is 5MB.");
      return;
    }
    setIsUpdatingProfile(true);
    setProfileMessage("");
    try {
      const uploadedUrl = await storageService.uploadFile(file, "avatars");
      if (uploadedUrl) {
        const updated = await profileService.updateProfileData(user.id, {
          avatar: uploadedUrl
        });
        if (updated) {
          dispatch(updateProfile({ avatar: updated.avatar }));
          setProfileMessage("Profile photo updated.");
        }
      }
    } catch (err) {
      setProfileMessage("Failed to upload photo.");
    } finally {
      setIsUpdatingProfile(false);
      e.target.value = "";
    }
  };

  const handleRemoveAvatarImage = async () => {
    if (!user?.id) return;
    setIsUpdatingProfile(true);
    setProfileMessage("");
    try {
      const fallbackUrl = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80";
      const updated = await profileService.updateProfileData(user.id, {
        avatar: fallbackUrl
      });
      if (updated) {
        dispatch(updateProfile({ avatar: updated.avatar }));
        setProfileMessage("Profile photo removed.");
      }
    } catch (err) {
      setProfileMessage("Failed to delete photo.");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-wa-sidebar p-5 border border-wa-border/50 rounded-2xl flex flex-col items-center">
        <span className="text-[10px] text-wa-primary font-bold uppercase tracking-wider mb-4">
          {t("sidebar.profile_info") || "Profile Photo"}
        </span>
        
        <input
          type="file"
          ref={profileFileInputRef}
          onChange={handleProfileAvatarSelectChange}
          accept="image/*"
          className="hidden"
        />

        <div className="relative group cursor-pointer my-2 rounded-full">
          <Avatar src={user?.avatar} fallback={user?.name?.[0] || "U"} size="xxl" className="shadow-md ring-2 ring-wa-border" uid={user?.id} />
          <div
            onClick={() => profileFileInputRef.current?.click()}
            className="absolute inset-0 flex flex-col items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity text-white text-center p-2"
          >
            <Upload className="h-5 w-5 mb-1" />
            <span className="text-[10px] leading-tight">{t("sidebar.change_photo")}</span>
          </div>
          {isUpdatingProfile && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-wa-modal/80 backdrop-blur-xs">
              <Loader2 className="h-6 w-6 text-wa-primary animate-spin" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 mt-4 text-xs font-semibold">
          <button
            onClick={() => profileFileInputRef.current?.click()}
            disabled={isUpdatingProfile}
            className="text-wa-primary hover:underline cursor-pointer"
          >
            {t("sidebar.upload_image")}
          </button>
          <span className="text-wa-muted">•</span>
          <button
            onClick={handleRemoveAvatarImage}
            disabled={isUpdatingProfile}
            className="text-red-500 hover:underline cursor-pointer"
          >
            {t("common.remove")}
          </button>
        </div>
      </div>

      <div className="bg-wa-sidebar p-6 border border-wa-border/50 rounded-2xl space-y-6">
        {profileMessage && (
          <div className="p-3 text-center text-xs rounded-xl bg-wa-primary/10 text-wa-primary border border-wa-primary/20">
            {profileMessage}
          </div>
        )}

        <div className="space-y-2">
          <span className="text-[10px] text-wa-primary font-bold uppercase tracking-wider block">
            {t("sidebar.your_name") || "Your Name"}
          </span>
          {editingName ? (
            <div className="flex gap-2">
              <Input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                className="h-9.5 text-xs sm:text-sm flex-1 focus:ring-1 focus:ring-wa-primary"
                autoFocus
              />
              <button
                onClick={handleSaveName}
                disabled={isUpdatingProfile || !tempName.trim()}
                className="px-3 rounded-xl bg-wa-primary text-white hover:opacity-90 flex items-center justify-center cursor-pointer"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setTempName(user?.name || "");
                  setEditingName(false);
                }}
                className="px-3 rounded-xl bg-wa-header text-wa-muted hover:text-wa-text flex items-center justify-center cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 bg-wa-header/30 rounded-xl border border-wa-border/40 group">
              <span className="text-sm font-semibold text-wa-text truncate">{user?.name}</span>
              <button
                onClick={() => setEditingName(true)}
                className="text-wa-muted hover:text-wa-primary transition-colors cursor-pointer"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <p className="text-[10px] text-wa-muted leading-relaxed">
            {t("sidebar.name_disclaimer")}
          </p>
        </div>

        <div className="space-y-2">
          <span className="text-[10px] text-wa-primary font-bold uppercase tracking-wider block">
            {t("sidebar.about") || "About"}
          </span>
          {editingStatus ? (
            <div className="flex gap-2">
              <Input
                type="text"
                value={tempStatus}
                onChange={(e) => setTempStatus(e.target.value)}
                className="h-9.5 text-xs sm:text-sm flex-1 focus:ring-1 focus:ring-wa-primary"
                autoFocus
              />
              <button
                onClick={handleSaveStatus}
                disabled={isUpdatingProfile || !tempStatus.trim()}
                className="px-3 rounded-xl bg-wa-primary text-white hover:opacity-90 flex items-center justify-center cursor-pointer"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setTempStatus(user?.status || "Available");
                  setEditingStatus(false);
                }}
                className="px-3 rounded-xl bg-wa-header text-wa-muted hover:text-wa-text flex items-center justify-center cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 bg-wa-header/30 rounded-xl border border-wa-border/40 group">
              <span className="text-sm font-medium text-wa-text truncate">{user?.status || "Available"}</span>
              <button
                onClick={() => setEditingStatus(true)}
                className="text-wa-muted hover:text-wa-primary transition-colors cursor-pointer"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
