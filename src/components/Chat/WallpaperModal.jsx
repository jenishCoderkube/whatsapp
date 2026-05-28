"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../../hooks/useRedux";
import { useTranslation } from "../../hooks/useTranslation";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { setWallpaperModal, setGlobalWallpaperState } from "../../redux/slices/uiSlice";
import { updateChatWallpaper } from "../../redux/slices/chatSlice";
import { wallpaperService } from "../../services/wallpaperService";
import { storageService } from "../../services/storageService";
import { Loader2, Upload, RefreshCw, Eye, Image as ImageIcon, Sliders } from "lucide-react";
import { cn } from "../../utils/cn";

// Predefined solid colors
const SOLID_COLORS = [
  { name: "Teal Light", value: "#efeae2" }, // WhatsApp classic light beige
  { name: "Sage Green", value: "#e1ebe4" },
  { name: "Soft Blue", value: "#dcecf6" },
  { name: "Lilac Lavender", value: "#e8e4f7" },
  { name: "Pale Orange", value: "#fdecd2" },
  { name: "Soft Pink", value: "#fadce6" },
  { name: "Cool Grey", value: "#f1f2f6" },
  { name: "Dark Slate", value: "#0b141a" }, // WhatsApp classic dark bg
  { name: "Deep Charcoal", value: "#1e2c34" },
  { name: "Teal Dark", value: "#0a221d" },
  { name: "Midnight Blue", value: "#0f1c29" },
  { name: "Plum Dark", value: "#1f1826" },
];

// Predefined beautiful gradients
const GRADIENTS = [
  { name: "Soft Dawn", value: "linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)" },
  { name: "Ocean Breeze", value: "linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)" },
  { name: "Sweet Emerald", value: "linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)" },
  { name: "Royal Sunset", value: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" },
  { name: "Night Aurora", value: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)" },
  { name: "Deep Forest", value: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)" },
  { name: "Retro Purple", value: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" },
  { name: "Golden Glow", value: "linear-gradient(135deg, #f6d365 0%, #fda085 100%)" },
];

// Predefined high-quality Unsplash image presets
const GALLERY_PRESETS = [
  { name: "Minimalist Grid", value: "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&auto=format&fit=crop&q=80" },
  { name: "Abstract Geometry", value: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=600&auto=format&fit=crop&q=80" },
  { name: "Abstract Waves", value: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80" },
  { name: "Palm Leaves", value: "https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=600&auto=format&fit=crop&q=80" },
  { name: "Forest Fog", value: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=600&auto=format&fit=crop&q=80" },
  { name: "Starry Sky", value: "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=600&auto=format&fit=crop&q=80" },
  { name: "Moody Mountains", value: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&auto=format&fit=crop&q=80" },
  { name: "Marble Texture", value: "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=600&auto=format&fit=crop&q=80" },
];

export function WallpaperModal() {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const user = useAppSelector((state) => state.auth.user);
  const chats = useAppSelector((state) => state.chat.chats);
  const activeChatId = useAppSelector((state) => state.chat.activeChatId);

  const isOpen = useAppSelector((state) => state.ui.wallpaperModalOpen);
  const targetChatId = useAppSelector((state) => state.ui.wallpaperTargetChatId);

  const targetChat = chats.find((c) => c.id === targetChatId);

  // Wallpaper settings state
  const [selectedType, setSelectedType] = useState("color"); // 'color' | 'gradient' | 'gallery' | 'upload'
  const [currentVal, setCurrentVal] = useState("");
  const [dimVal, setDimVal] = useState(0); // 0 to 80% opacity overlay
  const [isUploading, setIsUploading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [applyScope, setApplyScope] = useState("chat"); // 'chat' (per-chat) or 'global' (all chats)

  const fileInputRef = useRef(null);

  // Hydrate modal from current config
  useEffect(() => {
    if (isOpen && user) {
      // Default apply scope depending on where it was opened
      if (targetChatId) {
        setApplyScope("chat");
        // Try to load current chat wallpaper
        const currentChat = chats.find((c) => c.id === targetChatId);
        const wallpaperStr = currentChat?.wallpaper;
        parseWallpaperString(wallpaperStr);
      } else {
        setApplyScope("global");
        // Load global wallpaper
        const wallpaperStr = useAppSelector ? user.wallpaper : null;
        // Or fetch dynamically
        wallpaperService.getGlobalWallpaper(user.id).then((val) => {
          parseWallpaperString(val);
        });
      }
    }
  }, [isOpen, targetChatId, user?.id]);

  const parseWallpaperString = (wallpaperStr) => {
    if (!wallpaperStr) {
      // Fallback: reset preview to empty/default beige color
      setSelectedType("color");
      setCurrentVal("#efeae2");
      setDimVal(0);
      return;
    }

    try {
      if (wallpaperStr.startsWith("{")) {
        const parsed = JSON.parse(wallpaperStr);
        setSelectedType(parsed.type || "color");
        setCurrentVal(parsed.value || "");
        setDimVal(parsed.dim !== undefined ? parsed.dim : 0);
      } else {
        // Plain string fallback
        setCurrentVal(wallpaperStr);
        setDimVal(0);
        if (wallpaperStr.startsWith("linear-gradient") || wallpaperStr.startsWith("radial-gradient")) {
          setSelectedType("gradient");
        } else if (wallpaperStr.startsWith("http") || wallpaperStr.startsWith("url(")) {
          setSelectedType("gallery");
        } else {
          setSelectedType("color");
        }
      }
    } catch (e) {
      setCurrentVal(wallpaperStr);
      setSelectedType("color");
      setDimVal(0);
    }
  };

  const serializeWallpaper = (type, value, dim) => {
    return JSON.stringify({
      type,
      value,
      dim,
    });
  };

  const handleSelectWallpaper = (type, value) => {
    setSelectedType(type);
    setCurrentVal(value);
  };

  const handleUploadImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    setIsUploading(true);
    try {
      const publicUrl = await storageService.uploadFile(file, "wallpapers");
      if (publicUrl) {
        setSelectedType("upload");
        setCurrentVal(publicUrl);
      }
    } catch (err) {
      console.error("Wallpaper upload failed:", err);
      alert(t("chat.wallpaper_upload_failed") || "Failed to upload custom wallpaper.");
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = "";
    }
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
        await wallpaperService.setChatWallpaper(user.id, targetChatId, serializedVal);
        dispatch(updateChatWallpaper({ chatId: targetChatId, wallpaper: serializedVal }));
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
        dispatch(updateChatWallpaper({ chatId: targetChatId, wallpaper: null }));
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

  // Get preview CSS style
  const getPreviewBackgroundStyle = () => {
    if (!currentVal) return { backgroundColor: "var(--wa-bg)" };
    
    if (selectedType === "color") {
      return { backgroundColor: currentVal };
    }
    if (selectedType === "gradient") {
      return { backgroundImage: currentVal };
    }
    if (selectedType === "gallery" || selectedType === "upload") {
      return {
        backgroundImage: `url(${currentVal})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      };
    }
    return { backgroundColor: "var(--wa-bg)" };
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t("chat.customize_wallpaper") || "Chat Wallpaper"}
      className="md:max-w-4xl"
    >
      <div className="flex flex-col md:flex-row gap-6 max-h-[80vh] overflow-hidden">
        {/* Left pane: Options & Picker */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto pr-2 scrollbar-thin">
          
          {/* Scope selection: Global or Per-Chat */}
          {targetChatId && (
            <div className="mb-5 p-3 rounded-lg bg-wa-header border border-wa-border">
              <span className="text-xs text-wa-muted uppercase font-bold tracking-wider mb-2.5 block">
                {t("chat.apply_wallpaper_to") || "Apply Wallpaper To"}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setApplyScope("chat")}
                  className={cn(
                    "flex-1 text-center py-2 rounded-md text-xs font-semibold border transition-all cursor-pointer",
                    applyScope === "chat"
                      ? "bg-wa-primary text-white border-wa-primary shadow-sm"
                      : "bg-wa-modal text-wa-text border-wa-border hover:bg-wa-hover"
                  )}
                >
                  {t("chat.this_chat_only") || `This Chat (${targetChat.name})`}
                </button>
                <button
                  type="button"
                  onClick={() => setApplyScope("global")}
                  className={cn(
                    "flex-1 text-center py-2 rounded-md text-xs font-semibold border transition-all cursor-pointer",
                    applyScope === "global"
                      ? "bg-wa-primary text-white border-wa-primary shadow-sm"
                      : "bg-wa-modal text-wa-text border-wa-border hover:bg-wa-hover"
                  )}
                >
                  {t("chat.all_chats_default") || "All Chats (Default)"}
                </button>
              </div>
            </div>
          )}

          {/* Categories Tab selector */}
          <div className="flex border-b border-wa-border mb-4 overflow-x-auto shrink-0 select-none">
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
                  "px-3.5 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition-all cursor-pointer",
                  selectedType === tab.id
                    ? "border-wa-primary text-wa-primary"
                    : "border-transparent text-wa-muted hover:text-wa-text"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Category Content Area */}
          <div className="flex-1 min-h-[220px]">
            {/* Colors picker */}
            {selectedType === "color" && (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {SOLID_COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => handleSelectWallpaper("color", color.value)}
                    className={cn(
                      "aspect-square rounded-lg border-2 shadow-xs transition-all relative overflow-hidden group cursor-pointer",
                      currentVal === color.value ? "border-wa-primary scale-95 ring-2 ring-wa-primary/45" : "border-wa-border hover:border-wa-muted"
                    )}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  >
                    <span className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                  </button>
                ))}
              </div>
            )}

            {/* Gradients picker */}
            {selectedType === "gradient" && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {GRADIENTS.map((grad) => (
                  <button
                    key={grad.value}
                    onClick={() => handleSelectWallpaper("gradient", grad.value)}
                    className={cn(
                      "h-16 rounded-lg border-2 shadow-xs transition-all relative overflow-hidden group cursor-pointer",
                      currentVal === grad.value ? "border-wa-primary scale-95 ring-2 ring-wa-primary/45" : "border-wa-border hover:border-wa-muted"
                    )}
                    style={{ backgroundImage: grad.value }}
                    title={grad.name}
                  >
                    <span className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                  </button>
                ))}
              </div>
            )}

            {/* Gallery predefined presets */}
            {selectedType === "gallery" && (
              <div className="grid grid-cols-3 gap-2">
                {GALLERY_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => handleSelectWallpaper("gallery", preset.value)}
                    className={cn(
                      "aspect-[3/4] rounded-lg border-2 shadow-xs transition-all relative overflow-hidden group cursor-pointer",
                      currentVal === preset.value ? "border-wa-primary scale-95 ring-2 ring-wa-primary/45" : "border-wa-border hover:border-wa-muted"
                    )}
                    title={preset.name}
                  >
                    <img src={preset.value} alt={preset.name} className="w-full h-full object-cover" />
                    <span className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" />
                  </button>
                ))}
              </div>
            )}

            {/* Custom Image Upload */}
            {selectedType === "upload" && (
              <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-wa-border rounded-xl text-center">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleUploadImage}
                  accept="image/*"
                  className="hidden"
                />
                
                {isUploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-9 w-9 text-wa-primary animate-spin" />
                    <span className="text-xs text-wa-muted font-medium">{t("chat.uploading_image") || "Uploading image..."}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-wa-header flex items-center justify-center text-wa-muted">
                      <ImageIcon className="h-6 w-6" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-wa-text">{t("chat.upload_custom_desc") || "Choose a local image"}</span>
                      <span className="text-xs text-wa-muted mt-1">{t("chat.upload_limit_desc") || "PNG, JPG or WebP up to 5MB"}</span>
                    </div>
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-2 text-xs flex items-center gap-1.5"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {t("chat.choose_file") || "Choose Image"}
                    </Button>
                  </div>
                )}

                {/* Uploaded Image Preview thumbnail */}
                {!isUploading && currentVal && currentVal.startsWith("http") && !GALLERY_PRESETS.some(p => p.value === currentVal) && (
                  <div className="mt-6 flex flex-col items-center">
                    <span className="text-[10px] text-wa-muted uppercase font-bold tracking-widest mb-2 block">{t("chat.uploaded_file") || "Uploaded Image"}</span>
                    <div className="h-20 w-20 rounded-lg overflow-hidden border border-wa-border relative group shadow-sm">
                      <img src={currentVal} className="w-full h-full object-cover" />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all text-white text-[10px] font-bold"
                      >
                        {t("common.change") || "Change"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Dimming/Brightness Adjustment Slider */}
          <div className="mt-5 pt-4 border-t border-wa-border">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-wa-muted font-bold flex items-center gap-1.5 uppercase tracking-wide">
                <Sliders className="h-3.5 w-3.5" />
                {t("chat.wallpaper_dimming") || "Wallpaper Dimming"}
              </span>
              <span className="text-xs font-semibold text-wa-text">{dimVal}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="80"
              value={dimVal}
              onChange={(e) => setDimVal(Number(e.target.value))}
              className="w-full h-1 bg-wa-border rounded-lg appearance-none cursor-pointer accent-wa-primary outline-hidden"
            />
            <span className="text-[10px] text-wa-muted mt-1.5 block leading-relaxed">
              {t("chat.wallpaper_dimming_desc") || "Drag to dim the wallpaper to improve message bubble text readability and contrast."}
            </span>
          </div>

          {/* Action buttons */}
          <div className="mt-6 flex items-center justify-between shrink-0 gap-3">
            <button
              type="button"
              onClick={handleReset}
              disabled={isApplying}
              className="text-xs font-bold text-red-500 hover:underline hover:text-red-600 disabled:opacity-50 cursor-pointer block"
            >
              {t("chat.reset_default") || "Reset to Default"}
            </button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={handleClose}
                disabled={isApplying}
                className="text-xs py-2 px-4"
              >
                {t("common.cancel") || "Cancel"}
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleApply}
                disabled={isApplying || !currentVal}
                className="text-xs py-2 px-4 flex items-center gap-1.5"
              >
                {isApplying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t("chat.apply_wallpaper") || "Apply Wallpaper"}
              </Button>
            </div>
          </div>
        </div>

        {/* Right pane: Realtime Chat Preview */}
        <div className="w-full md:w-80 shrink-0 flex flex-col border border-wa-border rounded-xl overflow-hidden shadow-md select-none bg-wa-bg h-[380px] md:h-auto">
          {/* Mock Header */}
          <div className="bg-wa-header px-4 py-3 border-b border-wa-border flex items-center gap-3 shrink-0">
            <div className="h-8 w-8 rounded-full bg-wa-primary flex items-center justify-center text-white text-xs font-bold">
              {targetChat ? targetChat.name[0] : "P"}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-wa-text truncate">{targetChat ? targetChat.name : "Preview Chat"}</span>
              <span className="text-[10px] text-wa-muted truncate">{t("chat.online") || "Online"}</span>
            </div>
          </div>

          {/* Mock Message Area with Wallpaper and dimming applied */}
          <div className="flex-1 p-4 relative overflow-hidden flex flex-col justify-end gap-2.5 transition-all duration-200" style={getPreviewBackgroundStyle()}>
            {/* Dimming Overlay Layer */}
            <div
              className="absolute inset-0 bg-black transition-opacity duration-200 pointer-events-none z-0"
              style={{ opacity: dimVal / 100 }}
            />

            {/* Chat encrypted bubble */}
            <div className="flex justify-center mb-1 z-10">
              <span className="bg-[#ffeecd]/80 dark:bg-wa-sidebar/85 backdrop-blur-xs text-wa-muted text-[9px] px-2 py-0.5 rounded shadow-xs text-center border border-wa-border/30">
                🔒 {t("common.encrypted")}
              </span>
            </div>

            {/* Bubble 1: Incoming */}
            <div className="flex justify-start z-10 max-w-[85%]">
              <div className="bg-wa-bubble-in text-wa-text text-[11px] px-2.5 py-1.5 rounded-lg rounded-tl-none shadow-xs border border-wa-border/20 relative">
                <p className="leading-relaxed">
                  {t("chat.preview_incoming") || "Hey! How does this wallpaper look in real chat bubbles?"}
                </p>
                <span className="text-[9px] text-wa-muted float-right mt-1 ml-2 font-medium">10:04 AM</span>
              </div>
            </div>

            {/* Bubble 2: Outgoing */}
            <div className="flex justify-end z-10 max-w-[85%] self-end">
              <div className="bg-wa-bubble-out text-wa-text text-[11px] px-2.5 py-1.5 rounded-lg rounded-tr-none shadow-xs border border-wa-border/20 relative">
                <p className="leading-relaxed">
                  {t("chat.preview_outgoing") || "Looks amazing! Contrast and readability are perfect. 🔥"}
                </p>
                <div className="float-right mt-1 ml-2 flex items-center gap-0.5">
                  <span className="text-[9px] text-wa-muted font-medium">10:05 AM</span>
                  <span className="text-blue-500 text-[10px] font-bold">✓✓</span>
                </div>
              </div>
            </div>
          </div>

          {/* Mock Input footer */}
          <div className="bg-wa-header px-4 py-2 border-t border-wa-border flex items-center gap-2 shrink-0">
            <div className="flex-1 bg-wa-input h-7 rounded-lg border border-wa-border px-2 text-[10px] text-wa-muted flex items-center">
              {t("chat.type_message") || "Type a message"}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
