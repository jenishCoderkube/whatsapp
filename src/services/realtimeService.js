import { supabase } from "../lib/supabaseClient";
import { parseMessageText } from "../utils/messageParser";

let globalChannel = null;
let globalMessagesChannel = null;

export const realtimeService = {
  /**
   * Unified global message streaming channel listener consuming table-wide INSERT/UPDATE events
   * natively. Optimizes websocket connections by maintaining exactly one data channel per client session,
   * completely eliminating connection thrashing or race condition loops during rapid interface transitions.
   */
  subscribeToUserGlobalMessages(onGlobalEvent) {
    if (globalMessagesChannel) return;

    globalMessagesChannel = supabase
      .channel("user_global_messages")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldRow = payload.old;
            if (oldRow) {
              onGlobalEvent("DELETE", {
                id: oldRow.id,
                conversationId: oldRow.conversation_id,
              });
            }
            return;
          }
          if (!payload.new) return;
          const row = payload.new;

          const { text: cleanText, reactions, replyTo, isForwarded } = parseMessageText(row.text || "");

          const uniformMsg = {
            id: row.id,
            conversationId: row.conversation_id,
            text: cleanText,
            rawText: row.text || "",
            reactions,
            replyTo: row.reply_to || replyTo,
            isForwarded: row.is_forwarded || isForwarded,
            editedAt: row.edited_at,
            editHistory: row.edit_history,
            timestamp: row.timestamp_string || new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }),
            status: row.status || "sent",
            type: row.type || "text",
            mediaUrl: row.media_url,
            fileName: row.file_name,
            fileSize: row.file_size,
            duration: row.duration,
            senderId: row.sender_id,
            sender_id: row.sender_id,
            createdAt: row.created_at,
          };

          onGlobalEvent(payload.eventType, uniformMsg);
        }
      )
      .subscribe();
  },

  /**
   * Terminate table-wide listening framework securely.
   */
  disconnectGlobalMessages() {
    if (globalMessagesChannel) {
      try {
        supabase.removeChannel(globalMessagesChannel);
      } catch (e) {}
      globalMessagesChannel = null;
    }
  },

  /**
   * Legacy localized room listeners mapped cleanly to absolute global state pipelines to guarantee zero duplicate handling.
   */
  subscribeToConversationMessages() {},
  unsubscribeFromActiveConversation() {},

  /**
   * Initialize Global Presence tracking and typing broadcast events across all connected apps natively.
   */
  initializeGlobalPresence(currentUserId, onPresenceSync, onTypingReceived) {
    if (!currentUserId) return;
    if (globalChannel) return;

    globalChannel = supabase.channel("whatsapp_global_presence", {
      config: {
        presence: { key: currentUserId },
        broadcast: { self: false },
      },
    });

    const updatePresence = () => {
      const state = globalChannel.presenceState();
      const onlineMap = {};
      Object.keys(state).forEach((uid) => {
        // Validate active realtime connection length to eliminate stale references
        if (state[uid] && state[uid].length > 0) {
          onlineMap[uid] = true;
        }
      });
      if (onPresenceSync) {
        onPresenceSync(onlineMap);
      }
    };

    globalChannel
      .on("presence", { event: "sync" }, updatePresence)
      .on("presence", { event: "join" }, updatePresence)
      .on("presence", { event: "leave" }, updatePresence)
      .on("broadcast", { event: "typing" }, (payload) => {
        if (onTypingReceived && payload.payload) {
          onTypingReceived(payload.payload);
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await globalChannel.track({
            online_at: new Date().toISOString(),
            user_id: currentUserId,
          });
          // Synchronize database timestamp on fresh connection
          supabase.from("profiles").update({ online: true, last_seen: new Date().toISOString() }).eq("id", currentUserId).then();
        }
      });

    // Cleanup disconnected users properly when tab or browser closes and handle background states
    if (typeof window !== "undefined" && !window.__wa_presence_cleanup_bound) {
      window.__wa_presence_cleanup_bound = true;
      window.addEventListener("beforeunload", () => {
        if (globalChannel) {
          globalChannel.untrack().catch(() => {});
        }
      });

      // Handle App close / tab switch / network disconnect properly
      window.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
          supabase.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", currentUserId).then();
        } else {
          // Reconnect logic / return to active
          supabase.from("profiles").update({ online: true, last_seen: new Date().toISOString() }).eq("id", currentUserId).then();
        }
      });
    }
  },

  /**
   * Transmit live keystroke states onto shared global presence hub.
   */
  broadcastTypingEvent(chatId, userId, isTyping, userName) {
    if (globalChannel && globalChannel.state === "joined") {
      globalChannel.send({
        type: "broadcast",
        event: "typing",
        payload: { chatId, userId, isTyping, userName },
      });
    }
  },

  /**
   * Disconnect global layer cleanly on explicit logout scenarios.
   */
  async disconnectGlobalPresence() {
    if (globalChannel) {
      try {
        await globalChannel.untrack();
        supabase.removeChannel(globalChannel);
      } catch (e) {}
      globalChannel = null;
    }
  },
};
