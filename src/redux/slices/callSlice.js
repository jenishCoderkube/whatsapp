import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  activeCall: null, // { id, type: 'voice'|'video', status: 'outgoing'|'incoming'|'connected'|'ended', peer: { id, name, avatar }, startTime }
  callHistory: [],
  incomingCall: null, // { id, caller: { id, name, avatar } }
  isMicMuted: false,
  isVideoEnabled: true,
  isCameraFront: true,
  isSpeakerOn: true,
  permissions: {
    audio: "prompt", // 'prompt', 'granted', 'denied'
    video: "prompt",
  },
};

const callSlice = createSlice({
  name: "call",
  initialState,
  reducers: {
    setIncomingCall(state, action) {
      state.incomingCall = action.payload;
    },
    initiateOutgoingCall(state, action) {
      state.activeCall = {
        ...action.payload,
        status: "outgoing",
        startTime: null,
      };
      state.incomingCall = null;
    },
    acceptCall(state) {
      if (state.incomingCall) {
        state.activeCall = {
          ...state.incomingCall,
          peer: state.incomingCall.caller, // Map caller to peer for UI consistency
          status: "connecting",
          startTime: Date.now(),
        };
        state.incomingCall = null;
      }
    },
    setCallStatus(state, action) {
      if (state.activeCall) {
        state.activeCall.status = action.payload;
        if (action.payload === "connected" && !state.activeCall.startTime) {
          state.activeCall.startTime = Date.now();
        }
      }
    },
    endCall(state) {
      if (state.activeCall) {
        state.callHistory.push({
          ...state.activeCall,
          endTime: Date.now(),
          duration: state.activeCall.startTime ? Date.now() - state.activeCall.startTime : 0,
        });
      }
      state.activeCall = null;
      state.incomingCall = null;
      state.isMicMuted = false;
    },
    toggleMic(state) {
      state.isMicMuted = !state.isMicMuted;
    },
    toggleVideo(state) {
      state.isVideoEnabled = !state.isVideoEnabled;
    },
    switchCamera(state) {
      state.isCameraFront = !state.isCameraFront;
    },
    setAudioPermission(state, action) {
      state.permissions.audio = action.payload;
    },
    clearCallHistory(state) {
      state.callHistory = [];
    },
  },
});

export const {
  setIncomingCall,
  initiateOutgoingCall,
  acceptCall,
  setCallStatus,
  endCall,
  toggleMic,
  toggleVideo,
  switchCamera,
  setAudioPermission,
  clearCallHistory,
} = callSlice.actions;

export default callSlice.reducer;
