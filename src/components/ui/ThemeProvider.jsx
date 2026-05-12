"use client";

import React, { useEffect } from "react";
import { useAppDispatch } from "../../hooks/useRedux";
import { setTheme } from "../../redux/slices/uiSlice";

export function ThemeProvider({ children }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    // Read persisted theme preference from localStorage on application mount
    try {
      const savedTheme = localStorage.getItem("wa_theme");
      if (savedTheme === "dark" || savedTheme === "light") {
        dispatch(setTheme(savedTheme));
      } else {
        // Check system preference fallback if no explicit theme stored
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        dispatch(setTheme(prefersDark ? "dark" : "light"));
      }
    } catch (e) {
      // Gracefully ignore storage access policy blocks
    }
  }, [dispatch]);

  return <>{children}</>;
}
