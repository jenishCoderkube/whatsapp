import { supabase } from "../lib/supabaseClient";

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
          if (!payload.new) return;
          const row = payload.new;

          let cleanText = row.text || "";
          let reactions = {};
          if (cleanText.includes("|||R:")) {
            const parts = cleanText.split("|||R:");
            cleanText = parts[0];
            try {
              reactions = JSON.parse(parts[1] || "{}");
            } catch (e) {}
          }

          const uniformMsg = {
            id: row.id,
            conversationId: row.conversation_id,
            text: cleanText,
            rawText: row.text || "",
            reactions,
            timestamp: row.timestamp_string || new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
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

    globalChannel
      .on("presence", { event: "sync" }, () => {
        const state = globalChannel.presenceState();
        const onlineMap = {};
        Object.keys(state).forEach((uid) => {
          onlineMap[uid] = true;
        });
        if (onPresenceSync) {
          onPresenceSync(onlineMap);
        }
      })
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
        }
      });
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
