"use client";

import React, { useState, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../../hooks/useRedux";
import { useTranslation } from "../../hooks/useTranslation";
import { Loader2, Sliders } from "lucide-react";
import { cn } from "../../utils/cn";
import { setTheme, setGlobalWallpaperState } from "../../redux/slices/uiSlice";
import { updateChatWallpaper } from "../../redux/slices/chatSlice";
import { wallpaperService } from "../../services/wallpaperService";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

import {
  SOLID_COLORS,
  GRADIENTS,
  GALLERY_PRESETS,
} from "../Chat/wallpaper/constants";
import { ColorGrid } from "../Chat/wallpaper/ColorGrid";
import { GradientGrid } from "../Chat/wallpaper/GradientGrid";
import { GradientDesigner } from "../Chat/wallpaper/GradientDesigner";
import { ColorDesigner } from "../Chat/wallpaper/ColorDesigner";
import { GalleryGrid } from "../Chat/wallpaper/GalleryGrid";
import { UploadZone } from "../Chat/wallpaper/UploadZone";
import { WallpaperPreview } from "../Chat/wallpaper/WallpaperPreview";

export function ChatsSection({ user, activeChatId }) {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const theme = useAppSelector((state) => state.ui.theme);
  const chats = useAppSelector((state) => state.chat.chats);
  const globalWallpaper = useAppSelector((state) => state.ui.globalWallpaper);

  const [wpSelectedType, setWpSelectedType] = useState("color"); // 'color' | 'gradient' | 'gallery' | 'upload'
  const [wpCurrentVal, setWpCurrentVal] = useState("");
  const [wpDimVal, setWpDimVal] = useState(0);
  const [wpIsApplying, setWpIsApplying] = useState(false);
  const [wpApplyScope, setWpApplyScope] = useState("global"); // 'global' | 'chat'

  const [customGradColor1, setCustomGradColor1] = useState("#ff9a9e");
  const [customGradColor2, setCustomGradColor2] = useState("#fecfef");
  const [customGradAngle, setCustomGradAngle] = useState(135);
  const [wpIsCustomGradActive, setWpIsCustomGradActive] = useState(false);
  const [isGradModalOpen, setIsGradModalOpen] = useState(false);

  const [wpCustomColorVal, setWpCustomColorVal] = useState("#efeae2");
  const [wpIsCustomColorActive, setWpIsCustomColorActive] = useState(false);
  const [isColorModalOpen, setIsColorModalOpen] = useState(false);

  useEffect(() => {
    if (user) {
      if (activeChatId) {
        setWpApplyScope("chat");
        const currentChat = chats.find((c) => c.id === activeChatId);
        parseWallpaperString(currentChat?.wallpaper);
      } else {
        setWpApplyScope("global");
        parseWallpaperString(globalWallpaper);
      }
    }
  }, [user?.id, activeChatId]);

  const parseWallpaperString = (wallpaperStr) => {
    if (!wallpaperStr) {
      setWpSelectedType("color");
      setWpCurrentVal("#efeae2");
      setWpDimVal(0);
      setWpIsCustomGradActive(false);
      setWpIsCustomColorActive(false);
      return;
    }
    try {
      if (wallpaperStr.startsWith("{")) {
        const parsed = JSON.parse(wallpaperStr);
        setWpSelectedType(parsed.type || "color");
        setWpCurrentVal(parsed.value || "");
        setWpDimVal(parsed.dim !== undefined ? parsed.dim : 0);

        if (
          parsed.type === "gradient" &&
          parsed.value.startsWith("linear-gradient")
        ) {
          const match = parsed.value.match(
            /linear-gradient\((\d+)deg,\s*(#[a-fA-F0-9]+)\s+0%,\s*(#[a-fA-F0-9]+)\s+100%\)/,
          );
          if (match) {
            setCustomGradAngle(Number(match[1]));
            setCustomGradColor1(match[2]);
            setCustomGradColor2(match[3]);
          }
          const isPreset = GRADIENTS.some((g) => g.value === parsed.value);
          setWpIsCustomGradActive(!isPreset);
          setWpIsCustomColorActive(false);
        } else if (parsed.type === "color") {
          const isPreset = SOLID_COLORS.some(c => c.value.toLowerCase() === parsed.value.toLowerCase());
          setWpIsCustomColorActive(!isPreset);
          if (!isPreset) {
            setWpCustomColorVal(parsed.value);
          }
          setWpIsCustomGradActive(false);
        } else {
          setWpIsCustomGradActive(false);
          setWpIsCustomColorActive(false);
        }
      } else {
        setWpCurrentVal(wallpaperStr);
        setWpDimVal(0);
        if (
          wallpaperStr.startsWith("linear-gradient") ||
          wallpaperStr.startsWith("radial-gradient")
        ) {
          setWpSelectedType("gradient");
          setWpIsCustomColorActive(false);
          if (wallpaperStr.startsWith("linear-gradient")) {
            const match = wallpaperStr.match(
              /linear-gradient\((\d+)deg,\s*(#[a-fA-F0-9]+)\s+0%,\s*(#[a-fA-F0-9]+)\s+100%\)/,
            );
            if (match) {
              setCustomGradAngle(Number(match[1]));
              setCustomGradColor1(match[2]);
              setCustomGradColor2(match[3]);
            }
            const isPreset = GRADIENTS.some((g) => g.value === wallpaperStr);
            setWpIsCustomGradActive(!isPreset);
          } else {
            setWpIsCustomGradActive(false);
          }
        } else if (
          wallpaperStr.startsWith("http") ||
          wallpaperStr.startsWith("url(")
        ) {
          setWpSelectedType("gallery");
          setWpIsCustomGradActive(false);
          setWpIsCustomColorActive(false);
        } else {
          setWpSelectedType("color");
          setWpIsCustomGradActive(false);
          const isPreset = SOLID_COLORS.some(c => c.value.toLowerCase() === wallpaperStr.toLowerCase());
          setWpIsCustomColorActive(!isPreset);
          if (!isPreset && wallpaperStr.startsWith("#")) {
            setWpCustomColorVal(wallpaperStr);
          }
        }
      }
    } catch (e) {
      setWpCurrentVal(wallpaperStr);
      setWpSelectedType("color");
      setWpDimVal(0);
      setWpIsCustomGradActive(false);
      setWpIsCustomColorActive(false);
    }
  };

  const handleApplyWallpaper = async () => {
    if (!user?.id) return;
    setWpIsApplying(true);
    const serializedVal = JSON.stringify({
      type: wpSelectedType,
      value: wpCurrentVal,
      dim: wpDimVal,
    });
    try {
      if (wpApplyScope === "global") {
        await wallpaperService.setGlobalWallpaper(user.id, serializedVal);
        dispatch(setGlobalWallpaperState(serializedVal));
      } else if (wpApplyScope === "chat" && activeChatId) {
        await wallpaperService.setChatWallpaper(
          user.id,
          activeChatId,
          serializedVal,
        );
        dispatch(
          updateChatWallpaper({
            chatId: activeChatId,
            wallpaper: serializedVal,
          }),
        );
      }
      alert(t("common.success") || "Wallpaper applied successfully!");
    } catch (err) {
      console.error(err);
      alert(t("common.error") || "Failed to apply wallpaper.");
    } finally {
      setWpIsApplying(false);
    }
  };

  const handleResetWallpaper = async () => {
    if (!user?.id) return;
    setWpIsApplying(true);
    try {
      if (wpApplyScope === "global") {
        await wallpaperService.resetGlobalWallpaper(user.id);
        dispatch(setGlobalWallpaperState(null));
      } else if (wpApplyScope === "chat" && activeChatId) {
        await wallpaperService.resetChatWallpaper(user.id, activeChatId);
        dispatch(
          updateChatWallpaper({ chatId: activeChatId, wallpaper: null }),
        );
      }
      parseWallpaperString(null);
      alert(t("common.success") || "Wallpaper reset to default.");
    } catch (err) {
      console.error(err);
    } finally {
      setWpIsApplying(false);
    }
  };

  const activeChat = activeChatId
    ? chats.find((c) => c.id === activeChatId)
    : null;

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start animate-fade-in w-full h-full">
      {/* LEFT COLUMN: CONFIGURATION PANELS */}
      <div className="flex-1 min-w-0 space-y-6 w-full">
        {/* Theme Section */}
        <div className="bg-wa-sidebar p-5 border border-wa-border/50 rounded-2xl space-y-4 shadow-sm">
          <span className="text-[10px] text-wa-primary font-bold uppercase tracking-wider block">
            {t("settings.theme_config") || "Theme Configuration"}
          </span>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => dispatch(setTheme("light"))}
              className={cn(
                "flex items-center justify-between p-4 border rounded-xl transition-all cursor-pointer text-sm font-semibold",
                theme === "light"
                  ? "border-wa-primary bg-wa-primary/5 text-wa-primary"
                  : "border-wa-border hover:bg-wa-hover text-wa-text",
              )}
            >
              <span>{t("sidebar.light_theme") || "Light Theme"}</span>
              <div
                className={cn(
                  "h-4 w-4 rounded-full border flex items-center justify-center shrink-0",
                  theme === "light"
                    ? "border-wa-primary bg-wa-primary text-white"
                    : "border-wa-border",
                )}
              >
                {theme === "light" && (
                  <div className="h-1.5 w-1.5 bg-white rounded-full" />
                )}
              </div>
            </button>

            <button
              onClick={() => dispatch(setTheme("dark"))}
              className={cn(
                "flex items-center justify-between p-4 border rounded-xl transition-all cursor-pointer text-sm font-semibold",
                theme === "dark"
                  ? "border-wa-primary bg-wa-primary/5 text-wa-primary"
                  : "border-wa-border hover:bg-wa-hover text-wa-text",
              )}
            >
              <span>{t("sidebar.dark_theme") || "Dark Theme"}</span>
              <div
                className={cn(
                  "h-4 w-4 rounded-full border flex items-center justify-center shrink-0",
                  theme === "dark"
                    ? "border-wa-primary bg-wa-primary text-white"
                    : "border-wa-border",
                )}
              >
                {theme === "dark" && (
                  <div className="h-1.5 w-1.5 bg-white rounded-full" />
                )}
              </div>
            </button>
          </div>
        </div>

        {/* Wallpaper Section */}
        <div className="bg-wa-sidebar p-5 border border-wa-border/50 rounded-2xl space-y-6 shadow-sm">
          <span className="text-[10px] text-wa-primary font-bold uppercase tracking-wider block">
            {t("sidebar.chat_wallpaper") || "Chat Wallpaper"}
          </span>

          {activeChatId && (
            <div className="p-3.5 rounded-xl bg-wa-header/50 border border-wa-border/50 space-y-2">
              <span className="text-[10px] text-wa-muted uppercase font-bold tracking-wider block">
                {t("settings.scope_selection") || "Scope Selection"}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setWpApplyScope("chat")}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer",
                    wpApplyScope === "chat"
                      ? "bg-wa-primary text-white border-wa-primary"
                      : "bg-wa-sidebar text-wa-text border-wa-border hover:bg-wa-hover",
                  )}
                >
                  {t("chat.this_chat_only") || "This Chat only"}
                </button>
                <button
                  type="button"
                  onClick={() => setWpApplyScope("global")}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer",
                    wpApplyScope === "global"
                      ? "bg-wa-primary text-white border-wa-primary"
                      : "bg-wa-sidebar text-wa-text border-wa-border hover:bg-wa-hover",
                  )}
                >
                  {t("chat.all_chats_default") || "All Chats (Default)"}
                </button>
              </div>
            </div>
          )}

          {/* Wallpaper Tabs */}
          <div className="flex border-b border-wa-border overflow-x-auto shrink-0 select-none scrollbar-none gap-2">
            {[
              { id: "color", label: t("settings.color") || "Colors" },
              { id: "gradient", label: t("settings.gradient") || "Gradients" },
              { id: "gallery", label: t("settings.gallery") || "Gallery" },
              { id: "upload", label: t("settings.upload") || "Upload Custom" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setWpSelectedType(tab.id)}
                className={cn(
                  "px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap",
                  wpSelectedType === tab.id
                    ? "border-wa-primary text-wa-primary"
                    : "border-transparent text-wa-muted hover:text-wa-text",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Choices Grid */}
          <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-3 pb-6">
            {wpSelectedType === "color" && (
              <div className="space-y-4">
                <ColorGrid
                  selectedValue={wpCurrentVal}
                  onSelect={(val, isCustom) => {
                    setWpSelectedType("color");
                    setWpCurrentVal(val);
                    setWpIsCustomColorActive(isCustom);
                    if (isCustom) {
                      setWpCustomColorVal(val);
                      setIsColorModalOpen(true);
                    }
                  }}
                />

                {wpIsCustomColorActive && (
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
                        backgroundColor: wpCustomColorVal,
                      }}
                    />

                    <ColorDesigner
                      color={wpCustomColorVal}
                      onChange={(color) => {
                        setWpCustomColorVal(color);
                        setWpCurrentVal(color);
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

            {wpSelectedType === "gradient" && (
              <div className="space-y-4">
                <GradientGrid
                  selectedValue={wpCurrentVal}
                  onSelect={(val, isCustom) => {
                    setWpSelectedType("gradient");
                    setWpCurrentVal(val);
                    setWpIsCustomGradActive(isCustom);
                    if (isCustom) {
                      setIsGradModalOpen(true);
                    }
                  }}
                  customGradColor1={customGradColor1}
                  customGradColor2={customGradColor2}
                  customGradAngle={customGradAngle}
                  isCustomActive={wpIsCustomGradActive}
                />

                {wpIsCustomGradActive && (
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
                        setWpCurrentVal(
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

            {wpSelectedType === "gallery" && (
              <GalleryGrid
                selectedValue={wpCurrentVal}
                onSelect={(val) => {
                  setWpSelectedType("gallery");
                  setWpCurrentVal(val);
                }}
              />
            )}

            {wpSelectedType === "upload" && (
              <UploadZone
                selectedValue={wpCurrentVal}
                onUploadSuccess={(url) => {
                  setWpSelectedType("upload");
                  setWpCurrentVal(url);
                }}
                onResetToDefault={() => {
                  setWpSelectedType("color");
                  setWpCurrentVal("#efeae2");
                }}
              />
            )}
          </div>

          {/* Wallpaper Dimming */}
          <div className="p-3.5 bg-wa-header/20 border border-wa-border/50 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-wa-muted font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5" />
                {t("settings.wallpaper_dimming") || "Wallpaper Dimming"}
              </span>
              <span className="text-xs font-semibold text-wa-text">
                {wpDimVal}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="80"
              value={wpDimVal}
              onChange={(e) => setWpDimVal(Number(e.target.value))}
              className="w-full h-1 bg-wa-border rounded-lg appearance-none cursor-pointer accent-wa-primary outline-none"
            />
          </div>

          {/* Actions Bar */}
          <div className="flex items-center justify-between pt-4 border-t border-wa-border">
            <button
              onClick={handleResetWallpaper}
              disabled={wpIsApplying}
              className="text-xs font-bold text-red-500 hover:underline cursor-pointer"
            >
              {t("settings.reset_default") || "Reset to Default"}
            </button>
            <Button
              onClick={handleApplyWallpaper}
              disabled={wpIsApplying || !wpCurrentVal}
              variant="primary"
              className="text-xs py-1.5 flex items-center gap-1.5 cursor-pointer"
            >
              {wpIsApplying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t("settings.apply_wallpaper") || "Apply Wallpaper"}
            </Button>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: LIVE CHAT PREVIEW (Hidden on mobile, visible on lg screens) */}
      <WallpaperPreview
        selectedType={wpSelectedType}
        currentVal={wpCurrentVal}
        dimVal={wpDimVal}
        chatName={activeChat?.name}
        chatAvatar={activeChat?.name ? activeChat.name[0] : "P"}
        className="hidden lg:flex lg:sticky lg:top-6 w-[320px] shrink-0"
      />
    </div>
  );
}
