import { supabase } from "../lib/supabaseClient";
import { parseMessageText } from "../utils/messageParser";

let globalChannel = null;
let globalProfilesChannel = null;
let activeChatChannel = null;
let userConversationsChannel = null;
let userMembershipsChannel = null;

export const realtimeService = {
  /**
   * Scoped active chat messages channel subscription.
   * Restricts updates strictly to the conversation currently in focus, avoiding table-wide RLS scans.
   */
  subscribeToActiveChatMessages(conversationId, onMessageEvent) {
    this.unsubscribeFromActiveChat();

    if (!conversationId) return;

    activeChatChannel = supabase
      .channel(`active_chat_messages_${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldRow = payload.old;
            if (oldRow) {
              onMessageEvent("DELETE", {
                id: oldRow.id,
                conversationId: oldRow.conversation_id || conversationId,
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
            receipts: row.receipts || {},
            deliveredAt: row.delivered_at,
            seenAt: row.seen_at,
            clientId: row.client_id,
          };

          onMessageEvent(payload.eventType, uniformMsg);
        }
      )
      .subscribe();
  },

  unsubscribeFromActiveChat() {
    if (activeChatChannel) {
      try {
        supabase.removeChannel(activeChatChannel);
      } catch (e) {}
      activeChatChannel = null;
    }
  },

  /**
   * Monitor user-specific conversation changes and unread count transitions.
   * Utilizes indexed equality filters to achieve O(1) server-side dispatching.
   */
  subscribeToUserConversations(userId, onConversationEvent, onMembershipEvent) {
    if (!userId) return;

    this.disconnectUserConversations();

    // 1. Listen for updates to conversations the user is in (enforced via DB RLS)
    userConversationsChannel = supabase
      .channel(`user_conversations_${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        (payload) => {
          if (onConversationEvent && payload.new) {
            onConversationEvent(payload.eventType, payload.new);
          }
        }
      )
      .subscribe();

    // 2. Listen for user unread count updates in conversation_members
    userMembershipsChannel = supabase
      .channel(`user_memberships_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_members",
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          if (onMembershipEvent && (payload.new || payload.old)) {
            onMembershipEvent(payload.eventType, payload.new || payload.old);
          }
        }
      )
      .subscribe();
  },

  disconnectUserConversations() {
    if (userConversationsChannel) {
      try {
        supabase.removeChannel(userConversationsChannel);
      } catch (e) {}
      userConversationsChannel = null;
    }
    if (userMembershipsChannel) {
      try {
        supabase.removeChannel(userMembershipsChannel);
      } catch (e) {}
      userMembershipsChannel = null;
    }
  },

  /**
   * Listen for user profile updates globally in real-time.
   */
  subscribeToProfileUpdates(onProfileUpdate) {
    if (globalProfilesChannel) return;

    globalProfilesChannel = supabase
      .channel("user_global_profiles")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        (payload) => {
          if (payload.new) {
            onProfileUpdate(payload.new);
          }
        }
      )
      .subscribe();
  },

  /**
   * Terminate profile updates channel.
   */
  disconnectProfileUpdates() {
    if (globalProfilesChannel) {
      try {
        supabase.removeChannel(globalProfilesChannel);
      } catch (e) {}
      globalProfilesChannel = null;
    }
  },

  // Legacy compatibility mapping
  subscribeToUserGlobalMessages() {},
  disconnectGlobalMessages() {},

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
      let visibilityTimeout = null;
      let isMarkedOffline = false;

      window.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
          if (visibilityTimeout) clearTimeout(visibilityTimeout);
          visibilityTimeout = setTimeout(() => {
            isMarkedOffline = true;
            supabase
              .from("profiles")
              .update({ last_seen: new Date().toISOString() })
              .eq("id", currentUserId)
              .then();
          }, 30000); // 30 seconds debounce
        } else {
          if (visibilityTimeout) {
            clearTimeout(visibilityTimeout);
            visibilityTimeout = null;
          }
          if (isMarkedOffline) {
            isMarkedOffline = false;
            supabase
              .from("profiles")
              .update({ online: true, last_seen: new Date().toISOString() })
              .eq("id", currentUserId)
              .then();
          }
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

  /**
   * Forcibly tear down and rebuild all active channels to sync connections after reconnect events.
   */
  reconnectAll(currentUserId, onProfileUpdate, onPresenceSync, onTypingReceived, onConversationEvent, onMembershipEvent) {
    this.unsubscribeFromActiveChat();
    this.disconnectProfileUpdates();
    this.disconnectGlobalPresence();
    this.disconnectUserConversations();

    if (onProfileUpdate) {
      this.subscribeToProfileUpdates(onProfileUpdate);
    }
    if (currentUserId) {
      this.initializeGlobalPresence(currentUserId, onPresenceSync, onTypingReceived);
      this.subscribeToUserConversations(currentUserId, onConversationEvent, onMembershipEvent);
    }
  }
};
