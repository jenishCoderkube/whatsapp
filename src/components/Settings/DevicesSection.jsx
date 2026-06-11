"use client";

import React, { useState, useEffect } from "react";
import { Laptop, Smartphone, Monitor, Clock, ShieldAlert } from "lucide-react";
import { useTranslation } from "../../hooks/useTranslation";
import { cn } from "../../utils/cn";
import { authService } from "../../services/authService";
import { logout } from "../../redux/slices/authSlice";
import { resetChats } from "../../redux/slices/chatSlice";
import { resetMessages } from "../../redux/slices/messageSlice";
import { useAppDispatch } from "../../hooks/useRedux";
import { Modal } from "../ui/Modal";

export function DevicesSection({ user }) {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const [activeDevices, setActiveDevices] = useState([]);
  const [currentDeviceId, setCurrentDeviceId] = useState("");
  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null,
  });

  useEffect(() => {
    if (!user?.id) return;
    let isSubscribed = true;
    let cleanupSession = null;

    const loadSessions = async () => {
      try {
        const { sessionService } = await import("../../services/sessionService");
        
        const handleLocalLogout = async () => {
          if (!isSubscribed) return;
          try {
            await authService.logout();
          } catch (e) {
            console.warn("Auto logout failed:", e);
          }
          dispatch(logout());
          dispatch(resetChats());
          dispatch(resetMessages());
          try {
            await authService.clearLocalSessionData();
          } catch (e) {}
          window.location.href = "/login";
        };

        const handleListUpdated = (devices) => {
          if (!isSubscribed) return;
          const localId = localStorage.getItem("wa_device_id");
          const formatted = devices.map((d) => ({
            id: d.id,
            name: d.name,
            active: d.id === localId,
            desc:
              d.id === localId
                ? t("sidebar.active") || "Active"
                : `Last active: ${new Date(d.lastActive).toLocaleString()} (Logged in: ${new Date(d.loginTime).toLocaleString()})`,
            isBrowser: d.isBrowser,
            loginTime: d.loginTime,
            lastActive: d.lastActive,
            platform: d.platform,
            browser: d.browser,
          }));
          setActiveDevices(formatted);
        };

        const { currentDeviceId: myId, activeDevices: list, loggedOut } = await sessionService.registerCurrentDevice(
          user.id,
          handleLocalLogout,
          handleListUpdated
        );

        if (loggedOut) return;

        if (isSubscribed) {
          setCurrentDeviceId(myId);
          handleListUpdated(list);
        }
        cleanupSession = sessionService;
      } catch (err) {
        console.error("Failed to initialize active sessions in DevicesSection:", err);
      }
    };

    loadSessions();

    return () => {
      isSubscribed = false;
      if (cleanupSession) cleanupSession.unsubscribe();
    };
  }, [user?.id, dispatch, t]);

  const handleLogoutDevice = (dev) => {
    const isCurrent = dev.id === currentDeviceId;
    const confirmMsg = isCurrent
      ? t("sidebar.logout_device_confirm")
      : t("sidebar.logout_other_device_confirm", { device: dev.name }) ||
        `Are you sure you want to log out ${dev.name}?`;

    setConfirmConfig({
      isOpen: true,
      title: t("sidebar.logout") || "Log Out",
      message: confirmMsg,
      onConfirm: async () => {
        try {
          const { sessionService } = await import("../../services/sessionService");
          if (isCurrent) {
            await authService.logout();
            dispatch(logout());
            dispatch(resetChats());
            dispatch(resetMessages());
            try {
              await authService.clearLocalSessionData();
            } catch (e) {}
            window.location.href = "/login";
          } else {
            await sessionService.logoutDevice(user.id, dev.id);
            setActiveDevices((prev) => prev.filter((d) => d.id !== dev.id));
          }
        } catch (e) {
          console.warn("Logout device failed:", e);
        }
      }
    });
  };

  const handleLogoutAllDevices = () => {
    setConfirmConfig({
      isOpen: true,
      title: t("sidebar.logout") || "Log Out",
      message: t("sidebar.logout_all_devices_confirm") || "Are you sure you want to log out all other devices?",
      onConfirm: async () => {
        try {
          const { sessionService } = await import("../../services/sessionService");
          await sessionService.logoutAllOtherDevices(user.id, currentDeviceId);
          setActiveDevices((prev) => prev.filter((d) => d.active));
        } catch (e) {
          console.warn("Logout other devices failed:", e);
        }
      }
    });
  };

  const handleLogoutAllIncludingCurrent = () => {
    setConfirmConfig({
      isOpen: true,
      title: t("sidebar.logout") || "Log Out",
      message: t("sidebar.logout_all_confirm") || "Are you sure you want to log out all devices, including this one?",
      onConfirm: async () => {
        try {
          const { sessionService } = await import("../../services/sessionService");
          await sessionService.logoutAllDevices(user.id);
          await authService.logoutAllDevices();
        } catch (e) {
          console.warn(
            "Global signout request had error, forcing local cleanup:",
            e,
          );
        }
        dispatch(logout());
        dispatch(resetChats());
        dispatch(resetMessages());
        try {
          await authService.clearLocalSessionData();
        } catch (e) {}
        window.location.href = "/login";
      }
    });
  };

  const getDeviceIcon = (dev) => {
    const iconClass = "h-4.5 w-4.5 stroke-[1.75]";
    if (!dev.isBrowser) return <Smartphone className={iconClass} />;
    
    const platformLower = (dev.platform || "").toLowerCase();
    if (platformLower.includes("mac") || platformLower.includes("windows") || platformLower.includes("linux")) {
      return <Laptop className={iconClass} />;
    }
    return <Monitor className={iconClass} />;
  };

  const renderDeviceCard = (dev, isCurrent = false) => {
    return (
      <div
        key={dev.id}
        className={cn(
          "flex items-center justify-between gap-3 p-3.5 rounded-xl border transition-all duration-300 w-full relative overflow-hidden group select-none",
          isCurrent
            ? "bg-wa-primary/10 border-wa-primary/30 shadow-[0_0_15px_rgba(0,168,132,0.02)]"
            : "bg-wa-header/50 border-wa-border/40 hover:bg-wa-header hover:border-wa-border/80"
        )}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="relative shrink-0">
            <div className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center border transition-all duration-300 group-hover:scale-105",
              isCurrent
                ? "bg-wa-primary/15 text-wa-primary border-wa-primary/20"
                : "bg-wa-active/50 text-wa-muted border-wa-border/40"
            )}>
              {getDeviceIcon(dev)}
            </div>
            {isCurrent && (
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-wa-modal border border-wa-modal">
                <span className="h-1.5 w-1.5 rounded-full bg-wa-online animate-pulse" />
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-wa-text flex items-center gap-1.5 flex-wrap">
              <span className="truncate max-w-[140px] sm:max-w-[180px]">
                {dev.name || `${dev.browser} (${dev.platform})`}
              </span>
              {isCurrent && (
                <span className="px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-500 text-[9px] font-bold uppercase tracking-wide">
                  {t("sidebar.active")}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-0.5 mt-1 text-[10px] text-wa-muted/80">
              <div className="flex items-center gap-1">
                <span>{dev.platform || "Unknown OS"}</span>
                <span>•</span>
                <span>{dev.browser || "Browser"}</span>
              </div>
              <div className="flex items-center gap-1 mt-0.5 text-[9px] text-wa-muted/60">
                <Clock className="h-2.5 w-2.5 shrink-0" />
                <span>
                  {isCurrent 
                    ? `${t("sidebar.login_time")}: ${new Date(dev.loginTime).toLocaleString()}`
                    : `${t("sidebar.last_active")}: ${new Date(dev.lastActive).toLocaleString()}`
                  }
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 flex items-center">
          <button
            onClick={() => handleLogoutDevice(dev)}
            className="flex items-center justify-center p-2 rounded-lg text-red-500 hover:bg-red-500/5 hover:text-red-600 transition-all border border-transparent hover:border-red-500/10 cursor-pointer outline-none"
            title={t("sidebar.logout")}
          >
            {/* LogOut Icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  const currentDevice = activeDevices.find((dev) => dev.active);
  const otherDevices = activeDevices.filter((dev) => !dev.active);

  return (
    <div className="bg-wa-sidebar p-5 border border-wa-border/50 rounded-2xl space-y-6 animate-fade-in">
      <div className="flex flex-col items-center justify-center text-center py-5 px-4 bg-wa-header/20 border border-wa-border/50 rounded-xl w-full mb-2">
        <svg className="w-32 h-16 mb-2 text-wa-primary/70" viewBox="0 0 160 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="20" y="20" width="64" height="38" rx="3" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeWidth="1.5" />
          <rect x="25" y="25" width="54" height="28" rx="1.5" fill="currentColor" fillOpacity="0.04" />
          <path d="M44 58h16l3 6H41l3-6z" fill="currentColor" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
          <rect x="12" y="64" width="80" height="3" rx="1.5" fill="currentColor" />
          <circle cx="102" cy="38" r="2.5" fill="currentColor" className="animate-pulse text-wa-primary" />
          <path d="M108 30a12 12 0 0 1 0 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2.5 2.5" />
          <path d="M114 24a24 24 0 0 1 0 28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 3" />
          <rect x="124" y="14" width="24" height="48" rx="5" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeWidth="1.5" />
          <rect x="127" y="19" width="18" height="38" rx="2" fill="currentColor" fillOpacity="0.04" />
          <circle cx="136" cy="60" r="1" fill="currentColor" />
          <line x1="133" y1="16" x2="139" y2="16" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
        </svg>
        <h4 className="text-xs sm:text-sm font-bold text-wa-text">{t("sidebar.active_login_sessions") || "Active Login Sessions"}</h4>
        <p className="text-[11px] text-wa-muted mt-1 max-w-xs leading-relaxed">
          {t("sidebar.active_login_sessions_desc") || "Your account is currently active on the following instances. You can remotely close any of these active sessions below."}
        </p>
      </div>

      <div className="space-y-4">
        {/* Current Device */}
        <div className="space-y-2">
          <span className="text-[10px] text-wa-primary font-bold uppercase tracking-wider block">{t("sidebar.current_device") || "This Device"}</span>
          {currentDevice ? (
            renderDeviceCard(currentDevice, true)
          ) : (
            <p className="text-xs text-wa-muted italic">Detecting current device session...</p>
          )}
        </div>

        {/* Other Devices */}
        <div className="space-y-2">
          <span className="text-[10px] text-wa-muted font-bold uppercase tracking-wider block">{t("sidebar.other_devices") || "Other Linked Devices"}</span>
          {otherDevices.length > 0 ? (
            <div className="flex flex-col gap-2">
              {otherDevices.map((dev) => renderDeviceCard(dev, false))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-1.5 py-6 px-3 border border-dashed border-wa-border/30 rounded-xl text-center bg-wa-header/5">
              <ShieldAlert className="h-5 w-5 text-wa-muted/40" />
              <p className="text-[11px] text-wa-muted/70 italic">{t("sidebar.no_other_devices") || "No other devices currently logged in"}</p>
            </div>
          )}
        </div>
      </div>

      {/* Reusable Custom Confirmation Modal */}
      <Modal
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
        title={confirmConfig.title}
        className="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-wa-text leading-relaxed">
            {confirmConfig.message}
          </p>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-wa-text bg-wa-header hover:bg-wa-hover transition-colors cursor-pointer border border-wa-border"
            >
              {t("common.cancel") || "Cancel"}
            </button>
            <button
              onClick={() => {
                if (confirmConfig.onConfirm) confirmConfig.onConfirm();
                setConfirmConfig({ ...confirmConfig, isOpen: false });
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors cursor-pointer"
            >
              {confirmConfig.title}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
