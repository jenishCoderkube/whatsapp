/**
 * webrtcService.js
 * Optimized for production-level stability and cross-browser reliability.
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
   * Initialize local media stream with hardware fallback logic.
   */
  async getLocalStream(withVideo = false) {
    if (this.localStream) {
      const hasVideo = this.localStream.getVideoTracks().length > 0;
      if (withVideo && !hasVideo) {
        this.stopLocalStream();
      } else {
        return this.localStream;
      }
    }

    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: withVideo ? {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: "user"
      } : false
    };

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.localStream;
    } catch (err) {
      if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        if (withVideo) {
          console.warn("Camera not found, trying audio only...");
          return this.getLocalStream(false);
        } else {
          console.warn("Microphone not found either. Proceeding without local audio.");
          // Create an empty stream so the call doesn't crash
          this.localStream = new MediaStream();
          return this.localStream;
        }
      }
      
      if (withVideo) {
        console.warn("Media access failed, falling back to audio only:", err);
        return this.getLocalStream(false);
      }
      console.error("Critical: Access to media denied:", err);
      throw err;
    }
  }

  /**
   * Create and configure the PeerConnection.
   */
  createPeerConnection(onIceCandidate, onTrack) {
    this.cleanupPC();
    this.onTrack = onTrack;

    this.pc = new RTCPeerConnection(servers);

    // Add local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.pc.addTrack(track, this.localStream);
      });
    }

    // Handle ICE Candidates
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        onIceCandidate(event.candidate);
      }
    };

    // Handle Connection State
    this.pc.onconnectionstatechange = () => {
      console.log("WebRTC Connection State:", this.pc?.connectionState);
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(this.pc.connectionState);
      }
    };

    // Handle Remote Tracks
    this.pc.ontrack = (event) => {
      console.log("Remote track received:", event.track.kind);
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }
      
      // Add track to remote stream if not already present
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
    await this.pc.setRemoteDescription(new RTCSessionDescription(answerSdp));
    this.processQueuedCandidates();
  }

  /**
   * Add ICE Candidate with queuing logic
   */
  async addIceCandidate(candidate) {
    if (!this.pc || !this.pc.remoteDescription) {
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
    
    while (this.candidatesQueue.length > 0) {
      const candidate = this.candidatesQueue.shift();
      this.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => {
        console.warn("Failed to add queued ICE candidate:", e);
      });
    }
  }

  /**
   * Controls
   */
  toggleAudio(enabled) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(t => t.enabled = enabled);
    }
  }

  toggleVideo(enabled) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(t => t.enabled = enabled);
    }
  }

  /**
   * Cleanup
   */
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
