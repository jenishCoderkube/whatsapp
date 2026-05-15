import { supabase } from "../lib/supabaseClient";

let signalingChannel = null;

export const signalingService = {
  /**
   * Join the global signaling hub for real-time call coordination.
   */
  async initialize(currentUserId, onCallSignal) {
    if (signalingChannel) return;

    signalingChannel = supabase.channel(`call_signaling_${currentUserId}`, {
      config: {
        broadcast: { self: false },
      },
    });

    signalingChannel
      .on("broadcast", { event: "call_invite" }, (payload) => {
        onCallSignal("invite", payload.payload);
      })
      .on("broadcast", { event: "call_answer" }, (payload) => {
        onCallSignal("answer", payload.payload);
      })
      .on("broadcast", { event: "call_candidate" }, (payload) => {
        onCallSignal("candidate", payload.payload);
      })
      .on("broadcast", { event: "call_end" }, (payload) => {
        onCallSignal("end", payload.payload);
      })
      .subscribe();
  },

  /**
   * Broadcast an invitation to a target user.
   */
  async sendInvite(targetUserId, invitePayload) {
    const channel = supabase.channel(`call_signaling_${targetUserId}`);
    return channel.send({
      type: "broadcast",
      event: "call_invite",
      payload: invitePayload,
    });
  },

  /**
   * Broadcast an answer back to the caller.
   */
  async sendAnswer(targetUserId, answerPayload) {
    const channel = supabase.channel(`call_signaling_${targetUserId}`);
    return channel.send({
      type: "broadcast",
      event: "call_answer",
      payload: answerPayload,
    });
  },

  /**
   * Transmit WebRTC ICE candidates to the peer.
   */
  async sendCandidate(targetUserId, candidatePayload) {
    const channel = supabase.channel(`call_signaling_${targetUserId}`);
    return channel.send({
      type: "broadcast",
      event: "call_candidate",
      payload: candidatePayload,
    });
  },

  /**
   * Notify peer that the call has been terminated.
   */
  async sendCallEnd(targetUserId, endPayload) {
    const channel = supabase.channel(`call_signaling_${targetUserId}`);
    return channel.send({
      type: "broadcast",
      event: "call_end",
      payload: endPayload,
    });
  },

  /**
   * Cleanup signaling channel.
   */
  cleanup() {
    if (signalingChannel) {
      supabase.removeChannel(signalingChannel);
      signalingChannel = null;
    }
  },
};
