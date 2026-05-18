import { useEffect, useState } from "react";
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

  // Sync hook stream state with webrtcService values
  useEffect(() => {
    const streamSyncTimer = setInterval(() => {
      if (webrtcService.localStream !== localStream) {
        setLocalStreamState(webrtcService.localStream);
      }
      if (webrtcService.remoteStream !== remoteStream) {
        setRemoteStreamState(webrtcService.remoteStream);
      }
    }, 300);

    return () => clearInterval(streamSyncTimer);
  }, [localStream, remoteStream]);

  /**
   * Log call to conversation history
   */
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
      console.error("Failed to log call message:", err);
    }
  };

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
