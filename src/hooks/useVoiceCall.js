import { useEffect, useCallback, useRef } from "react";
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

  const activeCallRef = useRef(activeCall);
  const incomingCallRef = useRef(incomingCall);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  /**
   * Log a call message to the conversation history
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
   * Handle incoming signaling messages
   */
  const handleSignal = useCallback(async (type, data) => {
    switch (type) {
      case "invite":
        if (activeCallRef.current) {
          signalingService.sendCallEnd(data.caller.id, { reason: "busy" });
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
        if (activeCallRef.current) {
          await webrtcService.addIceCandidate(data.candidate);
        }
        break;

      case "end":
        if (activeCallRef.current) {
          // If we were in a call, log it
          logCallMessage(activeCallRef.current);
          webrtcService.cleanup();
          dispatch(endCall());
        } else if (incomingCallRef.current) {
          // If we missed an incoming call
          logCallMessage(incomingCallRef.current, "missed");
          webrtcService.cleanup();
          dispatch(endCall());
        }
        break;
    }
  }, [dispatch, logCallMessage]);

  /**
   * Initialize signaling on mount
   */
  useEffect(() => {
    if (user?.id) {
      signalingService.initialize(user.id, handleSignal);
    }
    return () => signalingService.cleanup();
  }, [user?.id, handleSignal]);

  /**
   * Start an outgoing call
   */
  const startCall = async (peer, conversationId, type = "voice") => {
    try {
      const isVideo = type === "video";
      const stream = await webrtcService.getLocalStream(isVideo);
      dispatch(initiateOutgoingCall({ peer, type, conversationId }));

      webrtcService.createPeerConnection(
        (candidate) => signalingService.sendCandidate(peer.id, { candidate }),
        (remoteStream) => {
          // Streams are handled in CallOverlay component via webrtcService.remoteStream
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
      console.error("Failed to start call:", err);
      dispatch(endCall());
    }
  };

  /**
   * Answer an incoming call
   */
  const handleAnswerCall = async () => {
    if (!incomingCall) return;

    try {
      const isVideo = incomingCall.type === "video";
      const stream = await webrtcService.getLocalStream(isVideo);
      dispatch(acceptCall());

      webrtcService.createPeerConnection(
        (candidate) => signalingService.sendCandidate(incomingCall.caller.id, { candidate }),
        (remoteStream) => {
          // Handled via webrtcService
        }
      );

      const answer = await webrtcService.createAnswer(incomingCall.sdp);
      await signalingService.sendAnswer(incomingCall.caller.id, { sdp: answer });
      dispatch(setCallStatus("connected"));

    } catch (err) {
      console.error("Failed to answer call:", err);
      dispatch(endCall());
    }
  };

  /**
   * Terminate active or incoming call
   */
  const handleEndCall = () => {
    const peerId = activeCall?.peer?.id || incomingCall?.caller?.id;
    if (peerId) {
      signalingService.sendCallEnd(peerId, { reason: "ended" });
    }
    
    if (activeCall) {
      logCallMessage(activeCall);
    } else if (incomingCall) {
      logCallMessage(incomingCall, "declined");
    }

    webrtcService.cleanup();
    dispatch(endCall());
  };

  return {
    startCall,
    handleAnswerCall,
    handleEndCall,
    activeCall,
    incomingCall,
  };
};
