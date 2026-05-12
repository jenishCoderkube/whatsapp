"use client";

import React from "react";
import { cn } from "../../utils/cn";

export function Loader({ className, size = "md", fullScreen = false }) {
  const sizes = {
    sm: "h-5 w-5 border-2",
    md: "h-8 w-8 border-3",
    lg: "h-12 w-12 border-4",
  };

  const spinner = (
    <div
      className={cn(
        "animate-spin rounded-full border-wa-primary border-t-transparent",
        sizes[size],
        className
      )}
    />
  );

  if (fullScreen) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-wa-header transition-colors">
        {spinner}
        <div className="mt-4 text-sm font-medium text-wa-muted">
          WhatsApp Web Client Initializing...
        </div>
      </div>
    );
  }

  return spinner;
}
