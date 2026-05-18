"use client";

import React, { useEffect, useState, useRef } from "react";
import ReduxProvider from "../redux/ReduxProvider";
import { ThemeProvider } from "./ui/ThemeProvider";
import { useAppDispatch, useAppSelector } from "../hooks/useRedux";
import { loginSuccess, logout } from "../redux/slices/authSlice";
import { setUserTyping, syncOnlineUsers } from "../redux/slices/chatSlice";
import { authService } from "../services/authService";
import { realtimeService } from "../services/realtimeService";
import { MessageSquare } from "lucide-react";
import { CallOverlay } from "./Call/CallOverlay";

// Core call handling imports
import { 
  setIncomingCall, 
  setCallStatus, 
  endCall, 
  setRemoteMuted, 
  setRemoteVideoDisabled 
} from "../redux/slices/callSlice";
import { signalingService } from "../services/signalingService";
import { webrtcService } from "../services/webrtcService";
import { messageService } from "../services/messageService";

// Internal gate initializing presence tracking and preventing unauthenticated flicker
function AuthSessionRecoveryGate({ children }) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const activeCall = useAppSelector((state) => state.call.activeCall);
  const incomingCall = useAppSelector((state) => state.call.incomingCall);
  const [isMounted, setIsMounted] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);

  const activeCallRef = useRef(activeCall);
  const incomingCallRef = useRef(incomingCall);

  useEffect(() => { activeCallRef.current = activeCall; }, [activeCall]);
  useEffect(() => { incomingCallRef.current = incomingCall; }, [incomingCall]);

  useEffect(() => {
    setIsMounted(true);
    
    // Register PWA Service Worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("PWA Service Worker registered with scope:", registration.scope);
          })
          .catch((err) => {
            console.warn("PWA Service Worker registration failed:", err);
          });
      });
    }
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
        dispatch(syncOnlineUsers(onlineMap));
      },
      (typingPayload) => {
        dispatch(setUserTyping(typingPayload));
      }
    );

    return () => {
      // presence teardown handled automatically on unmount/signout
    };
  }, [user?.id, isHydrating, dispatch]);

  // Root Level calling signaling coordination
  useEffect(() => {
    if (!user?.id || isHydrating) return;

    const logCallMessage = async (callData, statusOverride = null) => {
      if (!callData?.conversationId || !user?.id) return;
      const duration = callData.startTime ? Math.floor((Date.now() - callData.startTime) / 1000) : 0;
      const finalStatus = statusOverride || (duration > 0 ? "completed" : "missed");
      const isVideo = callData.type === "video";
      const callLabel = isVideo ? "Video call" : "Voice call";

      try {
        await messageService.sendMessage({
          conversationId: callData.conversationId,
          senderId: user.id,
          text: finalStatus === "completed" ? `${callLabel} (${duration}s)` : `Missed ${callLabel.toLowerCase()}`,
          type: "voice_call",
          metadata: {
            callStatus: finalStatus,
            duration,
            callType: callData.type || "voice"
          }
        });
      } catch (err) {
        console.error("Failed to log call message in global signaling handler:", err);
      }
    };

    const handleEndCall = () => {
      const peerId = activeCallRef.current?.peer?.id || incomingCallRef.current?.caller?.id;
      if (peerId) {
        signalingService.sendEnd(peerId, { reason: "ended" });
      }
      
      if (activeCallRef.current) {
        logCallMessage(activeCallRef.current);
      } else if (incomingCallRef.current) {
        logCallMessage(incomingCallRef.current, "declined");
      }

      webrtcService.cleanup();
      dispatch(endCall());
    };

    // Attach PeerConnection state listener
    webrtcService.onConnectionStateChange = (state) => {
      console.log("Global WebRTC State:", state);
      if (state === "connected") {
        dispatch(setCallStatus("connected"));
      } else if (state === "disconnected" || state === "failed") {
        console.warn("Call connection disconnected/failed. Ending call gracefully.");
        handleEndCall();
      }
    };

    signalingService.initialize(user.id, async (type, data) => {
      console.log("Global signaling handler received event:", type);
      switch (type) {
        case "invite":
          if (activeCallRef.current || incomingCallRef.current) {
            signalingService.sendEnd(data.caller.id, { reason: "busy" });
            return;
          }
          dispatch(setIncomingCall(data));
          break;

        case "answer":
          if (activeCallRef.current?.status === "outgoing") {
            await webrtcService.setRemoteAnswer(data.sdp);
            dispatch(setCallStatus("connected"));
          }
          break;

        case "candidate":
          if (activeCallRef.current || incomingCallRef.current) {
            await webrtcService.addIceCandidate(data.candidate);
          }
          break;

        case "end":
          if (activeCallRef.current) {
            await logCallMessage(activeCallRef.current);
          } else if (incomingCallRef.current) {
            await logCallMessage(incomingCallRef.current, "missed");
          }
          webrtcService.cleanup();
          dispatch(endCall());
          break;

        case "mute_status":
          dispatch(setRemoteMuted(data.isMuted));
          break;

        case "video_status":
          dispatch(setRemoteVideoDisabled(!data.isVideoEnabled));
          break;

        default:
          console.warn("Unhandled signal event type:", type);
      }
    });

    // Cleanup signaling on unmount or logout
    return () => {
      signalingService.cleanup();
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
