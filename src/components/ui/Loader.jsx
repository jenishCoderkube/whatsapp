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
        "animate-spin rounded-full border-[#00a884] border-t-transparent",
        sizes[size],
        className
      )}
    />
  );

  if (fullScreen) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#f0f2f5] dark:bg-[#111b21]">
        {spinner}
        <div className="mt-4 text-sm font-medium text-[#667781] dark:text-[#8696a0]">
          WhatsApp Web Client Initializing...
        </div>
      </div>
    );
  }

  return spinner;
}
