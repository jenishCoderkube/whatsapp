"use client";

import React from "react";
import { cn } from "../../utils/cn";

export const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md bg-wa-input px-3 py-2 text-sm text-wa-text placeholder:text-wa-muted border border-wa-border focus:outline-none focus:ring-1 focus:ring-wa-primary focus:border-transparent transition-all disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});

Input.displayName = "Input";
