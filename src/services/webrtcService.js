/**
 * webrtcService.js
 * Encapsulates core RTCPeerConnection logic and media stream handling.
 */

const servers = {
  iceServers: [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
      ],
    },
  ],
  iceCandidatePoolSize: 10,
};

export const webrtcService = {
  pc: null,
  localStream: null,
  remoteStream: null,

  /**
   * Initialize local media stream.
   */
  async getLocalStream(withVideo = false) {
    if (this.localStream) {
      // If we already have a stream but need video and it doesn't have it, we might need to refresh
      const hasVideo = this.localStream.getVideoTracks().length > 0;
      if (withVideo && !hasVideo) {
        this.cleanup();
      } else {
        return this.localStream;
      }
    }

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: withVideo ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user"
        } : false,
      });
      return this.localStream;
    } catch (err) {
      if (withVideo) {
        console.warn("Camera failed, falling back to audio only:", err);
        return this.getLocalStream(false);
      }
      console.error("Access to media denied:", err);
      throw err;
    }
  },

  /**
   * Create a new peer connection.
   */
  createPeerConnection(onIceCandidate, onTrack) {
    if (this.pc) this.pc.close();

    this.pc = new RTCPeerConnection(servers);

    // Add local tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.pc.addTrack(track, this.localStream);
      });
    }

    // Handle ICE candidates
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        onIceCandidate(event.candidate);
      }
    };

    // Handle remote tracks
    this.pc.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      onTrack(this.remoteStream);
    };

    return this.pc;
  },

  /**
   * Create a WebRTC offer.
   */
  async createOffer() {
    if (!this.pc) throw new Error("PeerConnection not initialized");
    const offerDescription = await this.pc.createOffer();
    await this.pc.setLocalDescription(offerDescription);
    return offerDescription;
  },

  /**
   * Create a WebRTC answer for a given offer.
   */
  async createAnswer(offerDescription) {
    if (!this.pc) throw new Error("PeerConnection not initialized");
    await this.pc.setRemoteDescription(new RTCSessionDescription(offerDescription));
    const answerDescription = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answerDescription);
    return answerDescription;
  },

  /**
   * Set remote answer description.
   */
  async setRemoteAnswer(answerDescription) {
    if (!this.pc) throw new Error("PeerConnection not initialized");
    const remoteDesc = new RTCSessionDescription(answerDescription);
    await this.pc.setRemoteDescription(remoteDesc);
  },

  /**
   * Toggle local tracks.
   */
  toggleAudio(enabled) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(t => t.enabled = enabled);
    }
  },

  toggleVideo(enabled) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(t => t.enabled = enabled);
    }
  },

  /**
   * Add ICE candidate received from peer.
   */
  async addIceCandidate(candidate) {
    if (!this.pc) return;
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.warn("Error adding ICE candidate:", e);
    }
  },

  /**
   * Close connection and release media.
   */
  cleanup() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    this.remoteStream = null;
  },
};
