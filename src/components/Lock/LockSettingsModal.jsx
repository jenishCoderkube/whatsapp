"use client";

import React, { useState, useEffect } from "react";
import { Shield, Key, Grid, Clock, Check, X } from "lucide-react";
import { useAppDispatch, useAppSelector } from "../../hooks/useRedux";
import {
  setAppLockEnabled,
  setLockConfiguration,
} from "../../redux/slices/lockSlice";
import { Modal } from "../ui/Modal";
import { LockScreen } from "./LockScreen";
import { useTranslation } from "../../hooks/useTranslation";

export function LockSettingsModal({ isOpen, onClose }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const {
    isAppLockEnabled,
    lockType,
    savedPin,
    savedPattern,
    autoLockTimeout,
  } = useAppSelector((state) => state.lock);

  const [setupMode, setSetupMode] = useState(null); // null | 'setup_pin' | 'setup_pattern' | 'verify_disable' | 'verify_change'
  const [tempLockType, setTempLockType] = useState(lockType);

  useEffect(() => {
    if (isOpen && !setupMode && isAppLockEnabled) {
      setTempLockType(lockType);
    }
  }, [isOpen, setupMode, lockType, isAppLockEnabled]);

  const getSavedCode = () => {
    return lockType === "pin" ? savedPin : savedPattern;
  };

  const handleToggleLock = () => {
    if (isAppLockEnabled) {
      // Prompt verification to disable
      setSetupMode("verify_disable");
    } else {
      // Start setup flow
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

  const handleTimeoutChange = (e) => {
    const val = parseInt(e.target.value, 10);
    dispatch(setLockConfiguration({ timeout: val }));
  };

  const handleLockTypeSelect = (type) => {
    if (isAppLockEnabled && type === lockType) {
      // If the selected type is already active, ignore the click (prevents redundant verification loops)
      return;
    }
    setTempLockType(type);
    if (isAppLockEnabled) {
      // Changing type requires verifying current lock first
      setSetupMode("verify_change");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setSetupMode(null);
        onClose();
      }}
      title={t("lock.screen_lock_settings") || "Screen Lock Settings"}
      className={setupMode ? "max-w-2xl w-full" : "max-w-md w-full"}
    >
      {setupMode ? (
        <div className="py-2">
          <LockScreen
            layout="modal"
            mode={setupMode.startsWith("setup") ? "setup" : "unlock"}
            lockType={
              setupMode.startsWith("setup")
                ? setupMode.includes("pin")
                  ? "pin"
                  : "pattern"
                : lockType
            }
            savedCode={getSavedCode()}
            onSuccess={handleSetupSuccess}
            onCancel={() => setSetupMode(null)}
            title={
              setupMode === "verify_disable"
                ? t("lock.verify_to_disable") ||
                  "Verify current lock to disable"
                : setupMode === "verify_change"
                  ? `Verify current ${lockType === "pin" ? "PIN" : "Pattern"} to switch to ${tempLockType === "pin" ? "PIN" : "Pattern"}`
                  : setupMode.startsWith("setup")
                    ? t("lock.setup_new_lock") || "Set up new lock code"
                    : ""
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-6 py-2">
          {/* Enable / Disable Section */}
          <div className="flex items-center justify-between p-4 bg-wa-header/40 border border-wa-border/50 rounded-xl">
            <div className="flex items-center gap-3">
              <Shield
                className={`h-5 w-5 ${isAppLockEnabled ? "text-wa-primary" : "text-wa-muted"}`}
              />
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-wa-text">
                  {t("lock.enable_screen_lock") || "Enable Screen Lock"}
                </span>
                <span className="text-xs text-wa-muted">
                  {isAppLockEnabled
                    ? t("lock.locked_enabled_desc") ||
                      "Require code to enter app"
                    : t("lock.locked_disabled_desc") || "Open app without code"}
                </span>
              </div>
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

          {/* Config options (Only visible if enabled, or allows choosing type) */}
          <div className="flex flex-col gap-4">
            <span className="text-xs font-bold text-wa-muted uppercase tracking-wider">
              {t("lock.lock_type") || "Lock Type"}
            </span>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleLockTypeSelect("pin")}
                className={`flex flex-col items-center justify-center p-4 border rounded-xl gap-2 transition-all ${
                  tempLockType === "pin"
                    ? "border-wa-primary bg-wa-primary/5 text-wa-primary"
                    : "border-wa-border hover:bg-wa-hover text-wa-text"
                }`}
              >
                <Key className="h-5 w-5" />
                <span className="text-xs font-semibold">
                  {t("lock.pin_code") || "PIN Code"}
                </span>
                {lockType === "pin" && isAppLockEnabled && (
                  <span className="text-[10px] bg-wa-primary/15 text-wa-primary px-2 py-0.5 rounded-full font-medium">
                    {t("lock.active") || "Active"}
                  </span>
                )}
              </button>

              <button
                onClick={() => handleLockTypeSelect("pattern")}
                className={`flex flex-col items-center justify-center p-4 border rounded-xl gap-2 transition-all ${
                  tempLockType === "pattern"
                    ? "border-wa-primary bg-wa-primary/5 text-wa-primary"
                    : "border-wa-border hover:bg-wa-hover text-wa-text"
                }`}
              >
                <Grid className="h-5 w-5" />
                <span className="text-xs font-semibold">
                  {t("lock.pattern") || "Pattern"}
                </span>
                {lockType === "pattern" && isAppLockEnabled && (
                  <span className="text-[10px] bg-wa-primary/15 text-wa-primary px-2 py-0.5 rounded-full font-medium">
                    {t("lock.active") || "Active"}
                  </span>
                )}
              </button>
            </div>
          </div>

          {isAppLockEnabled && (
            <>
              {/* Timeout Configuration */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-wa-muted uppercase tracking-wider">
                  <Clock className="h-4 w-4 text-wa-muted" />
                  <span>
                    {t("lock.auto_lock_inactivity") || "Auto-lock Timeout"}
                  </span>
                </div>
                <select
                  value={autoLockTimeout}
                  onChange={handleTimeoutChange}
                  className="w-full h-10 px-3 border border-wa-border bg-wa-input text-wa-text rounded-xl text-sm focus:outline-none focus:border-wa-primary transition-colors cursor-pointer"
                >
                  <option value={0}>
                    {t("lock.timeout_immediately") || "Immediately"}
                  </option>
                  <option value={1}>
                    {t("lock.timeout_1_min") || "After 1 minute"}
                  </option>
                  <option value={15}>
                    {t("lock.timeout_15_mins") || "After 15 minutes"}
                  </option>
                  <option value={60}>
                    {t("lock.timeout_1_hour") || "After 1 hour"}
                  </option>
                  <option value={180}>
                    {t("lock.timeout_3_hours") || "After 3 hours"}
                  </option>
                </select>
                <p className="text-[11px] text-wa-muted leading-relaxed mt-1">
                  {t("lock.timeout_desc") ||
                    "Select how long to wait before locking the app automatically when idle."}
                </p>
              </div>

              {/* Change current code button */}
              <button
                onClick={() => setSetupMode("verify_change")}
                className="w-full py-3 border border-wa-primary/30 text-wa-primary text-sm font-semibold rounded-xl hover:bg-wa-primary/5 active:scale-98 transition-all flex items-center justify-center gap-2"
              >
                <Key className="h-4 w-4" />
                <span>
                  {lockType === "pin"
                    ? t("lock.change_pin") || "Change PIN Code"
                    : t("lock.change_pattern") || "Change Pattern"}
                </span>
              </button>
            </>
          )}

          {/* Close / Action footer */}
          <div className="flex justify-end mt-4 pt-4 border-t border-wa-border">
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-xl bg-wa-primary hover:bg-wa-primary-hover text-white text-sm font-semibold shadow-md transition-colors"
            >
              {t("common.close") || "Close"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
