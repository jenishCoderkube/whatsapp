"use client";

import React from "react";
import { cn } from "../../utils/cn";

export const Button = React.forwardRef(
  ({ className, variant = "default", size = "default", isLoading, children, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center rounded-sm font-medium transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none select-none";

    const variants = {
      default: "bg-[#00a884] text-white hover:bg-[#008f72] shadow-sm",
      secondary: "bg-[#f0f2f5] dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] hover:bg-[#e4e7eb] dark:hover:bg-[#2a3942]",
      ghost: "hover:bg-[#f0f2f5] dark:hover:bg-[#202c33] text-[#54656f] dark:text-[#aebac1]",
      danger: "bg-red-600 text-white hover:bg-red-700",
    };

    const sizes = {
      default: "h-10 px-4 py-2 text-sm",
      sm: "h-8 px-3 text-xs",
      lg: "h-12 px-6 text-base rounded-md",
      icon: "h-10 w-10 rounded-full",
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {isLoading ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
