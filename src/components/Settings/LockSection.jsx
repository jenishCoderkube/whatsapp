"use client";

import React, { useState, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../../hooks/useRedux";
import { useTranslation } from "../../hooks/useTranslation";
import { Shield, Key, Grid, Clock } from "lucide-react";
import { LockScreen } from "../Lock/LockScreen";
import { setAppLockEnabled, setLockConfiguration } from "../../redux/slices/lockSlice";
import { cn } from "../../utils/cn";

export function LockSection() {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const {
    isAppLockEnabled,
    lockType,
    savedPin,
    savedPattern,
    autoLockTimeout
  } = useAppSelector((state) => state.lock);

  const [setupMode, setSetupMode] = useState(null); // null | 'setup_pin' | 'setup_pattern' | 'verify_disable' | 'verify_change'
  const [tempLockType, setTempLockType] = useState(lockType);

  useEffect(() => {
    if (!setupMode && isAppLockEnabled) {
      setTempLockType(lockType);
    }
  }, [setupMode, lockType, isAppLockEnabled]);

  const handleToggleLock = () => {
    if (isAppLockEnabled) {
      setSetupMode("verify_disable");
    } else {
      setSetupMode(tempLockType === "pin" ? "setup_pin" : "setup_pattern");
    }
  };

  const handleSetupSuccess = (code) => {
    if (setupMode === "setup_pin") {
      dispatch(setLockConfiguration({ type: "pin", pin: code }));
      dispatch(setAppLockEnabled(true));
      setSetupMode(null);
    } else if (setupMode === "setup_pattern") {
      dispatch(setLockConfiguration({ type: "pattern", pattern: code }));
      dispatch(setAppLockEnabled(true));
      setSetupMode(null);
    } else if (setupMode === "verify_disable") {
      dispatch(setAppLockEnabled(false));
      setSetupMode(null);
    } else if (setupMode === "verify_change") {
      setSetupMode(tempLockType === "pin" ? "setup_pin" : "setup_pattern");
    }
  };

  const handleLockTypeSelect = (type) => {
    if (isAppLockEnabled && type === lockType) return;
    setTempLockType(type);
    if (isAppLockEnabled) {
      setSetupMode("verify_change");
    }
  };

  if (setupMode) {
    return (
      <div className="bg-wa-sidebar p-5 border border-wa-border/50 rounded-2xl animate-fade-in">
        <LockScreen
          layout="modal"
          mode={setupMode.startsWith("setup") ? "setup" : "unlock"}
          lockType={setupMode.startsWith("setup") ? (setupMode.includes("pin") ? "pin" : "pattern") : lockType}
          savedCode={lockType === "pin" ? savedPin : savedPattern}
          onSuccess={handleSetupSuccess}
          onCancel={() => setSetupMode(null)}
          title={
            setupMode === "verify_disable"
              ? t("lock.verify_to_disable") || "Verify current lock to disable"
              : setupMode === "verify_change"
              ? `Verify current ${lockType === "pin" ? "PIN" : "Pattern"} to switch to ${tempLockType === "pin" ? "PIN" : "Pattern"}`
              : t("lock.setup_new_lock") || "Set up new lock code"
          }
        />
      </div>
    );
  }

  return (
    <div className="bg-wa-sidebar p-5 border border-wa-border/50 rounded-2xl space-y-6 animate-fade-in">
      <span className="text-[10px] text-wa-primary font-bold uppercase tracking-wider block">
        {t("sidebar.screen_lock_settings") || "Screen Lock Configuration"}
      </span>

      <div className="flex items-center justify-between p-4 bg-wa-header/40 border border-wa-border/50 rounded-xl">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-wa-text">{t("lock.enable_screen_lock") || "Enable Screen Lock"}</span>
          <span className="text-xs text-wa-muted">
            {isAppLockEnabled ? t("lock.locked_enabled_desc") || "Require code to enter app" : t("lock.locked_disabled_desc") || "Open app without code"}
          </span>
        </div>
        <label className="relative inline-flex items-center cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isAppLockEnabled}
            onChange={handleToggleLock}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-wa-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-wa-muted peer-checked:after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-wa-primary"></div>
        </label>
      </div>

      <div className="space-y-3">
        <span className="text-xs font-bold text-wa-muted uppercase tracking-wider block">{t("lock.lock_type") || "Lock Type"}</span>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleLockTypeSelect("pin")}
            className={cn(
              "flex flex-col items-center justify-center p-4 border rounded-xl gap-2 transition-all cursor-pointer font-semibold",
              tempLockType === "pin" ? "border-wa-primary bg-wa-primary/5 text-wa-primary" : "border-wa-border hover:bg-wa-hover text-wa-text"
            )}
          >
            <Key className="h-5 w-5" />
            <span className="text-xs">{t("lock.pin_code") || "PIN Code"}</span>
            {lockType === "pin" && isAppLockEnabled && (
              <span className="text-[9px] bg-wa-primary/15 text-wa-primary px-2 py-0.5 rounded-full font-bold">
                {t("lock.active") || "Active"}
              </span>
            )}
          </button>

          <button
            onClick={() => handleLockTypeSelect("pattern")}
            className={cn(
              "flex flex-col items-center justify-center p-4 border rounded-xl gap-2 transition-all cursor-pointer font-semibold",
              tempLockType === "pattern" ? "border-wa-primary bg-wa-primary/5 text-wa-primary" : "border-wa-border hover:bg-wa-hover text-wa-text"
            )}
          >
            <Grid className="h-5 w-5" />
            <span className="text-xs">{t("lock.pattern") || "Pattern"}</span>
            {lockType === "pattern" && isAppLockEnabled && (
              <span className="text-[9px] bg-wa-primary/15 text-wa-primary px-2 py-0.5 rounded-full font-bold">
                {t("lock.active") || "Active"}
              </span>
            )}
          </button>
        </div>
      </div>

      {isAppLockEnabled && (
        <div className="space-y-4 pt-4 border-t border-wa-border">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-wa-muted uppercase tracking-wider block">{t("lock.auto_lock_inactivity") || "Auto-lock Timeout"}</span>
            <select
              value={autoLockTimeout}
              onChange={(e) => dispatch(setLockConfiguration({ timeout: parseInt(e.target.value, 10) }))}
              className="w-full h-10 px-3 border border-wa-border bg-wa-input text-wa-text rounded-xl text-sm focus:outline-none cursor-pointer"
            >
              <option value={0}>{t("lock.timeout_immediately") || "Immediately"}</option>
              <option value={1}>{t("lock.timeout_1_min") || "After 1 minute"}</option>
              <option value={15}>{t("lock.timeout_15_mins") || "After 15 minutes"}</option>
              <option value={60}>{t("lock.timeout_1_hour") || "After 1 hour"}</option>
              <option value={180}>{t("lock.timeout_3_hours") || "After 3 hours"}</option>
            </select>
          </div>

          <button
            onClick={() => setSetupMode("verify_change")}
            className="w-full py-2.5 rounded-xl border border-wa-primary/30 text-wa-primary text-xs font-semibold hover:bg-wa-primary/5 cursor-pointer block"
          >
            {lockType === "pin" ? t("lock.change_pin") || "Change PIN Code" : t("lock.change_pattern") || "Change Pattern"}
          </button>
        </div>
      )}
    </div>
  );
}
