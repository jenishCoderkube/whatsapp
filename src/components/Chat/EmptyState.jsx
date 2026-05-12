"use client";

import React from "react";
import { Laptop, Lock } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-[#f8f9fa] dark:bg-[#222d34] px-6 text-center select-none border-b-8 border-[#00a884]">
      <div className="max-w-md">
        <div className="flex justify-center mb-6 text-[#00a884]">
          <Laptop className="h-32 w-32 stroke-1" />
        </div>

        <h1 className="text-xl sm:text-2xl font-light text-[#111b21] dark:text-[#e9edef] mb-3">
          WhatsApp Web
        </h1>

        <p className="text-xs sm:text-sm text-[#667781] dark:text-[#8696a0] leading-relaxed mb-8">
          Send and receive messages without keeping your phone online.
          <br />
          Use WhatsApp on up to 4 linked devices and 1 phone at the same time.
        </p>

        <div className="inline-flex items-center gap-1.5 text-[11px] text-[#667781] dark:text-[#8696a0]">
          <Lock className="h-3 w-3" />
          <span>End-to-end encrypted</span>
        </div>
      </div>
    </div>
  );
}
