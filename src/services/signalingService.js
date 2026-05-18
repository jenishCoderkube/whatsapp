import { supabase } from "../lib/supabaseClient";

class SignalingService {
  constructor() {
    this.channel = null;
    this.onSignal = null;
    this.targetChannels = new Map();
  }

  /**
   * Initialize personal signaling channel for the current user.
   */
  async initialize(currentUserId, onSignal) {
    if (this.channel) {
      this.cleanup();
    }

    this.onSignal = onSignal;
    this.channel = supabase.channel(`signaling:${currentUserId}`, {
      config: {
        broadcast: { self: false, ack: true },
      },
    });

    this.channel
      .on("broadcast", { event: "signal" }, ({ payload }) => {
        console.log("Signaling received:", payload.type);
        if (this.onSignal) {
          this.onSignal(payload.type, payload.data);
        }
      })
      .subscribe((status) => {
        console.log(`Signaling subscription status for ${currentUserId}:`, status);
      });
  }

  /**
   * General purpose cached sender to a target user.
   */
  async sendSignal(targetUserId, type, data) {
    let targetChannel = this.targetChannels.get(targetUserId);

    if (!targetChannel) {
      targetChannel = supabase.channel(`signaling:${targetUserId}`, {
        config: {
          broadcast: { self: false },
        },
      });
      this.targetChannels.set(targetUserId, targetChannel);
      
      // Subscribe once
      targetChannel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          targetChannel.send({
            type: "broadcast",
            event: "signal",
            payload: { type, data },
          });
        }
      });
    } else {
      // Channel already exists and is subscribed, just send directly
      targetChannel.send({
        type: "broadcast",
        event: "signal",
        payload: { type, data },
      }).catch(err => {
        console.warn("Retrying signaling send after broadcast fail:", err);
      });
    }
  }

  // Shorthand methods for clean, standard calling code
  async sendInvite(targetUserId, data) { return this.sendSignal(targetUserId, "invite", data); }
  async sendAnswer(targetUserId, data) { return this.sendSignal(targetUserId, "answer", data); }
  async sendCandidate(targetUserId, data) { return this.sendSignal(targetUserId, "candidate", data); }
  async sendEnd(targetUserId, data) { return this.sendSignal(targetUserId, "end", data); }
  async sendMuteStatus(targetUserId, data) { return this.sendSignal(targetUserId, "mute_status", data); }
  async sendVideoStatus(targetUserId, data) { return this.sendSignal(targetUserId, "video_status", data); }

  cleanup() {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    // Cleanup target channels cache
    for (const [targetUserId, ch] of this.targetChannels.entries()) {
      supabase.removeChannel(ch);
    }
    this.targetChannels.clear();
    this.onSignal = null;
  }
}

export const signalingService = new SignalingService();
