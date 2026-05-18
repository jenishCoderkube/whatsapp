/**
 * webrtcService.js
 *
 * Production-grade WebRTC engine decoupled from media devices.
 *
 * KEY ARCHITECTURE:
 *   RTCPeerConnection is created INDEPENDENTLY of local media.
 *   Local tracks are attached OPTIONALLY after the connection exists.
 *   If no mic/camera exists, the call still connects in receive-only mode
 *   — exactly like Google Meet, WhatsApp, and Discord.
 */

const servers = {
  iceServers: [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
        "stun:stun3.l.google.com:19302",
        "stun:stun4.l.google.com:19302",
      ],
    },
  ],
  iceCandidatePoolSize: 10,
};

class WebRTCService {
  constructor() {
    this.pc = null;
    this.localStream = null; // null means no local media — NOT a broken stream
    this.remoteStream = null;
    this.candidatesQueue = [];
    this.onConnectionStateChange = null;
    this.onTrack = null;
  }

  // ─── Device Detection ───────────────────────────────────────────────

  /**
   * Query browser permission states for mic/camera.
   * Returns { audio: 'granted'|'denied'|'prompt', video: ... }
   */
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
    console.log("[WebRTC] Permission status:", result);
    return result;
  }

  /**
   * Check what hardware is physically available.
   * Permission-aware: if permission is still "prompt" we assume the device
   * exists (browsers hide device labels before permission is granted).
   */
  async checkDevices() {
    const permissions = await this.getPermissionStatus();

    try {
      if (!navigator.mediaDevices?.enumerateDevices) {
        return { hasMic: false, hasCam: false };
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      console.log(
        "[WebRTC] Enumerated devices:",
        devices.map((d) => ({
          kind: d.kind,
          label: d.label || "(unlabeled)",
          id: d.deviceId?.substring(0, 8),
        })),
      );

      const audioInputs = devices.filter((d) => d.kind === "audioinput");
      const videoInputs = devices.filter((d) => d.kind === "videoinput");

      // If permission is "prompt", browsers may report 0 devices —
      // but the hardware likely exists. Assume true so the user can
      // trigger the permission dialog.
      const hasMic =
        permissions.audio === "denied"
          ? false
          : permissions.audio === "prompt"
            ? true
            : audioInputs.length > 0;

      const hasCam =
        permissions.video === "denied"
          ? false
          : permissions.video === "prompt"
            ? true
            : videoInputs.length > 0;

      console.log(
        `[WebRTC] Device check → hasMic=${hasMic} (${audioInputs.length} inputs), hasCam=${hasCam} (${videoInputs.length} inputs)`,
      );
      return { hasMic, hasCam };
    } catch (e) {
      console.warn("[WebRTC] Device check failed, assuming available:", e);
      return { hasMic: true, hasCam: true };
    }
  }

  // ─── Local Media Acquisition (Optional) ─────────────────────────────

  /**
   * Try to acquire local media. Returns the stream if successful, or null
   * if no devices / permission denied. NEVER throws, NEVER creates a fake
   * empty MediaStream.
   *
   * The peer connection works perfectly fine with localStream = null.
   */
  async acquireLocalMedia(withVideo = false) {
    // If we already have a valid stream, reuse it (unless upgrading to video)
    if (this.localStream) {
      const hasVideoTrack = this.localStream.getVideoTracks().length > 0;
      if (withVideo && !hasVideoTrack) {
        this.stopLocalStream();
      } else {
        console.log("[WebRTC] Reusing existing local stream.");
        return this.localStream;
      }
    }

    const { hasMic, hasCam } = await this.checkDevices();
    const wantAudio = hasMic;
    const wantVideo = withVideo && hasCam;

    // If truly no devices and permissions denied → receive-only mode
    if (!wantAudio && !wantVideo) {
      console.log(
        "[WebRTC] No media devices available. Call will connect in receive-only mode.",
      );
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

    console.log("[WebRTC] getUserMedia constraints:", constraints);

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log(
        "[WebRTC] Local stream acquired:",
        this.localStream.getTracks().map((t) => ({
          kind: t.kind,
          label: t.label,
          enabled: t.enabled,
        })),
      );
      return this.localStream;
    } catch (err) {
      console.warn("[WebRTC] getUserMedia error:", err.name, err.message);

      // If video request failed, fall back to audio-only
      if (wantVideo) {
        console.log("[WebRTC] Falling back to audio-only...");
        return this.acquireLocalMedia(false);
      }

      // Audio also failed → receive-only mode (no fake streams)
      console.log(
        "[WebRTC] Media acquisition failed entirely. Proceeding in receive-only mode.",
      );
      this.localStream = null;
      return null;
    }
  }

  // ─── Peer Connection (Decoupled from Media) ─────────────────────────

  /**
   * Create RTCPeerConnection. This works with ZERO local tracks.
   * Local tracks are attached only if available.
   */
  createPeerConnection(onIceCandidate, onTrack) {
    this.cleanupPC();
    this.onTrack = onTrack;

    console.log("[WebRTC] Creating RTCPeerConnection (media-independent)...");
    this.pc = new RTCPeerConnection(servers);

    // Attach local tracks IF they exist — otherwise recv-only is fine
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        console.log(
          `[WebRTC] Adding local track: kind=${track.kind}, label=${track.label}`,
        );
        this.pc.addTrack(track, this.localStream);
      });
    } else {
      console.log(
        "[WebRTC] No local tracks to attach — peer connection is receive-only.",
      );
    }

    // ICE Candidates
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        onIceCandidate(event.candidate);
      }
    };

    // Connection State
    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState;
      console.log("[WebRTC] Connection state →", state);
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(state);
      }
    };

    // ICE Connection State (more granular than connectionState)
    this.pc.oniceconnectionstatechange = () => {
      console.log(
        "[WebRTC] ICE connection state →",
        this.pc?.iceConnectionState,
      );
    };

    // Remote Tracks
    this.pc.ontrack = (event) => {
      console.log(
        `[WebRTC] Remote track arrived: kind=${event.track.kind}, id=${event.track.id}`,
      );
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }

      if (
        !this.remoteStream.getTracks().find((t) => t.id === event.track.id)
      ) {
        this.remoteStream.addTrack(event.track);
      }

      // Instantiate a fresh MediaStream reference with all tracks to guarantee
      // that React detects the reference change and binds elements correctly.
      const freshStreamRef = new MediaStream(this.remoteStream.getTracks());

      if (this.onTrack) {
        this.onTrack(freshStreamRef);
      }
    };

    return this.pc;
  }

  // ─── SDP Negotiation ────────────────────────────────────────────────

  async createOffer() {
    if (!this.pc) throw new Error("PeerConnection not initialized");
    console.log("[WebRTC] Creating offer...");
    const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await this.pc.setLocalDescription(offer);
    return offer;
  }

  async createAnswer(offerSdp) {
    if (!this.pc) throw new Error("PeerConnection not initialized");
    console.log("[WebRTC] Creating answer...");
    await this.pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
    this.processQueuedCandidates();
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return answer;
  }

  async setRemoteAnswer(answerSdp) {
    if (!this.pc) throw new Error("PeerConnection not initialized");
    console.log("[WebRTC] Setting remote answer...");
    await this.pc.setRemoteDescription(new RTCSessionDescription(answerSdp));
    this.processQueuedCandidates();
  }

  // ─── ICE Candidate Queue ────────────────────────────────────────────

  async addIceCandidate(candidate) {
    if (!this.pc || !this.pc.remoteDescription) {
      this.candidatesQueue.push(candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.warn("[WebRTC] Failed to add ICE candidate:", e);
    }
  }

  processQueuedCandidates() {
    if (!this.pc || !this.pc.remoteDescription) return;
    console.log(
      `[WebRTC] Draining ${this.candidatesQueue.length} queued ICE candidates...`,
    );
    while (this.candidatesQueue.length > 0) {
      const candidate = this.candidatesQueue.shift();
      this.pc
        .addIceCandidate(new RTCIceCandidate(candidate))
        .catch((e) => console.warn("[WebRTC] Queued ICE add failed:", e));
    }
  }

  // ─── Media Controls ─────────────────────────────────────────────────

  toggleAudio(enabled) {
    if (!this.localStream) {
      console.log("[WebRTC] toggleAudio: no local stream (receive-only).");
      return;
    }
    this.localStream.getAudioTracks().forEach((t) => {
      t.enabled = enabled;
      console.log(`[WebRTC] Audio track ${t.label}: enabled=${enabled}`);
    });
  }

  toggleVideo(enabled) {
    if (!this.localStream) {
      console.log("[WebRTC] toggleVideo: no local stream.");
      return;
    }
    this.localStream.getVideoTracks().forEach((t) => {
      t.enabled = enabled;
      console.log(`[WebRTC] Video track ${t.label}: enabled=${enabled}`);
    });
  }

  // ─── Cleanup ────────────────────────────────────────────────────────

  stopLocalStream() {
    if (this.localStream) {
      console.log("[WebRTC] Stopping local stream tracks...");
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
  }

  cleanupPC() {
    if (this.pc) {
      console.log("[WebRTC] Closing peer connection...");
      this.pc.ontrack = null;
      this.pc.onicecandidate = null;
      this.pc.onconnectionstatechange = null;
      this.pc.oniceconnectionstatechange = null;
      this.pc.close();
      this.pc = null;
    }
    this.remoteStream = null;
    this.candidatesQueue = [];
  }

  cleanup() {
    this.stopLocalStream();
    this.cleanupPC();
  }
}

export const webrtcService = new WebRTCService();
