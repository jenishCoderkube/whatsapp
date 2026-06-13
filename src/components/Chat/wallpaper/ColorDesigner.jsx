import React from "react";
import { useTranslation } from "../../../hooks/useTranslation";

export function ColorDesigner({ color, onChange }) {
  const { t } = useTranslation();

  return (
    <div className="mt-4 p-4 rounded-xl bg-wa-header/45 border border-wa-border/55 space-y-4 animate-slide-up">
      <div className="text-xs font-bold text-wa-primary uppercase tracking-wider">
        {t("settings.color_designer") || "Color Designer"}
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-wa-muted uppercase tracking-wider block">
          {t("settings.select_color") || "Select Color"}
        </label>
        <div className="flex items-center gap-2 bg-wa-sidebar border border-wa-border rounded-lg p-1.5">
          <label
            htmlFor="custom-solid-color"
            className="w-6 h-6 rounded-md border border-wa-border shrink-0 relative overflow-hidden cursor-pointer"
            style={{ backgroundColor: color }}
          >
            <input
              id="custom-solid-color"
              type="color"
              value={color}
              onChange={(e) => onChange(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </label>
          <span className="text-xs font-mono text-wa-text uppercase select-all">
            {color}
          </span>
        </div>
      </div>
    </div>
  );
}
