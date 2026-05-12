"use client";

import React from "react";
import { Laptop, Lock } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-wa-sidebar px-6 text-center select-none border-b-8 border-wa-primary transition-colors duration-200">
      <div className="max-w-md">
        <div className="flex justify-center mb-6 text-wa-primary">
          <Laptop className="h-32 w-32 stroke-1" />
        </div>

        <h1 className="text-xl sm:text-2xl font-light text-wa-text mb-3">
          WhatsApp Web
        </h1>

        <p className="text-xs sm:text-sm text-wa-muted leading-relaxed mb-8">
          Send and receive messages without keeping your phone online.
          <br />
          Use WhatsApp on up to 4 linked devices and 1 phone at the same time.
        </p>

        <div className="inline-flex items-center gap-1.5 text-[11px] text-wa-muted">
          <Lock className="h-3 w-3" />
          <span>End-to-end encrypted</span>
        </div>
      </div>
    </div>
  );
}
