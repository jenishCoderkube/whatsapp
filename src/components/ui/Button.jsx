"use client";

import React from "react";
import { cn } from "../../utils/cn";

export const Button = React.forwardRef(
  ({ className, variant = "default", size = "default", isLoading, children, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center rounded-sm font-medium transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none select-none";

    const variants = {
      default: "bg-wa-primary text-white hover:bg-wa-primary-hover shadow-sm",
      secondary: "bg-wa-header text-wa-text hover:bg-wa-active",
      ghost: "hover:bg-wa-hover text-wa-muted hover:text-wa-text",
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
