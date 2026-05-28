"use client";

import React from "react";
import { Modal } from "../ui/Modal";
import { Avatar } from "../ui/Avatar";
import { Input } from "../ui/Input";
import { Loader2, Upload, Check, X, Edit2 } from "lucide-react";
import { useTranslation } from "../../hooks/useTranslation";

export function ProfileModal({
  isOpen,
  onClose,
  user,
  profileMessage,
  isUpdatingProfile,
  editingName,
  setEditingName,
  tempName,
  setTempName,
  editingStatus,
  setEditingStatus,
  tempStatus,
  setTempStatus,
  handleProfileAvatarSelectChange,
  handleRemoveAvatarImage,
  handleSaveName,
  handleSaveStatus,
  profileFileInputRef,
}) {
  const { t } = useTranslation();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("sidebar.profile_info")}
    >
      <div className="flex flex-col items-center py-2 max-h-[75vh] overflow-y-auto px-2">
        {profileMessage && (
          <div className="w-full mb-3 p-2 rounded text-center text-xs bg-wa-active text-wa-text border border-wa-border animate-fade-in">
            {profileMessage}
          </div>
        )}

        {/* Hidden Avatar Uploader element */}
        <input
          type="file"
          ref={profileFileInputRef}
          onChange={handleProfileAvatarSelectChange}
          accept="image/*"
          className="hidden"
        />

        {/* Realtime Interactive Profile photo block */}
        <div className="relative group cursor-pointer my-2 block rounded-full">
          <Avatar
            src={user?.avatar}
            fallback={user?.name?.[0] || "U"}
            size="xxl"
            className="shadow-md ring-2 ring-wa-border"
            uid={user?.id}
          />
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

        <div className="flex items-center gap-2 mt-1 mb-4 text-xs">
          <button
            onClick={() => profileFileInputRef.current?.click()}
            disabled={isUpdatingProfile}
            className="text-wa-primary font-medium hover:underline block cursor-pointer"
          >
            {t("sidebar.upload_image")}
          </button>
          <span className="text-wa-muted">•</span>
          <button
            onClick={handleRemoveAvatarImage}
            disabled={isUpdatingProfile}
            className="text-red-500 font-medium hover:underline block cursor-pointer"
          >
            {t("common.remove")}
          </button>
        </div>

        {/* Fully Interactive Edit Fields mapping */}
        <div className="w-full pt-3 border-t border-wa-border flex flex-col gap-4 text-left">
          {/* Username Section */}
          <div className="flex flex-col gap-1">
            <div className="text-[11px] text-wa-primary font-medium uppercase tracking-wider px-1">
              {t("sidebar.your_name")}
            </div>
            {editingName ? (
              <div className="flex items-center gap-1">
                <Input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  className="h-8 text-xs flex-1"
                  placeholder={t("sidebar.your_name")}
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  disabled={isUpdatingProfile || !tempName.trim()}
                  className="p-1.5 rounded bg-wa-primary text-white hover:opacity-90 block cursor-pointer"
                  title={t("common.save")}
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    setTempName(user?.name || "");
                    setEditingName(false);
                  }}
                  disabled={isUpdatingProfile}
                  className="p-1.5 rounded bg-wa-active text-wa-muted hover:text-wa-text block cursor-pointer"
                  title={t("common.cancel")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-wa-header px-3 py-2 rounded-md group">
                <span className="text-xs sm:text-sm font-medium text-wa-text truncate">
                  {user?.name}
                </span>
                <button
                  onClick={() => setEditingName(true)}
                  className="text-wa-muted hover:text-wa-primary transition-colors block cursor-pointer"
                  title={t("sidebar.edit_name") || "Edit name"}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <span className="text-[10px] text-wa-muted px-1 block">
              {t("sidebar.name_disclaimer")}
            </span>
          </div>

          {/* About description Section */}
          <div className="flex flex-col gap-1">
            <div className="text-[11px] text-wa-primary font-medium uppercase tracking-wider px-1">
              {t("sidebar.about")}
            </div>
            {editingStatus ? (
              <div className="flex items-center gap-1">
                <Input
                  type="text"
                  value={tempStatus}
                  onChange={(e) => setTempStatus(e.target.value)}
                  className="h-8 text-xs flex-1"
                  placeholder={t("status.type_status")}
                  autoFocus
                />
                <button
                  onClick={handleSaveStatus}
                  disabled={isUpdatingProfile || !tempStatus.trim()}
                  className="p-1.5 rounded bg-wa-primary text-white hover:opacity-90 block cursor-pointer"
                  title={t("common.save")}
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    setTempStatus(user?.status || "Available");
                    setEditingStatus(false);
                  }}
                  disabled={isUpdatingProfile}
                  className="p-1.5 rounded bg-wa-active text-wa-muted hover:text-wa-text block cursor-pointer"
                  title={t("common.cancel")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-wa-header px-3 py-2 rounded-md group">
                <span className="text-xs sm:text-sm text-wa-text truncate">
                  {user?.status || t("sidebar.available") || "Available"}
                </span>
                <button
                  onClick={() => setEditingStatus(true)}
                  className="text-wa-muted hover:text-wa-primary transition-colors block cursor-pointer"
                  title={t("sidebar.edit_about") || "Edit about"}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
