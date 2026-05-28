/**
 * webrtcService.js — Production WebRTC Media Engine
 *
 * ARCHITECTURE:
 *  1. RTCPeerConnection is INDEPENDENT of local media
 *  2. Local tracks attached OPTIONALLY after PC creation
 *  3. Media controls ONLY toggle track.enabled — NEVER touch PC
 *  4. ICE candidate queue is PRESERVED across PC creation (critical for callee)
 *  5. Remote stream snapshots force React re-renders
 *  6. TURN servers included for mobile NAT traversal
 */

const ICE_SERVERS = {
  iceServers: [
    // STUN — discovers your public IP
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
      ],
    },
    // TURN — relays media when direct P2P fails (mobile NAT, firewalls)
    // These are free community servers. Replace with your own for production.
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
  iceCandidatePoolSize: 10,
};

class WebRTCService {
  constructor() {
    this.pc = null;
    this.localStream = null;
    this.remoteStream = null;
    this.candidatesQueue = [];
    this.onConnectionStateChange = null;
    this.onTrack = null;
    this._isNegotiating = false;
  }

  // ─── Device Detection ───────────────────────────────────────────────

  async getPermissionStatus() {
    const result = { audio: "prompt", video: "prompt" };
    try {
      if (navigator.permissions?.query) {
        try {
          const mic = await navigator.permissions.query({ name: "microphone" });
          result.audio = mic.state;
        } catch (_) {}
        try {
          const cam = await navigator.permissions.query({ name: "camera" });
          result.video = cam.state;
        } catch (_) {}
      }
    } catch (_) {}
    return result;
  }

  async checkDevices() {
    const permissions = await this.getPermissionStatus();
    try {
      if (!navigator.mediaDevices?.enumerateDevices) {
        return { hasMic: false, hasCam: false };
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((d) => d.kind === "audioinput");
      const videoInputs = devices.filter((d) => d.kind === "videoinput");

      const hasMic = permissions.audio === "denied" ? false
        : permissions.audio === "prompt" ? true
        : audioInputs.length > 0;

      const hasCam = permissions.video === "denied" ? false
        : permissions.video === "prompt" ? true
        : videoInputs.length > 0;

      return { hasMic, hasCam };
    } catch (e) {
      console.warn("[WebRTC] Device check failed:", e);
      return { hasMic: true, hasCam: true };
    }
  }

  // ─── Local Media ────────────────────────────────────────────────────

  async acquireLocalMedia(withVideo = false) {
    if (this.localStream) {
      const hasVideoTrack = this.localStream.getVideoTracks().length > 0;
      if (withVideo && !hasVideoTrack) {
        this.stopLocalStream();
      } else {
        return this.localStream;
      }
    }

    const { hasMic, hasCam } = await this.checkDevices();
    const wantAudio = hasMic;
    const wantVideo = withVideo && hasCam;

    if (!wantAudio && !wantVideo) {
      console.log("[WebRTC] No media devices. Receive-only mode.");
      this.localStream = null;
      return null;
    }

    const constraints = {
      audio: wantAudio
        ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        : false,
      video: wantVideo
        ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }
        : false,
    };

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("[WebRTC] Local media acquired:",
        this.localStream.getTracks().map(t => `${t.kind}:${t.label}:enabled=${t.enabled}`));
      return this.localStream;
    } catch (err) {
      console.warn("[WebRTC] getUserMedia error:", err.name, err.message);
      if (wantVideo) {
        return this.acquireLocalMedia(false); // fallback to audio-only
      }
      this.localStream = null;
      return null;
    }
  }

  // ─── Peer Connection ────────────────────────────────────────────────
  //
  // CRITICAL: candidatesQueue is PRESERVED across PC creation.
  // The callee receives ICE candidates before answering. These must
  // survive the cleanupPC → createPeerConnection cycle.

  createPeerConnection(onIceCandidate, onTrack) {
    // Save any candidates that arrived before PC existed
    const preservedCandidates = [...this.candidatesQueue];

    this.cleanupPC();
    this.onTrack = onTrack;
    this._isNegotiating = false;

    // Restore candidates that were queued before this PC was created
    this.candidatesQueue = preservedCandidates;
    if (preservedCandidates.length > 0) {
      console.log(`[WebRTC] Preserved ${preservedCandidates.length} ICE candidates from before PC creation`);
    }

    console.log("[WebRTC] Creating RTCPeerConnection...");
    this.pc = new RTCPeerConnection(ICE_SERVERS);
    this.remoteStream = new MediaStream();

    // Attach local tracks if available
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        console.log(`[WebRTC] Adding local ${track.kind} track to PC`);
        this.pc.addTrack(track, this.localStream);
      });
    }

    // ─── ICE Candidates ───────────────────────────────────────────
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        onIceCandidate(event.candidate);
      }
    };

    this.pc.onicegatheringstatechange = () => {
      console.log("[WebRTC] ICE gathering state →", this.pc?.iceGatheringState);
    };

    // ─── Connection State ─────────────────────────────────────────
    // ONLY "connected" and "failed" are propagated.
    // "disconnected" is transient and recovers automatically.
    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState;
      console.log("[WebRTC] Connection state →", state);
      if (this.onConnectionStateChange) {
        if (state === "connected") {
          this.onConnectionStateChange("connected");
        } else if (state === "failed") {
          this.onConnectionStateChange("failed");
        }
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      console.log("[WebRTC] ICE state →", this.pc?.iceConnectionState);
    };

    this.pc.onsignalingstatechange = () => {
      console.log("[WebRTC] Signaling state →", this.pc?.signalingState);
      this._isNegotiating = this.pc?.signalingState !== "stable";
    };

    // ─── Remote Tracks ────────────────────────────────────────────
    // When a remote track arrives, add it to remoteStream and notify
    // the UI with a NEW MediaStream snapshot (forces React re-render).
    this.pc.ontrack = (event) => {
      console.log(`[WebRTC] ★ Remote track: ${event.track.kind}, id=${event.track.id}, readyState=${event.track.readyState}`);

      const existing = this.remoteStream.getTracks().find(t => t.id === event.track.id);
      if (!existing) {
        this.remoteStream.addTrack(event.track);
      }

      // Re-notify when track actually starts flowing
      event.track.onunmute = () => {
        console.log(`[WebRTC] Remote ${event.track.kind} unmuted — media flowing`);
        this._notifyRemoteStream();
      };

      this._notifyRemoteStream();
    };

    return this.pc;
  }

  /** Create a new MediaStream snapshot to force React re-render */
  _notifyRemoteStream() {
    if (this.onTrack && this.remoteStream) {
      const snapshot = new MediaStream(this.remoteStream.getTracks());
      this.onTrack(snapshot);
    }
  }

  // ─── SDP Negotiation ────────────────────────────────────────────────

  async createOffer() {
    if (!this.pc) return null;
    const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await this.pc.setLocalDescription(offer);
    console.log("[WebRTC] Offer created");
    return offer;
  }

  async createAnswer(offerSdp) {
    if (!this.pc) return null;
    await this.pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    this.processQueuedCandidates();
    console.log("[WebRTC] Answer created");
    return answer;
  }

  async setRemoteAnswer(answerSdp) {
    if (!this.pc) return;
    if (this.pc.signalingState !== "have-local-offer") {
      console.warn("[WebRTC] setRemoteAnswer: wrong state", this.pc.signalingState);
      return;
    }
    await this.pc.setRemoteDescription(new RTCSessionDescription(answerSdp));
    this.processQueuedCandidates();
    console.log("[WebRTC] Remote answer set");
  }

  // ─── ICE Candidate Queue ────────────────────────────────────────────

  async addIceCandidate(candidate) {
    if (!this.pc || !this.pc.remoteDescription || !this.pc.localDescription) {
      this.candidatesQueue.push(candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(candidate);
    } catch (e) {
      console.warn("[WebRTC] ICE candidate add failed:", e);
    }
  }

  processQueuedCandidates() {
    if (!this.pc || !this.pc.remoteDescription || !this.pc.localDescription) return;
    const count = this.candidatesQueue.length;
    if (count > 0) {
      console.log(`[WebRTC] Draining ${count} queued ICE candidates`);
    }
    while (this.candidatesQueue.length > 0) {
      const candidate = this.candidatesQueue.shift();
      this.pc.addIceCandidate(candidate)
        .catch(e => console.warn("[WebRTC] Queued ICE add failed:", e));
    }
  }

  // ─── Media Controls (NEVER touch peer connection) ───────────────────

  toggleAudio(enabled) {
    if (!this.localStream) return;
    this.localStream.getAudioTracks().forEach(t => {
      t.enabled = enabled;
      console.log(`[WebRTC] Audio: enabled=${enabled}`);
    });
  }

  toggleVideo(enabled) {
    if (!this.localStream) return;
    this.localStream.getVideoTracks().forEach(t => {
      t.enabled = enabled;
      console.log(`[WebRTC] Video: enabled=${enabled}`);
    });
  }

  async switchCamera() {
    if (!this.pc || !this.localStream) return;
    const currentTrack = this.localStream.getVideoTracks()[0];
    if (!currentTrack) return;

    const settings = currentTrack.getSettings();
    const newFacing = settings.facingMode === "user" ? "environment" : "user";

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      const newTrack = newStream.getVideoTracks()[0];
      const sender = this.pc.getSenders().find(s => s.track?.kind === "video");
      if (sender) {
        await sender.replaceTrack(newTrack);
      }
      currentTrack.stop();
      this.localStream.removeTrack(currentTrack);
      this.localStream.addTrack(newTrack);
      console.log("[WebRTC] Camera switched");
    } catch (e) {
      console.warn("[WebRTC] Camera switch failed:", e);
    }
  }

  // ─── Diagnostics ────────────────────────────────────────────────────

  getDebugInfo() {
    return {
      pcState: this.pc?.connectionState || "no-pc",
      iceState: this.pc?.iceConnectionState || "no-pc",
      signalingState: this.pc?.signalingState || "no-pc",
      localTracks: this.localStream?.getTracks().map(t => ({
        kind: t.kind, enabled: t.enabled, readyState: t.readyState,
      })) || [],
      remoteTracks: this.remoteStream?.getTracks().map(t => ({
        kind: t.kind, enabled: t.enabled, readyState: t.readyState, muted: t.muted,
      })) || [],
      senders: this.pc?.getSenders().map(s => ({
        kind: s.track?.kind || "null", enabled: s.track?.enabled,
      })) || [],
      receivers: this.pc?.getReceivers().map(r => ({
        kind: r.track?.kind || "null", enabled: r.track?.enabled, muted: r.track?.muted,
      })) || [],
    };
  }

  // ─── Cleanup ────────────────────────────────────────────────────────

  stopLocalStream() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
  }

  cleanupPC() {
    if (this.pc) {
      this.pc.ontrack = null;
      this.pc.onicecandidate = null;
      this.pc.onconnectionstatechange = null;
      this.pc.oniceconnectionstatechange = null;
      this.pc.onsignalingstatechange = null;
      this.pc.onicegatheringstatechange = null;
      this.pc.onnegotiationneeded = null;
      try { this.pc.close(); } catch (_) {}
      this.pc = null;
    }
    this.remoteStream = null;
    // NOTE: candidatesQueue is NOT cleared here. 
    // It's preserved so the callee doesn't lose pre-answer candidates.
    this._isNegotiating = false;
  }

  cleanup() {
    this.stopLocalStream();
    this.cleanupPC();
    this.candidatesQueue = []; // Only clear queue on full cleanup (call ended)
  }
}

export const webrtcService = new WebRTCService();
