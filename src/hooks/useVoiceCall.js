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

  // Keep a hidden <audio> ref alive for voice-only calls so remote
  // audio plays even when there is no visible <video> element.
  const remoteAudioRef = useRef(null);
  const activeCallRef = useRef(activeCall);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  // Sync localStream from webrtcService when it changes
  // Use a stable interval that checks reference equality
  useEffect(() => {
    const timer = setInterval(() => {
      if (webrtcService.localStream !== localStream) {
        setLocalStreamState(webrtcService.localStream);
      }
    }, 500);
    return () => clearInterval(timer);
  }, [localStream]);

  /**
   * Log call to conversation message history.
   */
  const logCallMessage = useCallback(async (callData, statusOverride = null) => {
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
  }, [user?.id]);

  /**
   * Play remote audio for voice-only calls via a hidden Audio element.
   * This ensures audio plays even without a visible <video> tag.
   */
  const playRemoteAudio = useCallback((stream) => {
    if (!stream || stream.getAudioTracks().length === 0) return;

    if (!remoteAudioRef.current) {
      remoteAudioRef.current = new Audio();
      remoteAudioRef.current.autoplay = true;
    }
    remoteAudioRef.current.srcObject = stream;
    remoteAudioRef.current.play().catch((e) => {
      console.warn("[Call] Remote audio autoplay blocked:", e);
    });
  }, []);

  /**
   * Set up PeerConnection with ICE + remote track handlers.
   * CRITICAL FIX: The onTrack callback now receives a NEW MediaStream
   * snapshot each time (from the fixed webrtcService), so React's
   * useState detects the change and triggers a re-render, which causes
   * the video elements in CallOverlay to reattach their srcObject.
   */
  const setupPeerConnection = useCallback((peerId, callType) => {
    webrtcService.createPeerConnection(
      // ICE candidate handler
      (candidate) => {
        if (peerId) {
          signalingService.sendCandidate(peerId, { candidate });
        }
      },
      // Remote track handler — receives a NEW MediaStream snapshot each time
      (remoteStreamSnapshot) => {
        console.log("[Call] Remote stream snapshot received, tracks:", 
          remoteStreamSnapshot.getTracks().map(t => `${t.kind}:${t.enabled}:${t.readyState}`)
        );
        setRemoteStreamState(remoteStreamSnapshot);

        // Always ensure audio playback (voice calls have no <video> element)
        if (callType === "voice" || remoteStreamSnapshot.getAudioTracks().length > 0) {
          playRemoteAudio(remoteStreamSnapshot);
        }
      },
    );
  }, [playRemoteAudio]);

  // ─── Start Outgoing Call ──────────────────────────────────────────

  const startCall = useCallback(async (peer, conversationId, type = "voice") => {
    if (activeCallRef.current) return;

    const isVideo = type === "video";

    // 1. Try to acquire local media (returns null if no devices — that's OK)
    const stream = await webrtcService.acquireLocalMedia(isVideo);
    setLocalStreamState(stream); // null is fine

    // 2. Update Redux state
    dispatch(initiateOutgoingCall({ peer, type, conversationId }));

    // 3. Create peer connection (works with zero local tracks)
    setupPeerConnection(peer.id, type);

    try {
      // 4. Create offer and send invite
      const callId = "call-" + Date.now();
      const offer = await webrtcService.createOffer();
      console.log("[Call] Outgoing offer created, sending invite to", peer.id);
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
  }, [user, dispatch, setupPeerConnection]);

  // ─── Answer Incoming Call ─────────────────────────────────────────

  const handleAnswerCall = useCallback(async () => {
    if (!incomingCall) return;

    const isVideo = incomingCall.type === "video";

    // 1. Try to acquire local media (null is valid — receive-only)
    const stream = await webrtcService.acquireLocalMedia(isVideo);
    setLocalStreamState(stream);

    // 2. Update Redux state
    dispatch(acceptCall());

    // 3. Create peer connection WITH local tracks attached
    setupPeerConnection(incomingCall.caller.id, incomingCall.type);

    try {
      // 4. Set remote offer and create answer — this is the correct order:
      //    setRemoteDescription(offer) → createAnswer → setLocalDescription(answer)
      //    webrtcService.createAnswer handles all of this internally.
      console.log("[Call] Answering call from", incomingCall.caller.id);
      const answer = await webrtcService.createAnswer(incomingCall.sdp);
      await signalingService.sendAnswer(incomingCall.caller.id, {
        sdp: answer,
      });
      dispatch(setCallStatus("connected"));
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

    // Stop the hidden audio element
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
