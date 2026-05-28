import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  Video,
  VideoOff,
  RotateCcw,
} from "lucide-react";
import { useVoiceCall } from "../../hooks/useVoiceCall";
import { useAppSelector, useAppDispatch } from "../../hooks/useRedux";
import { useTranslation } from "../../hooks/useTranslation";
import {
  toggleMic,
  toggleVideo,
  switchCamera,
} from "../../redux/slices/callSlice";
import { Avatar } from "../ui/Avatar";
import { CallTimer } from "./CallTimer";
import { cn } from "../../utils/cn";
import { webrtcService } from "../../services/webrtcService";
import { signalingService } from "../../services/signalingService";

export const CallOverlay = () => {
  const {
    activeCall,
    incomingCall,
    handleAnswerCall,
    handleEndCall,
    localStream,
    remoteStream,
  } = useVoiceCall();

  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const user = useAppSelector((state) => state.auth.user);

  // Real-time peer control states from Redux
  const isMicMuted = useAppSelector((state) => state.call.isMicMuted);
  const isVideoEnabled = useAppSelector((state) => state.call.isVideoEnabled);
  const remoteMuted = useAppSelector((state) => state.call.remoteMuted);
  const remoteVideoDisabled = useAppSelector(
    (state) => state.call.remoteVideoDisabled,
  );

  const [isMounted, setIsMounted] = React.useState(false);
  const [hasCamera, setHasCamera] = React.useState(true);
  const [hasMicrophone, setHasMicrophone] = React.useState(true);

  const localVideoRef = React.useRef(null);
  const remoteVideoRef = React.useRef(null);
  // Hidden audio element for voice-only call playback
  const remoteAudioRef = React.useRef(null);
  const containerRef = React.useRef(null);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // Check hardware device capabilities on mount and on media device change
  React.useEffect(() => {
    async function checkCapabilities() {
      const caps = await webrtcService.checkDevices();
      setHasCamera(caps.hasCam);
      setHasMicrophone(caps.hasMic);
    }

    checkCapabilities();

    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener(
        "devicechange",
        checkCapabilities,
      );
      return () => {
        navigator.mediaDevices.removeEventListener(
          "devicechange",
          checkCapabilities,
        );
      };
    }
  }, []);

  // Attach local stream reactively with explicit play() for reliable rendering
  React.useEffect(() => {
    const el = localVideoRef.current;
    if (el) {
      if (localStream) {
        // Only reassign if different to avoid interrupting playback
        if (el.srcObject !== localStream) {
          el.srcObject = localStream;
          el.play().catch((e) => console.warn("[CallUI] Local video play failed:", e));
        }
        console.log("[CallUI] Local stream attached:", localStream.getTracks().map(t => `${t.kind}:${t.enabled}:${t.readyState}`));
      } else {
        el.srcObject = null;
      }
    }

    // Refresh device capabilities whenever stream state changes
    webrtcService.checkDevices().then((caps) => {
      setHasCamera(caps.hasCam);
      setHasMicrophone(caps.hasMic);
    });
  }, [localStream]);

  // CRITICAL FIX: Attach remote stream to BOTH the visible <video> element
  // AND the hidden <audio> element for guaranteed playback.
  // The remote stream is a NEW MediaStream snapshot each time ontrack fires,
  // so this effect re-runs and re-attaches correctly.
  React.useEffect(() => {
    // Attach to visible video element
    const videoEl = remoteVideoRef.current;
    if (videoEl) {
      if (remoteStream) {
        videoEl.srcObject = remoteStream;
        videoEl.muted = false;
        videoEl.volume = 1.0;
        videoEl.play().catch((e) => console.warn("[CallUI] Remote video play failed:", e));
        console.log("[CallUI] Remote stream attached to <video>:", remoteStream.getTracks().map(t => `${t.kind}:${t.enabled}:${t.readyState}:muted=${t.muted}`));
      } else {
        videoEl.srcObject = null;
      }
    }

    // ALWAYS attach to hidden audio element as well (guarantees audio for voice-only calls)
    const audioEl = remoteAudioRef.current;
    if (audioEl) {
      if (remoteStream && remoteStream.getAudioTracks().length > 0) {
        audioEl.srcObject = remoteStream;
        audioEl.play().catch((e) => console.warn("[CallUI] Remote audio play failed:", e));
        console.log("[CallUI] Remote audio stream attached to hidden <audio>");
      } else if (audioEl.srcObject) {
        audioEl.srcObject = null;
      }
    }
  }, [remoteStream]);

  // Periodic debug logging during active calls
  React.useEffect(() => {
    if (!activeCall || activeCall.status !== "connected") return;
    const debugTimer = setInterval(() => {
      webrtcService.getDebugInfo();
    }, 5000);
    return () => clearInterval(debugTimer);
  }, [activeCall?.status]);

  if (!isMounted) return null;
  if (!activeCall && !incomingCall) return null;

  const currentPeer = activeCall?.peer || incomingCall?.caller;
  const isVideoCall =
    activeCall?.type === "video" || incomingCall?.type === "video";
  const isConnected = activeCall?.status === "connected";

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex flex-col bg-[#0a1014] text-white overflow-hidden select-none"
      >
        {/* Hidden audio element — ALWAYS mounted for guaranteed remote audio playback */}
        {/* This is the safety net: even if the <video> can't autoplay, audio still works */}
        <audio
          ref={remoteAudioRef}
          autoPlay
          playsInline
          style={{ position: "absolute", width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
        />

        {/* Immersive Background/Video Layer (Absolute Base) */}
        <div className="absolute inset-0 z-0 bg-black">
          {isVideoCall ? (
            <>
              {/* Remote Video (Full Screen) - ALWAYS mounted so tracks can attach
                  even before "connected" status, preventing the black-screen race */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className={cn(
                  "w-full h-full object-cover transition-all duration-500",
                  (remoteVideoDisabled || !isConnected) ? "opacity-0 absolute pointer-events-none scale-95" : "opacity-100 scale-100"
                )}
              />

              {/* Remote Avatar Fallback Layer when video is paused/disabled by peer or not yet connected */}
              {(remoteVideoDisabled || !isConnected) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a1014] z-10 transition-opacity duration-300">
                  <Avatar
                    src={currentPeer?.avatar}
                    size="xl"
                    className="w-28 h-28 sm:w-36 sm:h-36 border-4 border-white/10 shadow-2xl relative mb-4"
                  />
                  {isConnected && remoteVideoDisabled && (
                    <p className="text-white/60 text-sm">{t("call.video_paused")}</p>
                  )}
                </div>
              )}

              {/* Local Video (PIP) - Draggable and always bounded inside the viewport */}
              <motion.div
                drag
                dragConstraints={containerRef}
                dragElastic={0.1}
                dragMomentum={false}
                className="absolute top-6 right-6 w-28 sm:w-36 h-40 sm:h-48 bg-black rounded-2xl overflow-hidden border border-white/20 shadow-2xl z-40 cursor-move ring-1 ring-black/50"
              >
                {/* Local Video Tag - Persistently mounted to hold hardware track configurations */}
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={cn(
                    "w-full h-full object-cover scale-x-[-1] transition-all duration-300",
                    (isVideoEnabled && hasCamera && localStream) ? "opacity-100 scale-100" : "opacity-0 absolute pointer-events-none scale-95"
                  )}
                />

                {/* Local Avatar Fallback when camera is disabled or missing */}
                {(!isVideoEnabled || !hasCamera || !localStream) && (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-[#202c33] gap-1 transition-opacity duration-300">
                    <Avatar src={user?.avatar} size="sm" />
                    {!localStream && (
                      <span className="text-[9px] text-white/40 uppercase tracking-wider">
                        {t("call.receive_only")}
                      </span>
                    )}
                  </div>
                )}
              </motion.div>
            </>
          ) : (
            <>
              {/* Voice call background — remote video element is still mounted but hidden
                  so audio can play through it as a fallback */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                style={{ position: "absolute", width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
              />
              <div
                className="absolute inset-0 bg-cover bg-center scale-110 blur-3xl opacity-40 saturate-150"
                style={{ backgroundImage: `url(${currentPeer?.avatar})` }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-[#0a1014]/40 to-[#0a1014]" />
            </>
          )}
        </div>

        {/* Top UI Layer (Header) */}
        <div className="relative z-20 flex flex-col items-center pt-12 sm:pt-20 px-6 text-center pointer-events-none">
          {!isConnected || !isVideoCall ? (
            <>
              <div className="flex items-center gap-2 mb-6 opacity-60">
                <span className="text-[10px] uppercase tracking-[0.25em] font-bold">
                  WhatsApp {isVideoCall ? t("call.video") : t("call.voice")} Call
                </span>
              </div>

              {!isVideoCall && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="relative mb-8"
                >
                  <div className="absolute inset-0 bg-wa-primary/10 rounded-full scale-125 animate-pulse" />
                  <Avatar
                    src={currentPeer?.avatar}
                    size="xl"
                    className="w-28 h-28 sm:w-36 sm:h-36 border-4 border-white/10 shadow-2xl relative z-10"
                  />
                </motion.div>
              )}

              <h1 className="text-2xl sm:text-4xl font-light mb-2 drop-shadow-lg">
                {currentPeer?.name || t("call.whatsapp_user")}
              </h1>
            </>
          ) : (
            <div className="flex flex-col items-center gap-1 drop-shadow-2xl">
              <h2 className="text-xl sm:text-2xl font-medium flex items-center gap-2">
                {currentPeer?.name}
                {remoteMuted && (
                  <MicOff
                    className="h-4 w-4 text-red-500 animate-pulse"
                    title={t("call.peer_muted")}
                  />
                )}
              </h2>
            </div>
          )}

          <div className="h-10 flex items-center justify-center drop-shadow-md">
            {incomingCall && !activeCall ? (
              <p className="text-wa-primary font-medium animate-pulse tracking-widest text-sm uppercase">
                {t("call.incoming_call_dots")}
              </p>
            ) : activeCall?.status === "outgoing" ? (
              <p className="text-wa-primary font-medium animate-pulse tracking-widest text-sm uppercase">
                {t("call.ringing")}
              </p>
            ) : activeCall?.status === "connecting" ? (
              <p className="text-white/60 font-medium italic tracking-wide">
                {t("call.connecting")}
              </p>
            ) : (
              <CallTimer startTime={activeCall?.startTime} isActive={true} />
            )}
          </div>
        </div>

        {/* Middle Spacer */}
        <div className="flex-1" />

        {/* Bottom UI Layer (Controls) */}
        <footer
          className={cn(
            "relative z-30 pb-12 sm:pb-20 px-6 transition-all duration-500",
            isConnected && isVideoCall
              ? "bg-gradient-to-t from-black/80 via-black/40 to-transparent"
              : "",
          )}
        >
          <div className="max-w-md mx-auto">
            {incomingCall && !activeCall ? (
              <div className="flex items-center justify-around">
                <button
                  onClick={handleEndCall}
                  className="group flex flex-col items-center gap-4"
                >
                  <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-[#ff4b4b] flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                    <PhoneOff className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-white/50">
                    {t("call.decline")}
                  </span>
                </button>

                <button
                  onClick={handleAnswerCall}
                  className="group flex flex-col items-center gap-4"
                >
                  <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-wa-primary flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                    {isVideoCall ? (
                      <Video className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
                    ) : (
                      <Phone className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
                    )}
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-white/50">
                    {t("call.accept")}
                  </span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-10">
                <div className="flex items-center justify-between w-full max-w-[340px] bg-black/20 backdrop-blur-xl rounded-full p-2 border border-white/5 shadow-2xl">
                  {/* Camera Switch */}
                  {isVideoCall && (
                    <button
                      disabled={!hasCamera}
                      onClick={async () => {
                        dispatch(switchCamera());
                        await webrtcService.switchCamera();
                        // Update local stream state after camera switch
                        if (webrtcService.localStream) {
                          const el = localVideoRef.current;
                          if (el) {
                            el.srcObject = webrtcService.localStream;
                            el.play().catch(() => {});
                          }
                        }
                      }}
                      className={cn(
                        "h-14 w-14 rounded-full text-white flex items-center justify-center hover:bg-white/10 transition-all",
                        !hasCamera && "opacity-30 cursor-not-allowed",
                      )}
                    >
                      <RotateCcw className="h-6 w-6" />
                    </button>
                  )}

                  {/* Video Toggle */}
                  {isVideoCall && (
                    <button
                      disabled={!hasCamera}
                      onClick={() => {
                        const nextVideoState = !isVideoEnabled;
                        dispatch(toggleVideo());
                        webrtcService.toggleVideo(nextVideoState);
                        const peerId = activeCall?.peer?.id;
                        if (peerId) {
                          signalingService.sendVideoStatus(peerId, {
                            isVideoEnabled: nextVideoState,
                          });
                        }
                      }}
                      className={cn(
                        "h-14 w-14 rounded-full flex items-center justify-center transition-all",
                        !hasCamera
                          ? "opacity-30 cursor-not-allowed bg-gray-800"
                          : !isVideoEnabled
                            ? "bg-white text-black"
                            : "text-white hover:bg-white/10",
                      )}
                      title={!hasCamera ? t("call.no_camera_detected") : t("call.toggle_video")}
                    >
                      {isVideoEnabled && hasCamera ? (
                        <Video className="h-6 w-6" />
                      ) : (
                        <VideoOff className="h-6 w-6" />
                      )}
                    </button>
                  )}

                  {/* Audio Mic Toggle */}
                  <button
                    disabled={!hasMicrophone}
                    onClick={() => {
                      const nextMicState = !isMicMuted;
                      dispatch(toggleMic());
                      webrtcService.toggleAudio(!nextMicState);
                      const peerId = activeCall?.peer?.id;
                      if (peerId) {
                        signalingService.sendMuteStatus(peerId, {
                          isMuted: nextMicState,
                        });
                      }
                    }}
                    className={cn(
                      "h-14 w-14 rounded-full flex items-center justify-center transition-all",
                      !hasMicrophone
                        ? "opacity-30 cursor-not-allowed bg-gray-800"
                        : isMicMuted
                          ? "bg-white text-black"
                          : "text-white hover:bg-white/10",
                    )}
                    title={
                      !hasMicrophone ? t("call.no_microphone_detected") : t("call.toggle_mic")
                    }
                  >
                    {isMicMuted || !hasMicrophone ? (
                      <MicOff className="h-6 w-6" />
                    ) : (
                      <Mic className="h-6 w-6" />
                    )}
                  </button>

                  <button className="h-14 w-14 rounded-full text-white flex items-center justify-center hover:bg-white/10 transition-all">
                    <Volume2 className="h-6 w-6" />
                  </button>
                </div>

                <button
                  onClick={handleEndCall}
                  className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-[#ff4b4b] flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all"
                >
                  <PhoneOff className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
                </button>
              </div>
            )}
          </div>

          <div className="mt-10 flex items-center justify-center gap-2 opacity-30 pointer-events-none">
            <div className="h-px w-8 bg-white/50" />
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold">
              {t("call.encrypted")}
            </span>
            <div className="h-px w-8 bg-white/50" />
          </div>
        </footer>
      </motion.div>
    </AnimatePresence>
  );
};
