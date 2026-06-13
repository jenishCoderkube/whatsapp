"use client";

import React, { useState } from "react";
import { useAppDispatch, useAppSelector } from "../../hooks/useRedux";
import { useTranslation } from "../../hooks/useTranslation";
import {
  User,
  Shield,
  MessageSquare,
  Bell,
  Key,
  Laptop,
  Globe,
  ShieldAlert,
  ArrowLeft,
  ChevronRight,
  LogOut
} from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Modal } from "../ui/Modal";
import { cn } from "../../utils/cn";
import { setSettingsViewOpen } from "../../redux/slices/uiSlice";
import { authService } from "../../services/authService";
import { logout } from "../../redux/slices/authSlice";
import { resetChats } from "../../redux/slices/chatSlice";
import { resetMessages } from "../../redux/slices/messageSlice";
import { realtimeService } from "../../services/realtimeService";

// Small Subcomponents Imports
import { ProfileSection } from "./ProfileSection";
import { PrivacySection } from "./PrivacySection";
import { ChatsSection } from "./ChatsSection";
import { NotificationsSection } from "./NotificationsSection";
import { LockSection } from "./LockSection";
import { DevicesSection } from "./DevicesSection";
import { LanguageSection } from "./LanguageSection";
import { SecuritySection } from "./SecuritySection";

export function SettingsPanel() {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  // Redux Selectors
  const settingsViewOpen = useAppSelector((state) => state.ui.settingsViewOpen);
  console.log("SettingsPanel settingsViewOpen value:", settingsViewOpen);
  const user = useAppSelector((state) => state.auth.user);
  const activeChatId = useAppSelector((state) => state.chat.activeChatId);

  // Component State
  const [activeCategory, setActiveCategory] = useState("profile"); // 'profile' | 'privacy' | 'chats' | 'notifications' | 'lock' | 'devices' | 'language' | 'security'
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const executeLogout = async () => {
    try {
      // 1. Terminate Supabase session and update online status to false
      await authService.logout();

      // 2. Clear all Redux slices to prevent stale data upon next login or refresh
      dispatch(logout());
      dispatch(resetChats());
      dispatch(resetMessages());

      // 3. Absolute cleanup of real-time listeners
      realtimeService.disconnectGlobalPresence();
      realtimeService.disconnectGlobalMessages();

      // 4. Clear all potential sensitive cached items manually
      await authService.clearLocalSessionData();
      
      // Close the settings panel
      dispatch(setSettingsViewOpen(false));
      
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout error:", error);
      dispatch(logout());
      dispatch(resetChats());
      dispatch(resetMessages());
      try {
        await authService.clearLocalSessionData();
      } catch (e) {}
      dispatch(setSettingsViewOpen(false));
      window.location.href = "/login";
    }
  };

  if (!settingsViewOpen) return null;

  const sidebarCategories = [
    { id: "profile", label: t("sidebar.profile_info") || "Profile", icon: User },
    { id: "privacy", label: t("status.status_privacy_settings") || "Privacy", icon: Shield },
    { id: "chats", label: t("sidebar.chat_wallpaper") || "Chats", icon: MessageSquare },
    { id: "notifications", label: t("settings.notifications_settings") || "Notifications", icon: Bell },
    { id: "lock", label: t("sidebar.screen_lock_settings") || "Screen Lock", icon: Key },
    { id: "devices", label: t("sidebar.linked_devices") || "Linked Devices", icon: Laptop },
    { id: "language", label: t("sidebar.language_settings") || "Language", icon: Globe },
    { id: "security", label: t("settings.security_info") || "Security", icon: ShieldAlert }
  ];

  // Render detail pane corresponding to selected category
  const renderDetailPane = () => {
    switch (activeCategory) {
      case "profile":
        return <ProfileSection user={user} />;
      case "privacy":
        return <PrivacySection user={user} />;
      case "chats":
        return <ChatsSection user={user} activeChatId={activeChatId} />;
      case "notifications":
        return <NotificationsSection />;
      case "lock":
        return <LockSection />;
      case "devices":
        return <DevicesSection user={user} />;
      case "language":
        return <LanguageSection />;
      case "security":
        return <SecuritySection />;
      default:
        return <ProfileSection user={user} />;
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex bg-wa-sidebar text-wa-text select-none transition-colors duration-200">
      <div className="flex h-full w-full max-w-[1600px] mx-auto overflow-hidden">
        
        {/* LEFT PANEL: CATEGORIES SIDEBAR */}
        <aside
          className={cn(
            "h-full w-full md:w-[380px] lg:w-[420px] shrink-0 border-r border-wa-border bg-wa-sidebar flex flex-col transition-colors duration-200",
            activeCategory && "hidden md:flex"
          )}
        >
          {/* Header */}
          <header className="flex items-center gap-6 px-4 py-4.5 bg-wa-primary text-white shrink-0">
            <button
              onClick={() => dispatch(setSettingsViewOpen(false))}
              className="p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
              title="Close Settings"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="font-semibold text-base sm:text-lg">{t("settings.title") || "Settings"}</span>
          </header>

          {/* User Mini Card */}
          <div className="p-4 border-b border-wa-border/40 flex items-center gap-4 bg-wa-header/20">
            <Avatar src={user?.avatar} fallback={user?.name?.[0] || "U"} size="lg" uid={user?.id} />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-wa-text truncate">{user?.name}</h4>
              <p className="text-xs text-wa-muted truncate">{user?.status || "Available"}</p>
            </div>
          </div>

          {/* List of categories */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1 flex flex-col justify-between">
            <div className="space-y-1">
              {sidebarCategories.map((cat) => {
                const IconComponent = cat.icon;
                const isSelected = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={cn(
                      "w-full flex items-center justify-between p-3.5 rounded-xl text-left transition-all hover:bg-wa-hover cursor-pointer group",
                      isSelected && "bg-wa-hover font-semibold"
                    )}
                  >
                    <div className="flex items-center gap-4.5">
                      <div className={cn(
                        "p-2.5 rounded-xl bg-wa-header text-wa-muted group-hover:scale-105 transition-transform shrink-0",
                        isSelected && "bg-wa-primary/10 text-wa-primary"
                      )}>
                        <IconComponent className="h-4.5 w-4.5" />
                      </div>
                      <span className="text-sm font-medium text-wa-text">{cat.label}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-wa-muted/40 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-wa-border/40 mt-4">
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full flex items-center gap-4.5 p-3.5 rounded-xl text-left text-red-500 hover:bg-red-500/5 transition-all cursor-pointer group"
              >
                <div className="p-2.5 rounded-xl bg-red-500/10 text-red-500 group-hover:scale-105 transition-transform shrink-0">
                  <LogOut className="h-4.5 w-4.5" />
                </div>
                <span className="text-sm font-medium">{t("sidebar.logout") || "Log Out"}</span>
              </button>
            </div>
          </div>
        </aside>

        {/* RIGHT PANEL: DETAIL PANE */}
        <main
          className={cn(
            "flex-1 h-full bg-wa-bg flex flex-col min-h-0",
            !activeCategory && "hidden md:flex"
          )}
        >
          {/* Mobile Back Header */}
          <header className="flex items-center gap-4 px-4 py-4 bg-wa-header border-b border-wa-border shrink-0 md:hidden">
            <button
              onClick={() => setActiveCategory(null)}
              className="p-1 rounded-full text-wa-muted hover:bg-wa-hover transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="font-semibold text-sm text-wa-text">
              {sidebarCategories.find((c) => c.id === activeCategory)?.label || t("settings.title") || "Settings"}
            </span>
          </header>

          <div className={cn(
            "flex-1 overflow-y-auto p-4 sm:p-6 w-full mx-auto select-none custom-scrollbar transition-all duration-300",
            activeCategory === "chats" ? "max-w-5xl" : "max-w-4xl"
          )}>
            {renderDetailPane()}
          </div>
        </main>

      </div>

      {/* Custom Logout Confirmation Modal */}
      <Modal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        title={t("sidebar.logout") || "Log Out"}
        className="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-wa-text leading-relaxed">
            {t("sidebar.logout_all_confirm") || "Are you sure you want to log out all devices, including this one?"}
          </p>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setShowLogoutConfirm(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-wa-text bg-wa-header hover:bg-wa-hover transition-colors cursor-pointer border border-wa-border"
            >
              {t("common.cancel") || "Cancel"}
            </button>
            <button
              onClick={executeLogout}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors cursor-pointer"
            >
              {t("sidebar.logout") || "Log Out"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
