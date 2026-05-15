"use client";

import React, { useEffect, useState } from "react";
import ReduxProvider from "../redux/ReduxProvider";
import { ThemeProvider } from "./ui/ThemeProvider";
import { useAppDispatch, useAppSelector } from "../hooks/useRedux";
import { loginSuccess, logout } from "../redux/slices/authSlice";
import { setUserTyping, syncOnlineUsers } from "../redux/slices/chatSlice";
import { authService } from "../services/authService";
import { realtimeService } from "../services/realtimeService";
import { MessageSquare } from "lucide-react";
import { CallOverlay } from "./Call/CallOverlay";

// Internal gate initializing presence tracking and preventing unauthenticated flicker
function AuthSessionRecoveryGate({ children }) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [isMounted, setIsMounted] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function recoverSession() {
      try {
        const currentUser = await authService.getCurrentUser();
        if (mounted && currentUser) {
          dispatch(loginSuccess({ user: currentUser }));
        } else if (mounted) {
          dispatch(logout());
        }
      } catch (err) {
        console.warn("Session hydration bypass lookup exception:", err);
        if (mounted) {
          dispatch(logout());
        }
      } finally {
        if (mounted) {
          setIsHydrating(false);
        }
      }
    }

    recoverSession();

    // Listen to Supabase native token updates
    const subscription = authService.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (event === "SIGNED_OUT" || !session) {
        realtimeService.disconnectGlobalPresence();
        dispatch(logout());
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        const currentUser = await authService.getCurrentUser();
        if (currentUser && mounted) {
          dispatch(loginSuccess({ user: currentUser }));
        }
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
      realtimeService.disconnectGlobalPresence();
    };
  }, [dispatch]);

  // Orchestrate dynamic global presence loop
  useEffect(() => {
    if (!user?.id || isHydrating) return;

    realtimeService.initializeGlobalPresence(
      user.id,
      (onlineMap) => {
        // Absolute full state drop-in parity dispatch guarantees stale offline tracking cleans up instantly
        dispatch(syncOnlineUsers(onlineMap));
      },
      (typingPayload) => {
        // payload: { chatId, userId, isTyping }
        dispatch(setUserTyping(typingPayload));
      }
    );

    return () => {
      // presence teardown handled automatically on unmount/signout
    };
  }, [user?.id, isHydrating, dispatch]);

  if (!isMounted || isHydrating) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-wa-sidebar select-none transition-colors duration-200">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-wa-primary text-white shadow-lg animate-pulse mb-4">
          <MessageSquare className="h-10 w-10" />
        </div>
        <h1 className="text-xl font-medium text-wa-text">WhatsApp Web</h1>
        <div className="mt-4 flex items-center gap-2">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-wa-border">
            <div className="h-full w-1/2 bg-wa-primary animate-pulse" />
          </div>
        </div>
        <span className="absolute bottom-8 text-[11px] text-wa-muted flex items-center gap-1">
          🔒 End-to-end encrypted production engine
        </span>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      {children}
      <CallOverlay />
    </div>
  );
}

export default function Providers({ children }) {
  return (
    <ReduxProvider>
      <ThemeProvider>
        <AuthSessionRecoveryGate>{children}</AuthSessionRecoveryGate>
      </ThemeProvider>
    </ReduxProvider>
  );
}
