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
   * The onTrack callback uses a stable remoteStream reference from webrtcService
   * to prevent unnecessary React re-renders that cause video flicker.
   */
  const setupPeerConnection = useCallback((peerId, callType) => {
    webrtcService.createPeerConnection(
      // ICE candidate handler
      (candidate) => {
        if (peerId) {
          signalingService.sendCandidate(peerId, { candidate });
        }
      },
      // Remote track handler — receives the persistent remoteStream
      (remoteStreamRef) => {
        console.log("[Call] Remote stream updated, tracks:", remoteStreamRef.getTracks().length);
        setRemoteStreamState(remoteStreamRef);

        // Always ensure audio playback for voice calls
        if (callType === "voice" || remoteStreamRef.getAudioTracks().length > 0) {
          playRemoteAudio(remoteStreamRef);
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
      const offer = await webrtcService.createOffer();
      await signalingService.sendInvite(peer.id, {
        id: "call-" + Date.now(),
        caller: user,
        sdp: offer,
        conversationId,
        type,
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

    // 3. Create peer connection
    setupPeerConnection(incomingCall.caller.id, incomingCall.type);

    try {
      // 4. Create answer and send it
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
    if (peerId) {
      signalingService.sendEnd(peerId, { reason: "ended" });
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
