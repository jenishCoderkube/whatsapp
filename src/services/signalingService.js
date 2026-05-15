import { supabase } from "../lib/supabaseClient";

class SignalingService {
  constructor() {
    this.channel = null;
    this.onSignal = null;
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
   * General purpose sender to a target user.
   */
  async sendSignal(targetUserId, type, data) {
    // We create a temporary channel to send the broadcast to the target's listening channel
    const tempChannel = supabase.channel(`signaling:${targetUserId}`);
    
    try {
      await tempChannel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await tempChannel.send({
            type: "broadcast",
            event: "signal",
            payload: { type, data },
          });
          // Cleanup temp channel after sending
          supabase.removeChannel(tempChannel);
        }
      });
    } catch (err) {
      console.error("Signaling send failed:", err);
    }
  }

  // Shorthand methods for cleaner hook code
  async sendInvite(targetUserId, data) { return this.sendSignal(targetUserId, "invite", data); }
  async sendAnswer(targetUserId, data) { return this.sendSignal(targetUserId, "answer", data); }
  async sendCandidate(targetUserId, data) { return this.sendSignal(targetUserId, "candidate", data); }
  async sendEnd(targetUserId, data) { return this.sendSignal(targetUserId, "end", data); }

  cleanup() {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.onSignal = null;
  }
}

export const signalingService = new SignalingService();
