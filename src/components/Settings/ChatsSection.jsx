"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../../hooks/useRedux";
import { useTranslation } from "../../hooks/useTranslation";
import { Check, Loader2, Upload, Trash2, Sliders, Image as ImageIcon } from "lucide-react";
import { cn } from "../../utils/cn";
import { setTheme, setGlobalWallpaperState } from "../../redux/slices/uiSlice";
import { updateChatWallpaper } from "../../redux/slices/chatSlice";
import { wallpaperService } from "../../services/wallpaperService";
import { storageService } from "../../services/storageService";
import { Button } from "../ui/Button";

// Predefined solid colors (WhatsApp style)
const SOLID_COLORS = [
  { name: "Teal Light", value: "#efeae2" },
  { name: "Sage Green", value: "#e1ebe4" },
  { name: "Soft Blue", value: "#dcecf6" },
  { name: "Lilac Lavender", value: "#e8e4f7" },
  { name: "Pale Orange", value: "#fdecd2" },
  { name: "Soft Pink", value: "#fadce6" },
  { name: "Cool Grey", value: "#f1f2f6" },
  { name: "Dark Slate", value: "#0b141a" },
  { name: "Deep Charcoal", value: "#1e2c34" },
  { name: "Teal Dark", value: "#0a221d" },
  { name: "Midnight Blue", value: "#0f1c29" },
  { name: "Plum Dark", value: "#1f1826" }
];

// Predefined premium gradients
const GRADIENTS = [
  { name: "Soft Dawn", value: "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)" },
  { name: "Ocean Breeze", value: "linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)" },
  { name: "Sweet Emerald", value: "linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)" },
  { name: "Royal Sunset", value: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" },
  { name: "Night Aurora", value: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)" },
  { name: "Deep Forest", value: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)" },
  { name: "Retro Purple", value: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" },
  { name: "Golden Glow", value: "linear-gradient(135deg, #f6d365 0%, #fda085 100%)" }
];

// Predefined Unsplash image presets
const GALLERY_PRESETS = [
  { name: "Minimalist Grid", value: "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&auto=format&fit=crop&q=80" },
  { name: "Abstract Geometry", value: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=600&auto=format&fit=crop&q=80" },
  { name: "Abstract Waves", value: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80" },
  { name: "Palm Leaves", value: "https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=600&auto=format&fit=crop&q=80" },
  { name: "Forest Fog", value: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=600&auto=format&fit=crop&q=80" },
  { name: "Starry Sky", value: "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=600&auto=format&fit=crop&q=80" },
  { name: "Moody Mountains", value: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&auto=format&fit=crop&q=80" },
  { name: "Marble Texture", value: "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=600&auto=format&fit=crop&q=80" }
];

export function ChatsSection({ user, activeChatId }) {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const theme = useAppSelector((state) => state.ui.theme);
  const chats = useAppSelector((state) => state.chat.chats);
  const globalWallpaper = useAppSelector((state) => state.ui.globalWallpaper);

  const [wpSelectedType, setWpSelectedType] = useState("color"); // 'color' | 'gradient' | 'gallery' | 'upload'
  const [wpCurrentVal, setWpCurrentVal] = useState("");
  const [wpDimVal, setWpDimVal] = useState(0);
  const [wpIsUploading, setWpIsUploading] = useState(false);
  const [wpIsApplying, setWpIsApplying] = useState(false);
  const [wpApplyScope, setWpApplyScope] = useState("global"); // 'global' | 'chat'
  const wpFileInputRef = useRef(null);

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
      return;
    }
    try {
      if (wallpaperStr.startsWith("{")) {
        const parsed = JSON.parse(wallpaperStr);
        setWpSelectedType(parsed.type || "color");
        setWpCurrentVal(parsed.value || "");
        setWpDimVal(parsed.dim !== undefined ? parsed.dim : 0);
      } else {
        setWpCurrentVal(wallpaperStr);
        setWpDimVal(0);
        if (wallpaperStr.startsWith("linear-gradient") || wallpaperStr.startsWith("radial-gradient")) {
          setWpSelectedType("gradient");
        } else if (wallpaperStr.startsWith("http") || wallpaperStr.startsWith("url(")) {
          setWpSelectedType("gallery");
        } else {
          setWpSelectedType("color");
        }
      }
    } catch (e) {
      setWpCurrentVal(wallpaperStr);
      setWpSelectedType("color");
      setWpDimVal(0);
    }
  };

  const handleApplyWallpaper = async () => {
    if (!user?.id) return;
    setWpIsApplying(true);
    const serializedVal = JSON.stringify({ type: wpSelectedType, value: wpCurrentVal, dim: wpDimVal });
    try {
      if (wpApplyScope === "global") {
        await wallpaperService.setGlobalWallpaper(user.id, serializedVal);
        dispatch(setGlobalWallpaperState(serializedVal));
      } else if (wpApplyScope === "chat" && activeChatId) {
        await wallpaperService.setChatWallpaper(user.id, activeChatId, serializedVal);
        dispatch(updateChatWallpaper({ chatId: activeChatId, wallpaper: serializedVal }));
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
        dispatch(updateChatWallpaper({ chatId: activeChatId, wallpaper: null }));
      }
      parseWallpaperString(null);
      alert(t("common.success") || "Wallpaper reset to default.");
    } catch (err) {
      console.error(err);
    } finally {
      setWpIsApplying(false);
    }
  };

  const handleUploadWallpaper = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    setWpIsUploading(true);
    try {
      const publicUrl = await storageService.uploadFile(file, "wallpapers");
      if (publicUrl) {
        setWpSelectedType("upload");
        setWpCurrentVal(publicUrl);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setWpIsUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Theme Section */}
      <div className="bg-wa-sidebar p-5 border border-wa-border/50 rounded-2xl space-y-4">
        <span className="text-[10px] text-wa-primary font-bold uppercase tracking-wider block">{t("settings.theme_config") || "Theme Configuration"}</span>
        
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => dispatch(setTheme("light"))}
            className={cn(
              "flex items-center justify-between p-4 border rounded-xl transition-all cursor-pointer text-sm font-semibold",
              theme === "light"
                ? "border-wa-primary bg-wa-primary/5 text-wa-primary"
                : "border-wa-border hover:bg-wa-hover text-wa-text"
            )}
          >
            <span>{t("sidebar.light_theme") || "Light Theme"}</span>
            <div className={cn(
              "h-4 w-4 rounded-full border flex items-center justify-center shrink-0",
              theme === "light" ? "border-wa-primary bg-wa-primary text-white" : "border-wa-border"
            )}>
              {theme === "light" && <div className="h-1.5 w-1.5 bg-white rounded-full" />}
            </div>
          </button>

          <button
            onClick={() => dispatch(setTheme("dark"))}
            className={cn(
              "flex items-center justify-between p-4 border rounded-xl transition-all cursor-pointer text-sm font-semibold",
              theme === "dark"
                ? "border-wa-primary bg-wa-primary/5 text-wa-primary"
                : "border-wa-border hover:bg-wa-hover text-wa-text"
            )}
          >
            <span>{t("sidebar.dark_theme") || "Dark Theme"}</span>
            <div className={cn(
              "h-4 w-4 rounded-full border flex items-center justify-center shrink-0",
              theme === "dark" ? "border-wa-primary bg-wa-primary text-white" : "border-wa-border"
            )}>
              {theme === "dark" && <div className="h-1.5 w-1.5 bg-white rounded-full" />}
            </div>
          </button>
        </div>
      </div>

      {/* Wallpaper Section */}
      <div className="bg-wa-sidebar p-5 border border-wa-border/50 rounded-2xl space-y-6">
        <span className="text-[10px] text-wa-primary font-bold uppercase tracking-wider block">{t("sidebar.chat_wallpaper") || "Chat Wallpaper"}</span>
        
        {activeChatId && (
          <div className="p-3.5 rounded-xl bg-wa-header/50 border border-wa-border/50 space-y-2">
            <span className="text-[10px] text-wa-muted uppercase font-bold tracking-wider block">{t("settings.scope_selection") || "Scope Selection"}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setWpApplyScope("chat")}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer",
                  wpApplyScope === "chat" ? "bg-wa-primary text-white border-wa-primary" : "bg-wa-sidebar text-wa-text border-wa-border hover:bg-wa-hover"
                )}
              >
                {t("chat.this_chat_only") || "This Chat only"}
              </button>
              <button
                type="button"
                onClick={() => setWpApplyScope("global")}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer",
                  wpApplyScope === "global" ? "bg-wa-primary text-white border-wa-primary" : "bg-wa-sidebar text-wa-text border-wa-border hover:bg-wa-hover"
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
            { id: "upload", label: t("settings.upload") || "Upload Custom" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setWpSelectedType(tab.id)}
              className={cn(
                "px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap",
                wpSelectedType === tab.id ? "border-wa-primary text-wa-primary" : "border-transparent text-wa-muted hover:text-wa-text"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Choices Grid */}
        <div className="max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
          {wpSelectedType === "color" && (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {SOLID_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => { setWpSelectedType("color"); setWpCurrentVal(color.value); }}
                  className={cn(
                    "aspect-square rounded-xl border border-wa-border relative overflow-hidden transition-all flex items-center justify-center cursor-pointer",
                    wpCurrentVal === color.value ? "ring-2 ring-wa-primary" : "hover:scale-102"
                  )}
                  style={{ backgroundColor: color.value }}
                >
                  {wpCurrentVal === color.value && (
                    <div className="h-5 w-5 bg-wa-primary text-white rounded-full flex items-center justify-center shadow">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {wpSelectedType === "gradient" && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {GRADIENTS.map((grad) => (
                <button
                  key={grad.value}
                  onClick={() => { setWpSelectedType("gradient"); setWpCurrentVal(grad.value); }}
                  className={cn(
                    "h-12 rounded-lg border border-wa-border relative overflow-hidden transition-all flex items-center justify-center cursor-pointer",
                    wpCurrentVal === grad.value ? "ring-2 ring-wa-primary" : "hover:scale-102"
                  )}
                  style={{ backgroundImage: grad.value }}
                >
                  {wpCurrentVal === grad.value && (
                    <div className="h-5 w-5 bg-wa-primary text-white rounded-full flex items-center justify-center shadow">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {wpSelectedType === "gallery" && (
            <div className="grid grid-cols-4 gap-2">
              {GALLERY_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => { setWpSelectedType("gallery"); setWpCurrentVal(preset.value); }}
                  className={cn(
                    "aspect-[3/4] rounded-lg border border-wa-border relative overflow-hidden transition-all flex items-center justify-center cursor-pointer bg-wa-header",
                    wpCurrentVal === preset.value ? "ring-2 ring-wa-primary" : "hover:scale-102"
                  )}
                >
                  <img src={preset.value} className="w-full h-full object-cover pointer-events-none select-none" />
                  {wpCurrentVal === preset.value && (
                    <div className="absolute h-5 w-5 bg-wa-primary text-white rounded-full flex items-center justify-center shadow">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {wpSelectedType === "upload" && (
            <div className="flex flex-col items-center justify-center p-6 border border-dashed border-wa-border rounded-2xl text-center bg-wa-header/20">
              <input type="file" ref={wpFileInputRef} onChange={handleUploadWallpaper} accept="image/*" className="hidden" />
              {wpIsUploading ? (
                <Loader2 className="h-6 w-6 text-wa-primary animate-spin" />
              ) : (
                <div className="space-y-3">
                  <ImageIcon className="h-8 w-8 text-wa-muted mx-auto" />
                  <span className="text-xs font-semibold text-wa-text block">{t("settings.choose_file") || "Choose a local image file"}</span>
                  <Button type="button" variant="primary" onClick={() => wpFileInputRef.current?.click()} className="text-xs">
                    {t("settings.browse_image") || "Browse Image"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Wallpaper Dimming */}
        <div className="p-3.5 bg-wa-header/20 border border-wa-border/50 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-wa-muted font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5" />
              {t("settings.wallpaper_dimming") || "Wallpaper Dimming"}
            </span>
            <span className="text-xs font-semibold text-wa-text">{wpDimVal}%</span>
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
          <button onClick={handleResetWallpaper} disabled={wpIsApplying} className="text-xs font-bold text-red-500 hover:underline cursor-pointer">
            {t("settings.reset_default") || "Reset to Default"}
          </button>
          <Button onClick={handleApplyWallpaper} disabled={wpIsApplying || !wpCurrentVal} variant="primary" className="text-xs py-1.5 flex items-center gap-1.5 cursor-pointer">
            {wpIsApplying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t("settings.apply_wallpaper") || "Apply Wallpaper"}
          </Button>
        </div>
      </div>
    </div>
  );
}
