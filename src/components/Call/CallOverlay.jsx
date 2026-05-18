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

  // Attach local stream reactively (re-runs when camera is toggled or stream changes)
  React.useEffect(() => {
    if (isVideoEnabled && hasCamera && localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }

    // Refresh devices upon stream change to catch updated permissions
    if (localStream) {
      webrtcService.checkDevices().then((caps) => {
        setHasCamera(caps.hasCam);
        setHasMicrophone(caps.hasMic);
      });
    }
  }, [localStream, isVideoEnabled, hasCamera]);

  // Attach remote stream reactively (re-runs when remote stream track changes)
  React.useEffect(() => {
    if (!remoteVideoDisabled && remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, remoteVideoDisabled]);

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
        className="fixed inset-0 z-[100] flex flex-col bg-[#0b141a] text-white overflow-hidden select-none"
      >
        {/* Immersive Background/Video Layer (Absolute Base) */}
        <div className="absolute inset-0 z-0 bg-black">
          {isConnected && isVideoCall ? (
            <>
              {/* Remote Video (Full Screen) */}
              {!remoteVideoDisabled ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-[#0b141a]">
                  <Avatar
                    src={currentPeer?.avatar}
                    size="xl"
                    className="w-28 h-28 sm:w-36 sm:h-36 border-4 border-white/10 shadow-2xl relative mb-4"
                  />
                  <p className="text-white/60 text-sm">Video paused by peer</p>
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
                {isVideoEnabled && hasCamera ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#202c33]">
                    <Avatar src={user?.avatar} size="sm" />
                  </div>
                )}
              </motion.div>
            </>
          ) : (
            <>
              <div
                className="absolute inset-0 bg-cover bg-center scale-110 blur-3xl opacity-40 saturate-150"
                style={{ backgroundImage: `url(${currentPeer?.avatar})` }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-[#0b141a]/40 to-[#0b141a]" />
            </>
          )}
        </div>

        {/* Top UI Layer (Header) */}
        <div className="relative z-20 flex flex-col items-center pt-12 sm:pt-20 px-6 text-center pointer-events-none">
          {!isConnected || !isVideoCall ? (
            <>
              <div className="flex items-center gap-2 mb-6 opacity-60">
                <span className="text-[10px] uppercase tracking-[0.25em] font-bold">
                  WhatsApp {isVideoCall ? "Video" : "Voice"} Call
                </span>
              </div>

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

              <h1 className="text-2xl sm:text-4xl font-light mb-2 drop-shadow-lg">
                {currentPeer?.name || "WhatsApp User"}
              </h1>
            </>
          ) : (
            <div className="flex flex-col items-center gap-1 drop-shadow-2xl">
              <h2 className="text-xl sm:text-2xl font-medium flex items-center gap-2">
                {currentPeer?.name}
                {remoteMuted && (
                  <MicOff
                    className="h-4 w-4 text-red-500 animate-pulse"
                    title="Peer Muted"
                  />
                )}
              </h2>
            </div>
          )}

          <div className="h-10 flex items-center justify-center drop-shadow-md">
            {incomingCall && !activeCall ? (
              <p className="text-wa-primary font-medium animate-pulse tracking-widest text-sm uppercase">
                Incoming call...
              </p>
            ) : activeCall?.status === "outgoing" ? (
              <p className="text-wa-primary font-medium animate-pulse tracking-widest text-sm uppercase">
                Ringing...
              </p>
            ) : activeCall?.status === "connecting" ? (
              <p className="text-white/60 font-medium italic tracking-wide">
                Connecting...
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
                    Decline
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
                    Accept
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
                      onClick={() => dispatch(switchCamera())}
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
                      title={!hasCamera ? "No camera detected" : "Toggle Video"}
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
                      !hasMicrophone ? "No microphone detected" : "Toggle Mic"
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
              Encrypted
            </span>
            <div className="h-px w-8 bg-white/50" />
          </div>
        </footer>
      </motion.div>
    </AnimatePresence>
  );
};
