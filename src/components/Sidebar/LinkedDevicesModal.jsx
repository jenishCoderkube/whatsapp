"use client";

import React from "react";
import { Modal } from "../ui/Modal";
import { cn } from "../../utils/cn";
import { useTranslation } from "../../hooks/useTranslation";

export function LinkedDevicesModal({
  isOpen,
  onClose,
  activeDevices = [],
  handleLogoutDevice,
  handleLogoutAllDevices,
}) {
  const { t } = useTranslation();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("sidebar.linked_devices")}
    >
      <div className="flex flex-col items-center py-2 max-h-[75vh] overflow-y-auto px-4 select-none">
        {/* Main Visual Graphic (laptop + phone sync mockup) */}
        <div className="flex flex-col items-center justify-center text-center py-6 px-4 bg-wa-header/20 border border-wa-border/50 rounded-2xl w-full mb-6 relative overflow-hidden">
          <div className="h-16 w-16 rounded-full bg-wa-primary/10 flex items-center justify-center mb-3">
            <svg
              viewBox="0 0 24 24"
              width="32"
              height="32"
              className="fill-wa-primary animate-pulse"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"></path>
            </svg>
          </div>
          <h4 className="text-sm sm:text-base font-semibold text-wa-text">
            {t("sidebar.active_login_sessions")}
          </h4>
          <p className="text-xs text-wa-muted mt-1 max-w-sm leading-relaxed">
            {t("sidebar.active_login_sessions_desc")}
          </p>
        </div>

        {/* Linked Sessions List */}
        <div className="w-full text-left">
          <span className="text-xs text-wa-muted font-bold uppercase tracking-wider block mb-3 px-1">
            {t("sidebar.active_sessions")}
          </span>

          <div className="flex flex-col gap-2.5">
            {activeDevices.map((dev) => (
              <div 
                key={dev.id} 
                className={cn(
                  "flex items-center gap-3.5 p-3 rounded-xl bg-wa-header border border-wa-border/40 transition-all",
                  dev.active ? "border-wa-border/60" : "opacity-75 group hover:opacity-100"
                )}
              >
                <div className="h-10 w-10 rounded-full bg-wa-active flex items-center justify-center shrink-0 text-wa-muted">
                  {dev.isBrowser ? (
                    <svg
                      viewBox="0 0 24 24"
                      width="20"
                      height="20"
                      className="fill-wa-primary"
                    >
                      <path d="M20 4H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-2 12H6V6h12v10z"></path>
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      width="20"
                      height="20"
                      className="fill-wa-muted"
                    >
                      <path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z"></path>
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs sm:text-sm font-semibold text-wa-text flex items-center gap-2">
                    {dev.name}
                    {dev.active && (
                      <>
                        <span className="h-2 w-2 rounded-full bg-green-500 shrink-0 inline-block animate-ping" />
                        <span className="text-[10px] text-green-500 font-bold uppercase tracking-tighter">
                          {t("sidebar.active")}
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-[10px] sm:text-xs text-wa-muted truncate mt-0.5">
                    {dev.desc}
                  </p>
                </div>
                <button
                  onClick={() => handleLogoutDevice(dev)}
                  className="text-[10px] sm:text-xs font-bold text-red-500 hover:underline shrink-0 block outline-none cursor-pointer"
                >
                  {t("sidebar.logout")}
                </button>
              </div>
            ))}

            {activeDevices.length > 0 && (
              <button
                onClick={handleLogoutAllDevices}
                className="w-full mt-4 py-2.5 rounded-xl border border-red-500/30 hover:bg-red-500/10 text-red-500 font-bold text-xs sm:text-sm transition-all text-center block outline-none cursor-pointer"
              >
                {t("sidebar.logout_all_devices")}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
