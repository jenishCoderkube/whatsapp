import React from "react";
import { Check, Plus } from "lucide-react";
import { cn } from "../../../utils/cn";
import { SOLID_COLORS } from "./constants";

export function ColorGrid({ selectedValue, onSelect }) {
  const isCustomColorSelected =
    selectedValue &&
    selectedValue.startsWith("#") &&
    !SOLID_COLORS.some(
      (c) => c.value.toLowerCase() === selectedValue.toLowerCase()
    );

  return (
    <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 p-1">
      {SOLID_COLORS.map((color) => (
        <button
          key={color.value}
          type="button"
          onClick={() => onSelect(color.value, false)}
          className={cn(
            "aspect-square rounded-lg border border-wa-border relative overflow-hidden transition-all flex items-center justify-center cursor-pointer group",
            selectedValue === color.value
              ? "ring-2 ring-wa-primary scale-[0.98]"
              : "hover:border-wa-muted hover:scale-[1.05]"
          )}
          style={{ backgroundColor: color.value }}
          title={color.name}
        >
          <span className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
          {selectedValue === color.value && (
            <div className="h-4 w-4 bg-wa-primary text-white rounded-full flex items-center justify-center shadow-md">
              <Check className="h-2.5 w-2.5" />
            </div>
          )}
        </button>
      ))}

      {/* Custom Color Button */}
      <button
        type="button"
        onClick={() => {
          onSelect(isCustomColorSelected ? selectedValue : "#efeae2", true);
        }}
        className={cn(
          "aspect-square rounded-lg border border-wa-border relative overflow-hidden transition-all flex items-center justify-center cursor-pointer group hover:border-wa-muted hover:scale-[1.05]",
          isCustomColorSelected ? "ring-2 ring-wa-primary scale-[0.98]" : ""
        )}
        style={{
          background: isCustomColorSelected
            ? selectedValue
            : "linear-gradient(135deg, #ff0055, #0055ff, #00ff55)",
        }}
        title="Custom Color"
      >
        <span className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
        {isCustomColorSelected ? (
          <div className="h-4 w-4 bg-wa-primary text-white rounded-full flex items-center justify-center shadow-md z-10">
            <Check className="h-2.5 w-2.5" />
          </div>
        ) : (
          <Plus className="h-4 w-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] z-10" />
        )}
      </button>
    </div>
  );
}
