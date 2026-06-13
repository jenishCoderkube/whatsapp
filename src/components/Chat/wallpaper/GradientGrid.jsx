import React from "react";
import { Check, Plus } from "lucide-react";
import { cn } from "../../../utils/cn";
import { GRADIENTS } from "./constants";

export function GradientGrid({
  selectedValue,
  onSelect,
  customGradColor1,
  customGradColor2,
  customGradAngle,
  isCustomActive,
}) {
  const isPresetSelected = (gradValue) => selectedValue === gradValue && !isCustomActive;
  const isCustomGradientSelected = !!isCustomActive;

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 p-1">
      {GRADIENTS.map((grad) => {
        const selected = isPresetSelected(grad.value);
        return (
          <button
            key={grad.value}
            type="button"
            onClick={() => onSelect(grad.value, false)}
            className={cn(
              "h-12 rounded-lg border border-wa-border relative overflow-hidden transition-all flex items-center justify-center cursor-pointer group",
              selected
                ? "ring-2 ring-wa-primary scale-[0.98]"
                : "hover:border-wa-muted hover:scale-[1.03]"
            )}
            style={{ backgroundImage: grad.value }}
            title={grad.name}
          >
            <span className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
            {selected && (
              <div className="h-5 w-5 bg-wa-primary text-white rounded-full flex items-center justify-center shadow-md">
                <Check className="h-3 w-3" />
              </div>
            )}
          </button>
        );
      })}

      {/* Custom Gradient Button */}
      <button
        key="custom-gradient-trigger"
        type="button"
        onClick={() => {
          const customVal = `linear-gradient(${customGradAngle}deg, ${customGradColor1} 0%, ${customGradColor2} 100%)`;
          onSelect(customVal, true);
        }}
        className={cn(
          "h-12 rounded-lg border border-wa-border relative overflow-hidden transition-all flex items-center justify-center cursor-pointer group hover:border-wa-muted hover:scale-[1.03]",
          isCustomGradientSelected ? "ring-2 ring-wa-primary scale-[0.98]" : ""
        )}
        style={{
          background: isCustomGradientSelected
            ? `linear-gradient(${customGradAngle}deg, ${customGradColor1} 0%, ${customGradColor2} 100%)`
            : "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
        }}
        title="Custom Gradient"
      >
        <span className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
        {isCustomGradientSelected ? (
          <div className="h-5 w-5 bg-wa-primary text-white rounded-full flex items-center justify-center shadow-md z-10">
            <Check className="h-3 w-3" />
          </div>
        ) : (
          <Plus className="h-5 w-5 text-wa-muted group-hover:text-wa-text z-10" />
        )}
      </button>
    </div>
  );
}
