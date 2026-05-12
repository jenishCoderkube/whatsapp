"use client";

import React from "react";
import { cn } from "../../utils/cn";

export const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md bg-white dark:bg-[#2a3942] px-3 py-2 text-sm text-[#111b21] dark:text-[#e9edef] placeholder:text-[#667781] dark:placeholder:text-[#8696a0] border border-[#e9edef] dark:border-[#222d34] focus:outline-none focus:ring-1 focus:ring-[#00a884] focus:border-transparent transition-all disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});

Input.displayName = "Input";
