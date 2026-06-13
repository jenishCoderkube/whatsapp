"use client";

import React, { useState, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../../hooks/useRedux";
import { useTranslation } from "../../hooks/useTranslation";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import {
  setWallpaperModal,
  setGlobalWallpaperState,
} from "../../redux/slices/uiSlice";
import { updateChatWallpaper } from "../../redux/slices/chatSlice";
import { wallpaperService } from "../../services/wallpaperService";
import {
  Loader2,
  Sliders,
} from "lucide-react";
import { cn } from "../../utils/cn";

import {
  SOLID_COLORS,
  GRADIENTS,
  GALLERY_PRESETS,
} from "./wallpaper/constants";
import { ColorGrid } from "./wallpaper/ColorGrid";
import { GradientGrid } from "./wallpaper/GradientGrid";
import { GradientDesigner } from "./wallpaper/GradientDesigner";
import { ColorDesigner } from "./wallpaper/ColorDesigner";
import { GalleryGrid } from "./wallpaper/GalleryGrid";
import { UploadZone } from "./wallpaper/UploadZone";
import { WallpaperPreview } from "./wallpaper/WallpaperPreview";

export function WallpaperModal() {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const user = useAppSelector((state) => state.auth.user);
  const chats = useAppSelector((state) => state.chat.chats);

  const isOpen = useAppSelector((state) => state.ui.wallpaperModalOpen);
  const targetChatId = useAppSelector(
    (state) => state.ui.wallpaperTargetChatId,
  );

  const targetChat = chats.find((c) => c.id === targetChatId);

  // Wallpaper settings state
  const [selectedType, setSelectedType] = useState("color"); // 'color' | 'gradient' | 'gallery' | 'upload'
  const [currentVal, setCurrentVal] = useState("");
  const [dimVal, setDimVal] = useState(0);
  const [isApplying, setIsApplying] = useState(false);
  const [applyScope, setApplyScope] = useState("chat");

  const [customGradColor1, setCustomGradColor1] = useState("#ff9a9e");
  const [customGradColor2, setCustomGradColor2] = useState("#fecfef");
  const [customGradAngle, setCustomGradAngle] = useState(135);
  const [isCustomGradActive, setIsCustomGradActive] = useState(false);
  const [isGradModalOpen, setIsGradModalOpen] = useState(false);

  const [customColorVal, setCustomColorVal] = useState("#efeae2");
  const [isCustomColorActive, setIsCustomColorActive] = useState(false);
  const [isColorModalOpen, setIsColorModalOpen] = useState(false);

  // Hydrate modal from current config
  useEffect(() => {
    if (isOpen && user) {
      if (targetChatId) {
        setApplyScope("chat");
        const currentChat = chats.find((c) => c.id === targetChatId);
        const wallpaperStr = currentChat?.wallpaper;
        parseWallpaperString(wallpaperStr);
      } else {
        setApplyScope("global");
        wallpaperService.getGlobalWallpaper(user.id).then((val) => {
          parseWallpaperString(val);
        });
      }
    }
  }, [isOpen, targetChatId, user?.id]);

  const parseWallpaperString = (wallpaperStr) => {
    if (!wallpaperStr) {
      setSelectedType("color");
      setCurrentVal("#efeae2");
      setDimVal(0);
      setIsCustomGradActive(false);
      setIsCustomColorActive(false);
      return;
    }

    try {
      if (wallpaperStr.startsWith("{")) {
        const parsed = JSON.parse(wallpaperStr);
        setSelectedType(parsed.type || "color");
        setCurrentVal(parsed.value || "");
        setDimVal(parsed.dim !== undefined ? parsed.dim : 0);
        
        if (parsed.type === "gradient" && parsed.value.startsWith("linear-gradient")) {
          const match = parsed.value.match(/linear-gradient\((\d+)deg,\s*(#[a-fA-F0-9]+)\s+0%,\s*(#[a-fA-F0-9]+)\s+100%\)/);
          if (match) {
            setCustomGradAngle(Number(match[1]));
            setCustomGradColor1(match[2]);
            setCustomGradColor2(match[3]);
          }
          const isPreset = GRADIENTS.some(g => g.value === parsed.value);
          setIsCustomGradActive(!isPreset);
          setIsCustomColorActive(false);
        } else if (parsed.type === "color") {
          const isPreset = SOLID_COLORS.some(c => c.value.toLowerCase() === parsed.value.toLowerCase());
          setIsCustomColorActive(!isPreset);
          if (!isPreset) {
            setCustomColorVal(parsed.value);
          }
          setIsCustomGradActive(false);
        } else {
          setIsCustomGradActive(false);
          setIsCustomColorActive(false);
        }
      } else {
        setCurrentVal(wallpaperStr);
        setDimVal(0);
        if (
          wallpaperStr.startsWith("linear-gradient") ||
          wallpaperStr.startsWith("radial-gradient")
        ) {
          setSelectedType("gradient");
          setIsCustomColorActive(false);
          if (wallpaperStr.startsWith("linear-gradient")) {
            const match = wallpaperStr.match(/linear-gradient\((\d+)deg,\s*(#[a-fA-F0-9]+)\s+0%,\s*(#[a-fA-F0-9]+)\s+100%\)/);
            if (match) {
              setCustomGradAngle(Number(match[1]));
              setCustomGradColor1(match[2]);
              setCustomGradColor2(match[3]);
            }
            const isPreset = GRADIENTS.some(g => g.value === wallpaperStr);
            setIsCustomGradActive(!isPreset);
          } else {
            setIsCustomGradActive(false);
          }
        } else if (
          wallpaperStr.startsWith("http") ||
          wallpaperStr.startsWith("url(")
        ) {
          setSelectedType("gallery");
          setIsCustomGradActive(false);
          setIsCustomColorActive(false);
        } else {
          setSelectedType("color");
          setIsCustomGradActive(false);
          const isPreset = SOLID_COLORS.some(c => c.value.toLowerCase() === wallpaperStr.toLowerCase());
          setIsCustomColorActive(!isPreset);
          if (!isPreset && wallpaperStr.startsWith("#")) {
            setCustomColorVal(wallpaperStr);
          }
        }
      }
    } catch (e) {
      setCurrentVal(wallpaperStr);
      setSelectedType("color");
      setDimVal(0);
      setIsCustomGradActive(false);
      setIsCustomColorActive(false);
    }
  };

  const serializeWallpaper = (type, value, dim) => {
    return JSON.stringify({ type, value, dim });
  };

  const handleApply = async () => {
    if (!user?.id) return;
    setIsApplying(true);

    const serializedVal = serializeWallpaper(selectedType, currentVal, dimVal);

    try {
      if (applyScope === "global") {
        await wallpaperService.setGlobalWallpaper(user.id, serializedVal);
        dispatch(setGlobalWallpaperState(serializedVal));
      } else if (applyScope === "chat" && targetChatId) {
        await wallpaperService.setChatWallpaper(
          user.id,
          targetChatId,
          serializedVal,
        );
        dispatch(
          updateChatWallpaper({
            chatId: targetChatId,
            wallpaper: serializedVal,
          }),
        );
      }
      handleClose();
    } catch (err) {
      console.error("Apply wallpaper failed:", err);
      alert(t("chat.wallpaper_apply_failed") || "Failed to apply wallpaper.");
    } finally {
      setIsApplying(false);
    }
  };

  const handleReset = async () => {
    if (!user?.id) return;
    setIsApplying(true);

    try {
      if (applyScope === "global") {
        await wallpaperService.resetGlobalWallpaper(user.id);
        dispatch(setGlobalWallpaperState(null));
      } else if (applyScope === "chat" && targetChatId) {
        await wallpaperService.resetChatWallpaper(user.id, targetChatId);
        dispatch(
          updateChatWallpaper({ chatId: targetChatId, wallpaper: null }),
        );
      }
      handleClose();
    } catch (err) {
      console.error("Reset wallpaper failed:", err);
    } finally {
      setIsApplying(false);
    }
  };

  const handleClose = () => {
    dispatch(setWallpaperModal({ open: false, targetChatId: null }));
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t("chat.customize_wallpaper") || "Chat Wallpaper"}
      className="md:max-w-4xl"
    >
      <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0 overflow-hidden py-4">
        {/* Left Column: Settings, Categories & Presets */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Scope selection wrapper (sticky) */}
          {targetChatId && (
            <div className="mb-4 p-3 rounded-xl bg-wa-header/80 backdrop-blur-xs border border-wa-border shrink-0">
              <span className="text-[10px] text-wa-muted uppercase font-bold tracking-wider mb-2 block">
                {t("chat.apply_wallpaper_to") || "Apply Wallpaper To"}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setApplyScope("chat")}
                  className={cn(
                    "flex-1 text-center py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer",
                    applyScope === "chat"
                      ? "bg-wa-primary text-white border-wa-primary shadow-sm"
                      : "bg-wa-modal text-wa-text border-wa-border hover:bg-wa-hover",
                  )}
                >
                  {t("chat.this_chat_only") || `This Chat (${targetChat.name})`}
                </button>
                <button
                  type="button"
                  onClick={() => setApplyScope("global")}
                  className={cn(
                    "flex-1 text-center py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer",
                    applyScope === "global"
                      ? "bg-wa-primary text-white border-wa-primary shadow-sm"
                      : "bg-wa-modal text-wa-text border-wa-border hover:bg-wa-hover",
                  )}
                >
                  {t("chat.all_chats_default") || "All Chats (Default)"}
                </button>
              </div>
            </div>
          )}

          {/* Navigation Tabs (sticky) */}
          <div className="flex border-b border-wa-border mb-4 overflow-x-auto shrink-0 select-none scrollbar-none">
            {[
              { id: "color", label: t("chat.solid_colors") || "Colors" },
              { id: "gradient", label: t("chat.gradients") || "Gradients" },
              { id: "gallery", label: t("chat.gallery") || "Gallery" },
              { id: "upload", label: t("chat.upload_custom") || "Upload" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedType(tab.id)}
                className={cn(
                  "px-4 py-2 text-xs font-bold whitespace-nowrap border-b-2 transition-all cursor-pointer",
                  selectedType === tab.id
                    ? "border-wa-primary text-wa-primary"
                    : "border-transparent text-wa-muted hover:text-wa-text",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Presets Picker (scrollable content area) */}
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar mb-4 p-3 pb-6">
            {selectedType === "color" && (
              <div className="space-y-4">
                <ColorGrid
                  selectedValue={currentVal}
                  onSelect={(val, isCustom) => {
                    setSelectedType("color");
                    setCurrentVal(val);
                    setIsCustomColorActive(isCustom);
                    if (isCustom) {
                      setCustomColorVal(val);
                      setIsColorModalOpen(true);
                    }
                  }}
                />

                {isCustomColorActive && (
                  <div className="flex justify-center mt-3 animate-fade-in">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setIsColorModalOpen(true)}
                      className="text-xs flex items-center gap-1.5 px-4 py-2 bg-wa-header/45 border border-wa-border hover:bg-wa-hover transition-all text-wa-text shadow-sm"
                    >
                      <Sliders className="h-3.5 w-3.5" />
                      {t("settings.edit_color") || "Configure Custom Color"}
                    </Button>
                  </div>
                )}

                <Modal
                  isOpen={isColorModalOpen}
                  onClose={() => setIsColorModalOpen(false)}
                  title={t("settings.color_designer") || "Color Designer"}
                  className="max-w-md"
                >
                  <div className="space-y-6">
                    <div
                      className="h-28 w-full rounded-xl border border-wa-border shadow-inner animate-fade-in"
                      style={{
                        backgroundColor: customColorVal,
                      }}
                    />

                    <ColorDesigner
                      color={customColorVal}
                      onChange={(color) => {
                        setCustomColorVal(color);
                        setCurrentVal(color);
                      }}
                    />

                    <div className="flex justify-end pt-2">
                      <Button
                        type="button"
                        variant="primary"
                        onClick={() => setIsColorModalOpen(false)}
                        className="text-xs"
                      >
                        {t("common.done") || "Done"}
                      </Button>
                    </div>
                  </div>
                </Modal>
              </div>
            )}

            {selectedType === "gradient" && (
              <div className="space-y-4">
                <GradientGrid
                  selectedValue={currentVal}
                  onSelect={(val, isCustom) => {
                    setSelectedType("gradient");
                    setCurrentVal(val);
                    setIsCustomGradActive(isCustom);
                    if (isCustom) {
                      setIsGradModalOpen(true);
                    }
                  }}
                  customGradColor1={customGradColor1}
                  customGradColor2={customGradColor2}
                  customGradAngle={customGradAngle}
                  isCustomActive={isCustomGradActive}
                />

                {isCustomGradActive && (
                  <div className="flex justify-center mt-3 animate-fade-in">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setIsGradModalOpen(true)}
                      className="text-xs flex items-center gap-1.5 px-4 py-2 bg-wa-header/45 border border-wa-border hover:bg-wa-hover transition-all text-wa-text shadow-sm"
                    >
                      <Sliders className="h-3.5 w-3.5" />
                      {t("settings.edit_gradient") || "Configure Custom Gradient"}
                    </Button>
                  </div>
                )}

                <Modal
                  isOpen={isGradModalOpen}
                  onClose={() => setIsGradModalOpen(false)}
                  title={t("settings.gradient_designer") || "Gradient Designer"}
                  className="max-w-md"
                >
                  <div className="space-y-6">
                    <div
                      className="h-28 w-full rounded-xl border border-wa-border shadow-inner"
                      style={{
                        background: `linear-gradient(${customGradAngle}deg, ${customGradColor1} 0%, ${customGradColor2} 100%)`,
                      }}
                    />

                    <GradientDesigner
                      color1={customGradColor1}
                      color2={customGradColor2}
                      angle={customGradAngle}
                      onChange={({ color1, color2, angle }) => {
                        setCustomGradColor1(color1);
                        setCustomGradColor2(color2);
                        setCustomGradAngle(angle);
                        setCurrentVal(
                          `linear-gradient(${angle}deg, ${color1} 0%, ${color2} 100%)`,
                        );
                      }}
                    />

                    <div className="flex justify-end pt-2">
                      <Button
                        type="button"
                        variant="primary"
                        onClick={() => setIsGradModalOpen(false)}
                        className="text-xs"
                      >
                        {t("common.done") || "Done"}
                      </Button>
                    </div>
                  </div>
                </Modal>
              </div>
            )}

            {selectedType === "gallery" && (
              <GalleryGrid
                selectedValue={currentVal}
                onSelect={(val) => {
                  setSelectedType("gallery");
                  setCurrentVal(val);
                }}
              />
            )}

            {selectedType === "upload" && (
              <UploadZone
                selectedValue={currentVal}
                onUploadSuccess={(url) => {
                  setSelectedType("upload");
                  setCurrentVal(url);
                }}
                onResetToDefault={() => {
                  setSelectedType("color");
                  setCurrentVal("#efeae2");
                }}
              />
            )}
          </div>

          {/* Dimming adjustment slider (sticky bottom) */}
          <div className="mt-auto p-3.5 bg-black/5 dark:bg-white/5 rounded-xl border border-wa-border/50 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-wa-muted dark:text-wa-text/80 font-bold flex items-center gap-1.5 uppercase tracking-wide">
                <Sliders className="h-3.5 w-3.5" />
                {t("chat.wallpaper_dimming") || "Wallpaper Dimming"}
              </span>
              <span className="text-xs font-semibold text-wa-text">
                {dimVal}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="80"
              value={dimVal}
              onChange={(e) => setDimVal(Number(e.target.value))}
              className="w-full h-1 bg-wa-border rounded-lg appearance-none cursor-pointer accent-wa-primary outline-hidden"
            />
            <span className="text-[10px] text-wa-muted dark:text-wa-text/60 mt-2 block leading-relaxed">
              {t("chat.wallpaper_dimming_desc") ||
                "Drag to dim the wallpaper to improve message bubble text readability and contrast."}
            </span>
          </div>

          {/* Actions panel (sticky bottom) */}
          <div className="mt-4 pt-4 border-t border-wa-border flex items-center justify-between shrink-0 gap-3">
            <button
              type="button"
              onClick={handleReset}
              disabled={isApplying}
              className="text-xs font-bold text-red-500 dark:text-red-400 hover:underline hover:text-red-600 dark:hover:text-red-300 disabled:opacity-50 cursor-pointer block"
            >
              {t("chat.reset_default") || "Reset to Default"}
            </button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={handleClose}
                disabled={isApplying}
                className="text-xs py-1.5 px-3"
              >
                {t("common.cancel") || "Cancel"}
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleApply}
                disabled={isApplying || !currentVal}
                className="text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                {isApplying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t("chat.apply_wallpaper") || "Apply Wallpaper"}
              </Button>
            </div>
          </div>
        </div>

        {/* Right Column: Real-time Live Preview */}
        <WallpaperPreview
          selectedType={selectedType}
          currentVal={currentVal}
          dimVal={dimVal}
          chatName={targetChat?.name}
          chatAvatar={targetChat?.name ? targetChat.name[0] : "P"}
          className="hidden md:flex w-[280px] lg:w-[320px] shrink-0"
        />
      </div>
    </Modal>
  );
}
