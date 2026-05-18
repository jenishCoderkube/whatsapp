/**
 * webrtcService.js
 * Optimized for production-level stability, device availability checks, permission flows, and cross-browser reliability.
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
  }

  /**
   * Query the browser's active media permissions.
   */
  async getPermissionStatus() {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        // Query microphone permission state
        let audioState = "prompt";
        try {
          const audioPerm = await navigator.permissions.query({ name: "microphone" });
          audioState = audioPerm.state;
        } catch (e) {
          console.warn("Microphone permission query not fully supported:", e);
        }

        // Query camera permission state
        let videoState = "prompt";
        try {
          const videoPerm = await navigator.permissions.query({ name: "camera" });
          videoState = videoPerm.state;
        } catch (e) {
          console.warn("Camera permission query not fully supported:", e);
        }

        const permStatus = { audio: audioState, video: videoState };
        console.log("Current media permission status:", permStatus);
        return permStatus;
      }
    } catch (err) {
      console.warn("Permissions query bypass default:", err);
    }
    return { audio: "prompt", video: "prompt" };
  }

  /**
   * Check physical hardware availability for mic and camera with permission-awareness.
   */
  async checkDevices() {
    const permissions = await this.getPermissionStatus();
    
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        console.warn("Media devices API not supported by browser.");
        return { hasMic: false, hasCam: false };
      }
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      console.log("Hardware device list enumerated:", devices.map(d => ({
        kind: d.kind,
        label: d.label || "(Unlabeled - Permission Required)",
        deviceId: d.deviceId ? `${d.deviceId.substring(0, 5)}...` : "(Empty)"
      })));

      const hasAudioDevice = devices.some(device => device.kind === "audioinput");
      const hasVideoDevice = devices.some(device => device.kind === "videoinput");

      // In modern browsers, enumerateDevices() will hide or not return devices prior to permission grant.
      // Therefore, if the permission status is still 'prompt', we MUST assume a mic/camera exists
      // to trigger the request flow properly, instead of locking the user out.
      const hasMic = permissions.audio === "prompt" ? true : hasAudioDevice;
      const hasCam = permissions.video === "prompt" ? true : hasVideoDevice;

      console.log(`Capability check result: hasMic=${hasMic} (audioDeviceCount=${devices.filter(d => d.kind === "audioinput").length}), hasCam=${hasCam}`);
      return { hasMic, hasCam };
    } catch (e) {
      console.warn("Device capability check failed, assuming standard fallbacks:", e);
      return { hasMic: true, hasCam: true };
    }
  }

  /**
   * Initialize local media stream with hardware fallback and permission check.
   */
  async getLocalStream(withVideo = false) {
    if (this.localStream) {
      const hasVideo = this.localStream.getVideoTracks().length > 0;
      if (withVideo && !hasVideo) {
        console.log("Local stream needs video tracks, refreshing stream...");
        this.stopLocalStream();
      } else {
        console.log("Reusing existing local stream.");
        return this.localStream;
      }
    }

    const permissions = await this.getPermissionStatus();
    const canUseAudio = permissions.audio !== "denied";
    const canUseVideo = permissions.video !== "denied";

    const constraints = {
      audio: canUseAudio ? {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      } : false,
      video: (withVideo && canUseVideo) ? {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: "user"
      } : false
    };

    console.log("Requesting getUserMedia with constraints:", constraints);

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Successfully acquired local stream. Active tracks:", this.localStream.getTracks().map(t => ({
        kind: t.kind,
        label: t.label,
        enabled: t.enabled
      })));
      return this.localStream;
    } catch (err) {
      console.warn("getUserMedia failed:", err);

      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        console.error("Media permission request explicitly denied by user.");
        throw err;
      }

      if (withVideo) {
        console.warn("Camera fallback triggered, requesting audio only...");
        return this.getLocalStream(false);
      }

      console.warn("Microphone access failed. Proceeding with safe silent stream.");
      this.localStream = new MediaStream();
      return this.localStream;
    }
  }

  /**
   * Create and configure the PeerConnection.
   */
  createPeerConnection(onIceCandidate, onTrack) {
    this.cleanupPC();
    this.onTrack = onTrack;

    console.log("Creating RTCPeerConnection...");
    this.pc = new RTCPeerConnection(servers);

    // Add local tracks to transmit to the peer
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        console.log(`Adding local track to RTCPeerConnection: kind=${track.kind}, label=${track.label}`);
        this.pc.addTrack(track, this.localStream);
      });
    } else {
      console.warn("No localStream tracks available to attach.");
    }

    // Handle ICE Candidates
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        onIceCandidate(event.candidate);
      }
    };

    // Handle Connection State
    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState;
      console.log("RTCPeerConnection state updated to:", state);
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(state);
      }
    };

    // Handle Remote Tracks
    this.pc.ontrack = (event) => {
      console.log(`Remote track arrived: kind=${event.track.kind}, id=${event.track.id}`);
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }
      
      // Ensure the incoming track is attached
      if (!this.remoteStream.getTracks().find(t => t.id === event.track.id)) {
        this.remoteStream.addTrack(event.track);
      }

      if (this.onTrack) {
        this.onTrack(this.remoteStream);
      }
    };

    return this.pc;
  }

  /**
   * Create Offer
   */
  async createOffer() {
    if (!this.pc) throw new Error("PeerConnection not initialized");
    console.log("Creating local WebRTC offer...");
    const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });
    await this.pc.setLocalDescription(offer);
    return offer;
  }

  /**
   * Create Answer
   */
  async createAnswer(offerSdp) {
    if (!this.pc) throw new Error("PeerConnection not initialized");
    console.log("Creating local WebRTC answer...");
    await this.pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
    
    // Process queued candidates
    this.processQueuedCandidates();

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return answer;
  }

  /**
   * Set Remote Answer
   */
  async setRemoteAnswer(answerSdp) {
    if (!this.pc) throw new Error("PeerConnection not initialized");
    console.log("Setting remote WebRTC description...");
    await this.pc.setRemoteDescription(new RTCSessionDescription(answerSdp));
    this.processQueuedCandidates();
  }

  /**
   * Add ICE Candidate with queuing logic
   */
  async addIceCandidate(candidate) {
    if (!this.pc || !this.pc.remoteDescription) {
      console.log("PeerConnection not ready, queuing ICE candidate.");
      this.candidatesQueue.push(candidate);
      return;
    }

    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.warn("Failed to add ICE candidate:", e);
    }
  }

  processQueuedCandidates() {
    if (!this.pc || !this.pc.remoteDescription) return;
    
    console.log(`Processing ${this.candidatesQueue.length} queued ICE candidates...`);
    while (this.candidatesQueue.length > 0) {
      const candidate = this.candidatesQueue.shift();
      this.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => {
        console.warn("Failed to add queued ICE candidate:", e);
      });
    }
  }

  /**
   * Media Control Toggles
   */
  toggleAudio(enabled) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(t => {
        t.enabled = enabled;
        console.log(`Local audio track (id=${t.id}) state set to: enabled=${enabled}`);
      });
    } else {
      console.warn("Audio toggle failed: no local stream active.");
    }
  }

  toggleVideo(enabled) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(t => {
        t.enabled = enabled;
        console.log(`Local video track (id=${t.id}) state set to: enabled=${enabled}`);
      });
    } else {
      console.warn("Video toggle failed: no local stream active.");
    }
  }

  /**
   * Cleanup
   */
  stopLocalStream() {
    if (this.localStream) {
      console.log("Stopping local media stream tracks...");
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
  }

  cleanupPC() {
    if (this.pc) {
      console.log("Closing RTCPeerConnection...");
      this.pc.ontrack = null;
      this.pc.onicecandidate = null;
      this.pc.onconnectionstatechange = null;
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
