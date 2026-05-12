"use client";

import React from "react";
import { cn } from "../../utils/cn";

export const Avatar = React.forwardRef(
  ({ src, alt = "", size = "md", className, isOnline = false, fallback = "?" }, ref) => {
    const sizes = {
      sm: "h-8 w-8 text-xs",
      md: "h-10 w-10 text-sm",
      lg: "h-12 w-12 text-base",
      xl: "h-16 w-16 text-xl",
      xxl: "h-24 w-24 text-3xl",
    };

    return (
      <div className="relative inline-block select-none shrink-0">
        <div
          ref={ref}
          className={cn(
            "relative flex items-center justify-center rounded-full overflow-hidden bg-wa-muted text-white font-semibold transition-colors",
            sizes[size],
            className
          )}
        >
          {src ? (
            <img
              src={src}
              alt={alt}
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : null}
          {!src ? <span className="absolute">{fallback}</span> : null}
        </div>
        {isOnline ? (
          <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-wa-online ring-2 ring-wa-sidebar transition-colors" />
        ) : null}
      </div>
    );
  }
);

Avatar.displayName = "Avatar";
