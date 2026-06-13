import React from "react";
import { Check } from "lucide-react";
import { cn } from "../../../utils/cn";
import { GALLERY_PRESETS } from "./constants";

export function GalleryGrid({ selectedValue, onSelect }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 p-1">
      {GALLERY_PRESETS.map((preset) => (
        <button
          key={preset.value}
          type="button"
          onClick={() => onSelect(preset.value)}
          className={cn(
            "aspect-[3/4] rounded-lg border border-wa-border relative overflow-hidden transition-all flex items-center justify-center bg-wa-header group cursor-pointer",
            selectedValue === preset.value
              ? "ring-2 ring-wa-primary scale-[0.98]"
              : "hover:border-wa-muted hover:scale-[1.02]"
          )}
          title={preset.name}
        >
          <img
            src={preset.value}
            className="w-full h-full object-cover pointer-events-none select-none transition-transform duration-300 group-hover:scale-105"
            alt={preset.name}
          />
          {selectedValue === preset.value && (
            <div className="absolute h-5 w-5 bg-wa-primary text-white rounded-full flex items-center justify-center shadow">
              <Check className="h-3 w-3" />
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
