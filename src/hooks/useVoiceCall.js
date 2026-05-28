import { useEffect, useState, useRef, useCallback } from "react";
import { useAppDispatch, useAppSelector } from "../hooks/useRedux";
import {
  initiateOutgoingCall,
  acceptCall,
  setCallStatus,
  endCall,
} from "../redux/slices/callSlice";
import { signalingService } from "../services/signalingService";
import { webrtcService } from "../services/webrtcService";
import { messageService } from "../services/messageService";

export const useVoiceCall = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const activeCall = useAppSelector((state) => state.call.activeCall);
  const incomingCall = useAppSelector((state) => state.call.incomingCall);

  const [localStream, setLocalStreamState] = useState(null);
  const [remoteStream, setRemoteStreamState] = useState(null);

  const remoteAudioRef = useRef(null);
  const activeCallRef = useRef(activeCall);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  // Sync localStream from webrtcService
  useEffect(() => {
    const timer = setInterval(() => {
      if (webrtcService.localStream !== localStream) {
        setLocalStreamState(webrtcService.localStream);
      }
    }, 500);
    return () => clearInterval(timer);
  }, [localStream]);

  const logCallMessage = useCallback(
    async (callData, statusOverride = null) => {
      if (!callData?.conversationId || !user?.id) return;
      const duration = callData.startTime
        ? Math.floor((Date.now() - callData.startTime) / 1000)
        : 0;
      const finalStatus =
        statusOverride || (duration > 0 ? "completed" : "missed");
      const isVideo = callData.type === "video";
      const callLabel = isVideo ? "Video call" : "Voice call";

      try {
        await messageService.sendMessage({
          conversationId: callData.conversationId,
          senderId: user.id,
          text:
            finalStatus === "completed"
              ? `${callLabel} (${duration}s)`
              : `Missed ${callLabel.toLowerCase()}`,
          type: "voice_call",
          metadata: {
            callStatus: finalStatus,
            duration,
            callType: callData.type || "voice",
          },
        });
      } catch (err) {
        console.error("Failed to log call message:", err);
      }
    },
    [user?.id],
  );

  const playRemoteAudio = useCallback((stream) => {
    if (!stream || stream.getAudioTracks().length === 0) return;
    if (!remoteAudioRef.current) {
      remoteAudioRef.current = new Audio();
      remoteAudioRef.current.autoplay = true;
    }
    remoteAudioRef.current.srcObject = stream;
    remoteAudioRef.current.play().catch(() => {});
  }, []);

  /**
   * Set up PeerConnection with ICE + remote track handlers.
   * The onTrack callback receives a NEW MediaStream snapshot each time
   * so React re-renders and video elements reattach srcObject.
   */
  const setupPeerConnection = useCallback(
    (peerId, callType) => {
      webrtcService.createPeerConnection(
        (candidate) => {
          if (peerId) {
            signalingService.sendCandidate(peerId, { candidate });
          }
        },
        (remoteStreamSnapshot) => {
          console.log("[Call] Remote stream snapshot, tracks:",
            remoteStreamSnapshot.getTracks().map(t => `${t.kind}:${t.enabled}:${t.readyState}`));
          setRemoteStreamState(remoteStreamSnapshot);

          if (callType === "voice" || remoteStreamSnapshot.getAudioTracks().length > 0) {
            playRemoteAudio(remoteStreamSnapshot);
          }
        },
      );
    },
    [playRemoteAudio],
  );

  // ─── Start Outgoing Call ──────────────────────────────────────────

  const startCall = useCallback(
    async (peer, conversationId, type = "voice") => {
      if (activeCallRef.current) return;

      const isVideo = type === "video";
      const stream = await webrtcService.acquireLocalMedia(isVideo);
      setLocalStreamState(stream);

      dispatch(initiateOutgoingCall({ peer, type, conversationId }));
      setupPeerConnection(peer.id, type);

      try {
        const callId = "call-" + Date.now();
        const offer = await webrtcService.createOffer();
        await signalingService.sendInvite(peer.id, {
          id: callId,
          caller: user,
          sdp: offer,
          conversationId,
          type,
          timestamp: Date.now(),
        });
      } catch (err) {
        console.error("[Call] Failed to create/send offer:", err);
        webrtcService.cleanup();
        setLocalStreamState(null);
        dispatch(endCall());
      }
    },
    [user, dispatch, setupPeerConnection],
  );

  // ─── Answer Incoming Call ─────────────────────────────────────────
  //
  // CRITICAL: We do NOT dispatch setCallStatus("connected") here.
  // The ONLY source of truth for "connected" is the PC's
  // onconnectionstatechange callback handled in Providers.jsx.
  // This prevents showing "connected" before ICE actually completes.

  const handleAnswerCall = useCallback(async () => {
    if (!incomingCall) return;

    const isVideo = incomingCall.type === "video";
    const stream = await webrtcService.acquireLocalMedia(isVideo);
    setLocalStreamState(stream);

    dispatch(acceptCall());
    setupPeerConnection(incomingCall.caller.id, incomingCall.type);

    try {
      const answer = await webrtcService.createAnswer(incomingCall.sdp);
      await signalingService.sendAnswer(incomingCall.caller.id, {
        sdp: answer,
      });
      // "connected" will be dispatched by Providers.jsx when ICE completes
    } catch (err) {
      console.error("[Call] Failed to answer call:", err);
      webrtcService.cleanup();
      setLocalStreamState(null);
      dispatch(endCall());
    }
  }, [incomingCall, dispatch, setupPeerConnection]);

  // ─── End Call ─────────────────────────────────────────────────────

  const handleEndCall = useCallback(() => {
    const peerId = activeCallRef.current?.peer?.id || incomingCall?.caller?.id;
    const sessionId = activeCallRef.current?.id || incomingCall?.id;
    if (peerId) {
      signalingService.sendEnd(peerId, { reason: "ended", sessionId });
    }

    if (activeCallRef.current) {
      logCallMessage(activeCallRef.current);
    } else if (incomingCall) {
      logCallMessage(incomingCall, "declined");
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current = null;
    }

    webrtcService.cleanup();
    setLocalStreamState(null);
    setRemoteStreamState(null);
    dispatch(endCall());
  }, [incomingCall, dispatch, logCallMessage]);

  return {
    startCall,
    handleAnswerCall,
    handleEndCall,
    activeCall,
    incomingCall,
    localStream,
    remoteStream,
  };
};
