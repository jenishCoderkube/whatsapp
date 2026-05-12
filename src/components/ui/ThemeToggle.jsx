"use client";

import React from "react";
import { Sun, Moon } from "lucide-react";
import { useAppDispatch, useAppSelector } from "../../hooks/useRedux";
import { toggleTheme } from "../../redux/slices/uiSlice";
import { cn } from "../../utils/cn";

export function ThemeToggle({ className }) {
  const dispatch = useAppDispatch();
  const theme = useAppSelector((state) => state.ui.theme);

  return (
    <button
      onClick={() => dispatch(toggleTheme())}
      className={cn(
        "relative inline-flex items-center justify-center p-2 rounded-full text-wa-muted hover:bg-wa-hover active:bg-wa-active transition-colors shrink-0",
        className
      )}
      title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
    >
      {theme === "light" ? (
        <Moon className="h-5 w-5 transition-transform duration-300 hover:rotate-12" />
      ) : (
        <Sun className="h-5 w-5 transition-transform duration-300 hover:rotate-90 text-wa-primary" />
      )}
    </button>
  );
}
