import React from "react";
import { useTranslation } from "../../../hooks/useTranslation";

export function GradientDesigner({
  color1,
  color2,
  angle,
  onChange,
}) {
  const { t } = useTranslation();

  return (
    <div className="mt-4 p-4 rounded-xl bg-wa-header/45 border border-wa-border/55 space-y-4 animate-slide-up">
      <div className="text-xs font-bold text-wa-primary uppercase tracking-wider">
        {t("settings.gradient_designer") || "Gradient Designer"}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Color 1 */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-wa-muted uppercase tracking-wider block">
            {t("settings.start_color") || "Start Color"}
          </label>
          <div className="flex items-center gap-2 bg-wa-sidebar border border-wa-border rounded-lg p-1.5">
            <label
              htmlFor="gradient-start-color"
              className="w-6 h-6 rounded-md border border-wa-border shrink-0 relative overflow-hidden cursor-pointer"
              style={{ backgroundColor: color1 }}
            >
              <input
                id="gradient-start-color"
                type="color"
                value={color1}
                onChange={(e) => {
                  onChange({ color1: e.target.value, color2, angle });
                }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </label>
            <span className="text-xs font-mono text-wa-text uppercase select-all">
              {color1}
            </span>
          </div>
        </div>

        {/* Color 2 */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-wa-muted uppercase tracking-wider block">
            {t("settings.end_color") || "End Color"}
          </label>
          <div className="flex items-center gap-2 bg-wa-sidebar border border-wa-border rounded-lg p-1.5">
            <label
              htmlFor="gradient-end-color"
              className="w-6 h-6 rounded-md border border-wa-border shrink-0 relative overflow-hidden cursor-pointer"
              style={{ backgroundColor: color2 }}
            >
              <input
                id="gradient-end-color"
                type="color"
                value={color2}
                onChange={(e) => {
                  onChange({ color1, color2: e.target.value, angle });
                }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </label>
            <span className="text-xs font-mono text-wa-text uppercase select-all">
              {color2}
            </span>
          </div>
        </div>
      </div>

      {/* Angle Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold text-wa-muted uppercase tracking-wider block">
            {t("settings.gradient_angle") || "Gradient Angle"}
          </label>
          <span className="text-xs font-semibold text-wa-text">
            {angle}°
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="360"
          value={angle}
          onChange={(e) => {
            onChange({ color1, color2, angle: Number(e.target.value) });
          }}
          className="w-full h-1 bg-wa-border rounded-lg appearance-none cursor-pointer accent-wa-primary outline-none"
        />
      </div>
    </div>
  );
}
