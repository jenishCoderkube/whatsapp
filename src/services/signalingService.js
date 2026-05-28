import { supabase } from "../lib/supabaseClient";

class SignalingService {
  constructor() {
    this.channel = null;
    this.onSignal = null;
    this.targetChannels = new Map();
    // Track subscription readiness to prevent sending on unsubscribed channels
    this._targetReady = new Map();
    // Queue messages sent before channel is ready
    this._targetQueues = new Map();
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
        console.log("[Signaling] Received:", payload.type);
        if (this.onSignal) {
          this.onSignal(payload.type, payload.data);
        }
      })
      .subscribe((status) => {
        console.log(`[Signaling] Own channel status for ${currentUserId}:`, status);
      });
  }

  /**
   * General purpose sender to a target user.
   * Handles the subscribe-before-send race condition by queuing messages
   * until the channel reports SUBSCRIBED.
   */
  async sendSignal(targetUserId, type, data) {
    let targetChannel = this.targetChannels.get(targetUserId);

    if (!targetChannel) {
      // Create and subscribe to the target channel
      targetChannel = supabase.channel(`signaling:${targetUserId}`, {
        config: {
          broadcast: { self: false },
        },
      });
      this.targetChannels.set(targetUserId, targetChannel);
      this._targetReady.set(targetUserId, false);
      this._targetQueues.set(targetUserId, []);

      // Queue the current message
      this._targetQueues.get(targetUserId).push({ type, data });

      targetChannel.subscribe((status) => {
        console.log(`[Signaling] Target channel for ${targetUserId}: ${status}`);
        if (status === "SUBSCRIBED") {
          this._targetReady.set(targetUserId, true);
          // Drain the queue
          const queue = this._targetQueues.get(targetUserId) || [];
          console.log(`[Signaling] Draining ${queue.length} queued signals for ${targetUserId}`);
          while (queue.length > 0) {
            const msg = queue.shift();
            this._doSend(targetChannel, msg.type, msg.data);
          }
        }
      });
    } else if (!this._targetReady.get(targetUserId)) {
      // Channel exists but not yet subscribed — queue the message
      console.log(`[Signaling] Channel not ready yet for ${targetUserId}, queueing ${type}`);
      const queue = this._targetQueues.get(targetUserId) || [];
      queue.push({ type, data });
      this._targetQueues.set(targetUserId, queue);
    } else {
      // Channel is subscribed and ready — send immediately
      this._doSend(targetChannel, type, data);
    }
  }

  _doSend(channel, type, data) {
    console.log(`[Signaling] Sending signal: ${type}`);
    channel.send({
      type: "broadcast",
      event: "signal",
      payload: { type, data },
    }).catch(err => {
      console.warn("[Signaling] Broadcast send failed:", err);
    });
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
    this._targetReady.clear();
    this._targetQueues.clear();
    this.onSignal = null;
  }
}

export const signalingService = new SignalingService();
