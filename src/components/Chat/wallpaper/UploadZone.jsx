import React, { useRef, useState } from "react";
import { Loader2, Upload, Trash2, Image as ImageIcon } from "lucide-react";
import { storageService } from "../../../services/storageService";
import { useTranslation } from "../../../hooks/useTranslation";
import { Button } from "../../ui/Button";
import { GALLERY_PRESETS } from "./constants";

export function UploadZone({ selectedValue, onUploadSuccess, onResetToDefault }) {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const publicUrl = await storageService.uploadFile(file, "wallpapers");
      if (publicUrl) {
        onUploadSuccess(publicUrl);
      }
    } catch (err) {
      console.error("Wallpaper upload failed:", err);
      alert(t("chat.wallpaper_upload_failed") || "Failed to upload custom wallpaper.");
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const isCustomUploaded =
    selectedValue &&
    selectedValue.startsWith("http") &&
    !GALLERY_PRESETS.some((p) => p.value === selectedValue);

  return (
    <div className="flex flex-col items-center justify-center p-6 border border-dashed border-wa-border rounded-2xl text-center bg-wa-header/20">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleUpload}
        accept="image/*"
        className="hidden"
      />

      {isUploading ? (
        <div className="flex flex-col items-center gap-3 py-6">
          <Loader2 className="h-8 w-8 text-wa-primary animate-spin" />
          <span className="text-xs text-wa-muted font-medium">
            {t("chat.uploading_image") || "Uploading image..."}
          </span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="h-12 w-12 rounded-2xl bg-wa-header flex items-center justify-center text-wa-muted">
            <ImageIcon className="h-6 w-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-wa-text">
              {t("chat.upload_custom_desc") || "Choose a local image"}
            </span>
            <span className="text-[10px] text-wa-muted mt-1">
              {t("chat.upload_limit_desc") || "PNG, JPG or WebP up to 5MB"}
            </span>
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

      {/* Uploaded Thumbnail preview */}
      {!isUploading && isCustomUploaded && (
        <div className="mt-4 pt-4 border-t border-wa-border w-full flex flex-col items-center animate-fade-in">
          <span className="text-[9px] text-wa-muted uppercase font-bold tracking-widest mb-2 block">
            {t("chat.uploaded_file") || "Uploaded Image"}
          </span>
          <div className="h-24 aspect-[3/4] rounded-xl overflow-hidden border border-wa-border relative group shadow-sm flex items-center justify-center bg-wa-sidebar">
            <img src={selectedValue} className="w-full h-full object-cover" alt="Uploaded" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all gap-2 z-10">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <Upload className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onResetToDefault}
                className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
