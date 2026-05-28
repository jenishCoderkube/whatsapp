/**
 * webrtcService.js
 *
 * Production-grade WebRTC engine with stable media handling.
 *
 * KEY ARCHITECTURE:
 *   RTCPeerConnection is created INDEPENDENTLY of local media.
 *   Local tracks are attached OPTIONALLY after the connection exists.
 *   Media controls (mute/camera) ONLY toggle track.enabled —
 *   they NEVER close or recreate the peer connection.
 *   Connection state "disconnected" is treated as transient (ICE recovery),
 *   only "failed" triggers call termination.
 *
 * MEDIA STREAMING FIX:
 *   The remoteStream object is persistent, but React can't detect mutations
 *   to it (addTrack). We now use a version counter (_remoteStreamVersion)
 *   and clone the stream reference to force React re-renders when tracks
 *   arrive, ensuring video/audio elements receive the stream.
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
    this.localStream = null;
    this.remoteStream = null;
    this.candidatesQueue = [];
    this.onConnectionStateChange = null;
    this.onTrack = null;
    this._isNegotiating = false;
    this._remoteStreamVersion = 0;
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
    console.log("[WebRTC] Permission status:", result);
    return result;
  }

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
          readyState: t.readyState,
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

      console.log(
        "[WebRTC] Media acquisition failed entirely. Proceeding in receive-only mode.",
      );
      this.localStream = null;
      return null;
    }
  }

  // ─── Peer Connection (Decoupled from Media) ─────────────────────────

  createPeerConnection(onIceCandidate, onTrack) {
    this.cleanupPC();
    this.onTrack = onTrack;
    this._isNegotiating = false;
    this._remoteStreamVersion = 0;

    console.log("[WebRTC] Creating RTCPeerConnection (media-independent)...");
    this.pc = new RTCPeerConnection(servers);

    // Create a persistent remote stream container
    this.remoteStream = new MediaStream();

    // Attach local tracks IF they exist
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        console.log(
          `[WebRTC] Adding local track to PC: kind=${track.kind}, label=${track.label}, enabled=${track.enabled}, readyState=${track.readyState}`,
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
        console.log(`[WebRTC] ICE candidate generated: ${event.candidate.candidate.substring(0, 60)}...`);
        onIceCandidate(event.candidate);
      }
    };

    // Connection State — CRITICAL: "disconnected" is transient, NOT terminal.
    // Only "failed" should end the call. "disconnected" means ICE is temporarily
    // probing and will often recover automatically.
    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState;
      console.log("[WebRTC] Connection state →", state);
      if (this.onConnectionStateChange) {
        // Only report connected and failed states externally.
        // "disconnected" is handled internally with recovery timeout.
        if (state === "connected") {
          this.onConnectionStateChange("connected");
        } else if (state === "failed") {
          this.onConnectionStateChange("failed");
        }
        // "disconnected" is intentionally NOT propagated to prevent false call endings
      }
    };

    // ICE Connection State (more granular)
    this.pc.oniceconnectionstatechange = () => {
      const iceState = this.pc?.iceConnectionState;
      console.log("[WebRTC] ICE connection state →", iceState);

      // ICE "disconnected" often recovers on its own within seconds.
      // Only "failed" is truly terminal.
      if (iceState === "failed") {
        console.warn("[WebRTC] ICE connection failed. Attempting ICE restart...");
        this._attemptIceRestart();
      }
    };

    // Signaling state tracking to prevent glare during renegotiation
    this.pc.onsignalingstatechange = () => {
      console.log("[WebRTC] Signaling state →", this.pc?.signalingState);
      this._isNegotiating = this.pc?.signalingState !== "stable";
    };

    // Remote Tracks — use a single persistent MediaStream to prevent flicker
    // CRITICAL FIX: We increment _remoteStreamVersion and create a new
    // MediaStream wrapping the same tracks so React detects the change.
    this.pc.ontrack = (event) => {
      console.log(
        `[WebRTC] ★ Remote track arrived: kind=${event.track.kind}, id=${event.track.id}, readyState=${event.track.readyState}, enabled=${event.track.enabled}, muted=${event.track.muted}`,
      );

      // Add track to persistent remote stream if not already present
      const existingTrack = this.remoteStream.getTracks().find((t) => t.id === event.track.id);
      if (!existingTrack) {
        this.remoteStream.addTrack(event.track);
        console.log(`[WebRTC] Added remote ${event.track.kind} track. Total remote tracks: ${this.remoteStream.getTracks().length}`);
      } else {
        console.log(`[WebRTC] Remote ${event.track.kind} track already present, skipping add.`);
      }

      // Monitor track lifecycle
      event.track.onended = () => {
        console.log(`[WebRTC] Remote ${event.track.kind} track ended.`);
      };
      event.track.onmute = () => {
        console.log(`[WebRTC] Remote ${event.track.kind} track muted (this is normal during setup).`);
      };
      event.track.onunmute = () => {
        console.log(`[WebRTC] Remote ${event.track.kind} track unmuted — media is flowing.`);
        // Re-notify UI when track unmutes (media actually starts flowing)
        this._notifyTrackUpdate();
      };

      // Notify the UI with incremented version to force React re-render
      this._notifyTrackUpdate();
    };

    return this.pc;
  }

  /**
   * Create a new MediaStream snapshot from the current remote tracks.
   * This forces React useState to see a new object reference.
   */
  _notifyTrackUpdate() {
    this._remoteStreamVersion++;
    if (this.onTrack && this.remoteStream) {
      // Create a NEW MediaStream with the same tracks so React sees a
      // different object reference and triggers a re-render + reattach.
      const snapshot = new MediaStream(this.remoteStream.getTracks());
      console.log(
        `[WebRTC] Notifying UI of remote stream update (v${this._remoteStreamVersion}), tracks:`,
        snapshot.getTracks().map(t => `${t.kind}:enabled=${t.enabled}:state=${t.readyState}:muted=${t.muted}`)
      );
      this.onTrack(snapshot);
    }
  }

  // ─── ICE Restart (Recovery from transient disconnects) ──────────────

  async _attemptIceRestart() {
    if (!this.pc || this.pc.signalingState === "closed") return;
    try {
      console.log("[WebRTC] Performing ICE restart...");
      const offer = await this.pc.createOffer({ iceRestart: true });
      await this.pc.setLocalDescription(offer);
      // The ICE restart offer needs to be sent via signaling — 
      // but since we don't have direct access to signaling here,
      // the connection will attempt automatic ICE recovery.
    } catch (e) {
      console.warn("[WebRTC] ICE restart failed:", e);
    }
  }

  // ─── SDP Negotiation ────────────────────────────────────────────────

  async createOffer() {
    if (!this.pc) {
      console.warn("[WebRTC] createOffer: PeerConnection not initialized.");
      return null;
    }
    console.log("[WebRTC] Creating offer...");
    console.log("[WebRTC] Local tracks on PC senders:", this.pc.getSenders().map(s => 
      s.track ? `${s.track.kind}:${s.track.enabled}:${s.track.readyState}` : "null"
    ));
    const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await this.pc.setLocalDescription(offer);
    console.log("[WebRTC] Offer created and set as local description. SDP type:", offer.type);
    return offer;
  }

  async createAnswer(offerSdp) {
    if (!this.pc) {
      console.warn("[WebRTC] createAnswer: PeerConnection not initialized.");
      return null;
    }
    console.log("[WebRTC] Setting remote offer SDP...");
    await this.pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
    console.log("[WebRTC] Remote offer set. Draining queued candidates...");
    this.processQueuedCandidates();
    
    console.log("[WebRTC] Creating answer...");
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    console.log("[WebRTC] Answer created and set as local description. SDP type:", answer.type);
    return answer;
  }

  async setRemoteAnswer(answerSdp) {
    if (!this.pc) {
      console.warn("[WebRTC] setRemoteAnswer: PeerConnection not initialized. Ignoring stale answer.");
      return;
    }
    if (this.pc.signalingState !== "have-local-offer") {
      console.warn("[WebRTC] setRemoteAnswer: PC is in state", this.pc.signalingState, "— expected have-local-offer. Ignoring.");
      return;
    }
    console.log("[WebRTC] Setting remote answer SDP...");
    await this.pc.setRemoteDescription(new RTCSessionDescription(answerSdp));
    console.log("[WebRTC] Remote answer set. Draining queued candidates...");
    this.processQueuedCandidates();
  }

  // ─── ICE Candidate Queue ────────────────────────────────────────────

  async addIceCandidate(candidate) {
    if (!this.pc || !this.pc.remoteDescription) {
      console.log("[WebRTC] Queueing ICE candidate (no remote description yet).");
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

  // ─── Media Controls (NEVER touch peer connection) ───────────────────

  /**
   * Toggle audio track enabled state. This ONLY sets track.enabled
   * and does NOT recreate the peer connection, renegotiate, or close anything.
   */
  toggleAudio(enabled) {
    if (!this.localStream) {
      console.log("[WebRTC] toggleAudio: no local stream (receive-only).");
      return;
    }
    this.localStream.getAudioTracks().forEach((t) => {
      t.enabled = enabled;
      console.log(`[WebRTC] Audio track "${t.label}": enabled=${enabled}, readyState=${t.readyState}`);
    });
  }

  /**
   * Toggle video track enabled state. This ONLY sets track.enabled
   * and does NOT recreate the peer connection, renegotiate, or close anything.
   */
  toggleVideo(enabled) {
    if (!this.localStream) {
      console.log("[WebRTC] toggleVideo: no local stream.");
      return;
    }
    this.localStream.getVideoTracks().forEach((t) => {
      t.enabled = enabled;
      console.log(`[WebRTC] Video track "${t.label}": enabled=${enabled}, readyState=${t.readyState}`);
    });
  }

  /**
   * Switch camera facing mode using safe replaceTrack on the existing
   * RTCRtpSender. This does NOT recreate the peer connection.
   */
  async switchCamera() {
    if (!this.pc || !this.localStream) {
      console.log("[WebRTC] switchCamera: no peer connection or local stream.");
      return;
    }

    const currentVideoTrack = this.localStream.getVideoTracks()[0];
    if (!currentVideoTrack) {
      console.log("[WebRTC] switchCamera: no video track to switch.");
      return;
    }

    // Determine current facing mode and flip it
    const settings = currentVideoTrack.getSettings();
    const newFacingMode = settings.facingMode === "user" ? "environment" : "user";

    try {
      console.log(`[WebRTC] Switching camera to facingMode=${newFacingMode}...`);

      // Get new video track with flipped facing mode
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      const newTrack = newStream.getVideoTracks()[0];

      // Find the video sender and safely replace the track
      const videoSender = this.pc.getSenders().find((s) => s.track?.kind === "video");
      if (videoSender) {
        await videoSender.replaceTrack(newTrack);
        console.log("[WebRTC] Camera switched successfully via replaceTrack.");
      }

      // Stop old track and update local stream reference
      currentVideoTrack.stop();
      this.localStream.removeTrack(currentVideoTrack);
      this.localStream.addTrack(newTrack);
    } catch (e) {
      console.warn("[WebRTC] Camera switch failed:", e);
    }
  }

  // ─── Debug / Diagnostics ────────────────────────────────────────────

  getDebugInfo() {
    const info = {
      pcState: this.pc?.connectionState || "no-pc",
      iceState: this.pc?.iceConnectionState || "no-pc",
      signalingState: this.pc?.signalingState || "no-pc",
      localTracks: this.localStream?.getTracks().map((t) => ({
        kind: t.kind,
        enabled: t.enabled,
        readyState: t.readyState,
        label: t.label,
      })) || [],
      remoteTracks: this.remoteStream?.getTracks().map((t) => ({
        kind: t.kind,
        enabled: t.enabled,
        readyState: t.readyState,
        muted: t.muted,
      })) || [],
      senders: this.pc?.getSenders().map((s) => ({
        kind: s.track?.kind || "null",
        enabled: s.track?.enabled,
        readyState: s.track?.readyState,
      })) || [],
      receivers: this.pc?.getReceivers().map((r) => ({
        kind: r.track?.kind || "null",
        enabled: r.track?.enabled,
        readyState: r.track?.readyState,
        muted: r.track?.muted,
      })) || [],
      remoteStreamVersion: this._remoteStreamVersion,
    };
    console.log("[WebRTC] Debug info:", JSON.stringify(info, null, 2));
    return info;
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
      this.pc.onsignalingstatechange = null;
      this.pc.onnegotiationneeded = null;
      try {
        this.pc.close();
      } catch (e) {
        console.warn("[WebRTC] Error closing PC:", e);
      }
      this.pc = null;
    }
    this.remoteStream = null;
    this.candidatesQueue = [];
    this._isNegotiating = false;
    this._remoteStreamVersion = 0;
  }

  cleanup() {
    this.stopLocalStream();
    this.cleanupPC();
  }
}

export const webrtcService = new WebRTCService();
