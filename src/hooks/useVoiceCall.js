import { useEffect, useCallback, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "../hooks/useRedux";
import { 
  setIncomingCall, 
  initiateOutgoingCall, 
  acceptCall, 
  setCallStatus, 
  endCall 
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

  const activeCallRef = useRef(null);
  const incomingCallRef = useRef(null);

  // Sync refs with state for use in callbacks
  useEffect(() => { activeCallRef.current = activeCall; }, [activeCall]);
  useEffect(() => { incomingCallRef.current = incomingCall; }, [incomingCall]);

  /**
   * Log call to chat history
   */
  const logCallMessage = useCallback(async (callData, statusOverride = null) => {
    if (!callData?.conversationId || !user?.id) return;

    const duration = callData.startTime ? Math.floor((Date.now() - callData.startTime) / 1000) : 0;
    const finalStatus = statusOverride || (duration > 0 ? "completed" : "missed");

    try {
      await messageService.sendMessage({
        conversationId: callData.conversationId,
        senderId: user.id,
        text: finalStatus === "completed" ? `Voice call (${duration}s)` : "Missed voice call",
        type: "voice_call",
        metadata: {
          callStatus: finalStatus,
          duration,
        }
      });
    } catch (err) {
      console.error("Failed to log call message:", err);
    }
  }, [user?.id]);

  /**
   * Handle Signal Events
   */
  const handleSignal = useCallback(async (type, data) => {
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
        console.log("Call ended by peer");
        if (activeCallRef.current) {
          logCallMessage(activeCallRef.current);
        } else if (incomingCallRef.current) {
          logCallMessage(incomingCallRef.current, "missed");
        }
        webrtcService.cleanup();
        setLocalStreamState(null);
        setRemoteStreamState(null);
        dispatch(endCall());
        break;

      default:
        console.warn("Unknown signal type:", type);
    }
  }, [dispatch, logCallMessage]);

  /**
   * Initialize Signaling
   */
  useEffect(() => {
    if (user?.id) {
      signalingService.initialize(user.id, handleSignal);
    }
    return () => signalingService.cleanup();
  }, [user?.id, handleSignal]);

  /**
   * Start Outgoing Call
   */
  const startCall = async (peer, conversationId, type = "voice") => {
    if (activeCall) return;

    try {
      const isVideo = type === "video";
      const stream = await webrtcService.getLocalStream(isVideo);
      setLocalStreamState(stream);
      
      dispatch(initiateOutgoingCall({ peer, type, conversationId }));

      webrtcService.createPeerConnection(
        (candidate) => {
          if (peer.id) signalingService.sendCandidate(peer.id, { candidate });
        },
        (remoteStream) => {
          setRemoteStreamState(remoteStream);
          // Play remote audio automatically for voice calls
          if (type === "voice") {
            const audio = new Audio();
            audio.srcObject = remoteStream;
            audio.play().catch(e => console.warn("Audio autoplay failed:", e));
          }
        }
      );

      const offer = await webrtcService.createOffer();
      await signalingService.sendInvite(peer.id, {
        id: "call-" + Date.now(),
        caller: user,
        sdp: offer,
        conversationId,
        type,
      });

    } catch (err) {
      console.error("Failed to initiate call:", err);
      webrtcService.cleanup();
      setLocalStreamState(null);
      dispatch(endCall());
    }
  };

  /**
   * Answer Incoming Call
   */
  const handleAnswerCall = async () => {
    if (!incomingCall) return;

    try {
      const isVideo = incomingCall.type === "video";
      const stream = await webrtcService.getLocalStream(isVideo);
      setLocalStreamState(stream);
      
      dispatch(acceptCall());

      webrtcService.createPeerConnection(
        (candidate) => {
          if (incomingCall.caller.id) signalingService.sendCandidate(incomingCall.caller.id, { candidate });
        },
        (remoteStream) => {
          setRemoteStreamState(remoteStream);
          if (incomingCall.type === "voice") {
            const audio = new Audio();
            audio.srcObject = remoteStream;
            audio.play().catch(e => console.warn("Audio autoplay failed:", e));
          }
        }
      );

      const answer = await webrtcService.createAnswer(incomingCall.sdp);
      await signalingService.sendAnswer(incomingCall.caller.id, { sdp: answer });
      dispatch(setCallStatus("connected"));

    } catch (err) {
      console.error("Failed to answer call:", err);
      webrtcService.cleanup();
      setLocalStreamState(null);
      dispatch(endCall());
    }
  };

  /**
   * End Call
   */
  const handleEndCall = () => {
    const peerId = activeCall?.peer?.id || incomingCall?.caller?.id;
    if (peerId) {
      signalingService.sendEnd(peerId, { reason: "ended" });
    }
    
    if (activeCall) {
      logCallMessage(activeCall);
    } else if (incomingCall) {
      logCallMessage(incomingCall, "declined");
    }

    webrtcService.cleanup();
    setLocalStreamState(null);
    setRemoteStreamState(null);
    dispatch(endCall());
  };

  /**
   * Cleanup on Unmount
   */
  useEffect(() => {
    const handleUnload = () => {
      const peerId = activeCallRef.current?.peer?.id || incomingCallRef.current?.caller?.id;
      if (peerId) {
        signalingService.sendEnd(peerId, { reason: "disconnected" });
      }
      webrtcService.cleanup();
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, []);

  return {
    startCall,
    handleAnswerCall,
    handleEndCall,
    activeCall,
    incomingCall,
    localStream,
    remoteStream
  };
};
