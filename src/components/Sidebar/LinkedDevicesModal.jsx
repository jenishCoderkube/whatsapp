"use client";

import React from "react";
import { Modal } from "../ui/Modal";
import { cn } from "../../utils/cn";
import { useTranslation } from "../../hooks/useTranslation";
import { 
  Laptop, 
  Smartphone, 
  Monitor, 
  LogOut, 
  Clock, 
  ShieldAlert
} from "lucide-react";

export function LinkedDevicesModal({
  isOpen,
  onClose,
  activeDevices = [],
  handleLogoutDevice,
  handleLogoutAllDevices,
  handleLogoutAllIncludingCurrent,
}) {
  const { t } = useTranslation();

  const currentDevice = activeDevices.find((dev) => dev.active);
  const otherDevices = activeDevices.filter((dev) => !dev.active);

  const formatDate = (isoString) => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      return date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch (e) {
      return isoString;
    }
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
          {/* Device Icon Circle Wrapper */}
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

          {/* Device metadata details */}
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

            {/* Subtitle specifications & activity */}
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
                    ? `${t("sidebar.login_time")}: ${formatDate(dev.loginTime)}`
                    : `${t("sidebar.last_active")}: ${formatDate(dev.lastActive)}`
                  }
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="shrink-0 flex items-center">
          <button
            onClick={() => handleLogoutDevice(dev)}
            className="flex items-center justify-center p-2 rounded-lg text-red-500 hover:bg-red-500/5 hover:text-red-600 transition-all border border-transparent hover:border-red-500/10 cursor-pointer outline-none"
            title={t("sidebar.logout")}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("sidebar.linked_devices")}
      className="max-w-md w-full rounded-2xl p-5"
    >
      <div className="flex flex-col py-1 max-h-[70vh] overflow-y-auto pr-2 pl-0.5 select-none custom-scrollbar">
        
        {/* Connection Animation Visual Graphic Mockup */}
        <div className="flex flex-col items-center justify-center text-center py-5 px-4 bg-wa-header/20 border border-wa-border/50 rounded-xl w-full mb-5 relative overflow-hidden shrink-0">
          <svg 
            className="w-36 h-18 mb-3 text-wa-primary/80 dark:text-wa-primary/60" 
            viewBox="0 0 160 80" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Laptop Monitor */}
            <rect x="20" y="20" width="64" height="38" rx="3" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="25" y="25" width="54" height="28" rx="1.5" fill="currentColor" fillOpacity="0.04"/>
            {/* Laptop Stand */}
            <path d="M44 58h16l3 6H41l3-6z" fill="currentColor" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
            <rect x="12" y="64" width="80" height="3" rx="1.5" fill="currentColor"/>
            
            {/* Sync Connection Waves */}
            <circle cx="102" cy="38" r="2.5" fill="currentColor" className="animate-pulse text-wa-primary"/>
            <path d="M108 30a12 12 0 0 1 0 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2.5 2.5"/>
            <path d="M114 24a24 24 0 0 1 0 28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 3"/>
            
            {/* Phone */}
            <rect x="124" y="14" width="24" height="48" rx="5" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="127" y="19" width="18" height="38" rx="2" fill="currentColor" fillOpacity="0.04"/>
            <circle cx="136" cy="60" r="1" fill="currentColor"/>
            <line x1="133" y1="16" x2="139" y2="16" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
          </svg>

          <h4 className="text-xs sm:text-sm font-bold text-wa-text">
            {t("sidebar.active_login_sessions")}
          </h4>
          <p className="text-[11px] text-wa-muted mt-1 max-w-xs leading-relaxed">
            {t("sidebar.active_login_sessions_desc")}
          </p>
        </div>

        {/* Current Device Section */}
        <div className="w-full text-left mb-5 shrink-0">
          <span className="text-[10px] text-wa-primary font-bold uppercase tracking-wider block mb-2 px-0.5">
            {t("sidebar.current_device")}
          </span>
          {currentDevice ? (
            renderDeviceCard(currentDevice, true)
          ) : (
            <p className="text-xs text-wa-muted px-0.5 italic">Detecting current device session...</p>
          )}
        </div>

        {/* Other Devices Section */}
        <div className="w-full text-left mb-5">
          <span className="text-[10px] text-wa-muted font-bold uppercase tracking-wider block mb-2 px-0.5">
            {t("sidebar.other_devices")}
          </span>
          {otherDevices.length > 0 ? (
            <div className="flex flex-col gap-2">
              {otherDevices.map((dev) => renderDeviceCard(dev, false))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-1.5 py-6 px-3 border border-dashed border-wa-border/30 rounded-xl text-center bg-wa-header/5">
              <ShieldAlert className="h-6 w-6 text-wa-muted/40 stroke-[1.5]" />
              <p className="text-[11px] text-wa-muted/70 italic font-medium">
                {t("sidebar.no_other_devices")}
              </p>
            </div>
          )}
        </div>

        {/* Bulk Action Buttons */}
        <div className="flex flex-col gap-2 mt-2 shrink-0">
          {otherDevices.length > 0 && (
            <button
              onClick={handleLogoutAllDevices}
              className="w-full py-2.5 rounded-xl border border-red-500/20 hover:border-red-500/30 hover:bg-red-500/5 text-red-500 font-bold text-xs transition-all text-center block outline-none cursor-pointer"
            >
              {t("sidebar.logout_all_other_devices")}
            </button>
          )}

          {activeDevices.length > 0 && (
            <button
              onClick={handleLogoutAllIncludingCurrent}
              className="w-full py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/15 text-red-500 border border-red-500/20 hover:border-red-500/30 font-bold text-xs transition-all text-center block outline-none cursor-pointer"
            >
              {t("sidebar.logout_all_devices")}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
