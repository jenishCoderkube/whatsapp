"use client";

import React from "react";
import { Avatar } from "../ui/Avatar";
import { cn } from "../../utils/cn";

export function StatusAvatar({ src, fallback = "?", statuses = [], size = "lg", className }) {
  const sizes = {
    md: { box: 48, center: 24, radius: 21, strokeWidth: 2, avatarSize: "h-9 w-9" },
    lg: { box: 56, center: 28, radius: 25, strokeWidth: 2.5, avatarSize: "h-11 w-11" },
    xl: { box: 72, center: 36, radius: 32, strokeWidth: 3, avatarSize: "h-15 w-15" },
  };

  const currentSize = sizes[size] || sizes.lg;
  const { box, center, radius, strokeWidth, avatarSize } = currentSize;

  const N = statuses.length;
  
  if (N === 0) {
    // If no statuses, render a standard avatar with no ring
    return (
      <Avatar
        src={src}
        fallback={fallback}
        size={size === "md" ? "md" : size === "lg" ? "lg" : "xl"}
        className={className}
      />
    );
  }

  // Segmented Ring Math
  const circumference = 2 * Math.PI * radius;
  const gap = N > 1 ? 4 : 0; // Space between segments in pixels
  const totalGaps = N * gap;
  const arcLength = (circumference - totalGaps) / N;

  // Render SVG Ring overlay
  return (
    <div className={cn("relative flex items-center justify-center shrink-0 select-none", className)} style={{ width: box, height: box }}>
      {/* SVG status ring */}
      <svg
        className="absolute inset-0 rotate-[-90deg] pointer-events-none"
        width={box}
        height={box}
        viewBox={`0 0 ${box} ${box}`}
      >
        {statuses.map((status, index) => {
          // Determine color based on seen state
          const strokeColor = status.isSeen ? "stroke-wa-muted/40" : "stroke-wa-primary";
          
          // Dash calculations
          const dashArray = `${arcLength} ${circumference - arcLength}`;
          const dashOffset = -index * (arcLength + gap);

          return (
            <circle
              key={status.id || index}
              cx={center}
              cy={center}
              r={radius}
              className={cn("transition-all duration-300", strokeColor)}
              strokeWidth={strokeWidth}
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
              fill="none"
              strokeLinecap={N > 1 ? "round" : "butt"}
            />
          );
        })}
      </svg>

      {/* Avatar placed inside the ring */}
      <div className={cn("rounded-full overflow-hidden flex items-center justify-center bg-wa-hover", avatarSize)}>
        {src ? (
          <img src={src} alt="Status Avatar" className="h-full w-full object-cover" />
        ) : (
          <span className="text-wa-text font-semibold uppercase">{fallback}</span>
        )}
      </div>
    </div>
  );
}
