import { supabase } from "../lib/supabaseClient";

export const messageService = {
  /**
   * Fetch chat window message history natively from Supabase implementing robust cursor-based pagination.
   * Loads maximum 20 latest elements initially, loading legacy rows progressively
   * sorted cleanly by UI mounting expectations. Dynamically evaluates correct absolute sender association.
   */
  async fetchMessages(
    conversationId,
    lastCreatedAtCursor = null,
    limitCount = 20,
    currentUserId = null,
  ) {
    try {
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          conversationId,
        );
      if (!conversationId || !isUuid) {
        return [];
      }

      let dbQuery = supabase
        .from("messages")
        .select("*, profiles:sender_id(name, avatar)")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(limitCount);

      // Apply pagination boundary pointer
      if (lastCreatedAtCursor) {
        dbQuery = dbQuery.lt("created_at", lastCreatedAtCursor);
      }

      const { data, error } = await dbQuery;
      if (error) throw error;
      if (!data) return [];

      // Map rows directly to frontend expectations, reversing so earliest is first natively
      return data.reverse().map((msg) => {
        const isMine = currentUserId ? msg.sender_id === currentUserId : false;
        let cleanText = msg.text || "";
        let reactions = {};
        if (cleanText.includes("|||R:")) {
          const parts = cleanText.split("|||R:");
          cleanText = parts[0];
          try {
            reactions = JSON.parse(parts[1] || "{}");
          } catch (e) {}
        }

        return {
          id: msg.id,
          text: cleanText,
          rawText: msg.text || "",
          reactions,
          timestamp:
            msg.timestamp_string ||
            new Date(msg.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          isOutgoing: isMine,
          status: msg.status || "sent",
          type: msg.type || "text",
          mediaUrl: msg.media_url,
          fileName: msg.file_name,
          fileSize: msg.file_size,
          duration: msg.duration,
          senderId: msg.sender_id,
          sender_id: msg.sender_id, // Normalized alignment reference parity
          senderName: msg.profiles?.name || "Member",
          senderAvatar: msg.profiles?.avatar,
          createdAt: msg.created_at,
        };
      });
    } catch (error) {
      console.warn(
        "Real message loader query returned empty set exception:",
        error,
      );
      return [];
    }
  },

  /**
   * Append outgoing payload item directly into actual database messaging table and update
   * background room preview metadata text dynamically.
   */
  async sendMessage({
    conversationId,
    senderId,
    text,
    type = "text",
    mediaUrl,
    fileName,
    fileSize,
    duration,
    timestampString,
  }) {
    try {
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          conversationId,
        );
      if (!isUuid) {
        throw new Error(
          "Target conversation string is not a valid UUID format identifier.",
        );
      }

      // Offline detection logic
      const isOnline = typeof window !== 'undefined' ? navigator.onLine : true;

      const insertPayload = {
        conversation_id: conversationId,
        sender_id: senderId,
        text,
        type,
        media_url: mediaUrl,
        file_name: fileName,
        file_size: fileSize,
        duration,
        status: "sent",
        timestamp_string:
          timestampString ||
          new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
      };

      if (!isOnline) {
        // If offline, return a structured pending object and let the caller handle it.
        // The caller (ChatInput) will save it to IndexedDB along with the file.
        const pendingMsg = {
          ...insertPayload,
          id: "offline-" + Date.now(),
          status: "pending",
          created_at: new Date().toISOString(),
        };
        const error = new Error("OFFLINE_PENDING");
        error.pendingMsg = pendingMsg;
        throw error;
      }

      // Security Check: Verify user is an active member
      const { data: membership } = await supabase
        .from("conversation_members")
        .select("is_left")
        .eq("conversation_id", conversationId)
        .eq("user_id", senderId)
        .single();
      
      if (!membership || membership.is_left) {
        throw new Error("Action restricted: You are no longer a participant in this conversation.");
      }

      const { data: newMsg, error } = await supabase
        .from("messages")
        .insert(insertPayload)
        .select()
        .single();

      if (error) throw error;

      // Update background parent preview text strips asynchronously
      let previewText = text;
      if (type === "image") previewText = "📷 Photo";
      if (type === "file") previewText = "📎 Document";
      if (type === "voice") previewText = "🎤 Voice Message";
      if (type === "video") previewText = "🎥 Video";

      await supabase
        .from("conversations")
        .update({
          last_message_text: previewText,
          last_message_timestamp: insertPayload.timestamp_string,
          last_message_status: "sent",
          last_message_sender_id: senderId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId);

      // Increment unread_count in database for all other conversation members to guarantee true persistence across refresh boundaries
      try {
        const { data: peerMembers } = await supabase
          .from("conversation_members")
          .select("user_id, unread_count")
          .eq("conversation_id", conversationId)
          .neq("user_id", senderId);

        if (peerMembers && peerMembers.length > 0) {
          for (const member of peerMembers) {
            await supabase
              .from("conversation_members")
              .update({ unread_count: (member.unread_count || 0) + 1 })
              .eq("conversation_id", conversationId)
              .eq("user_id", member.user_id);
          }
        }
      } catch (err) {
        console.warn(
          "Could not increment remote peer database unread count:",
          err,
        );
      }

      return {
        id: newMsg.id,
        text: newMsg.text || "",
        rawText: newMsg.text || "",
        reactions: {},
        timestamp: newMsg.timestamp_string,
        status: newMsg.status,
        type: newMsg.type,
        mediaUrl: newMsg.media_url,
        fileName: newMsg.file_name,
        fileSize: newMsg.file_size,
        duration: newMsg.duration,
        senderId: newMsg.sender_id,
        sender_id: newMsg.sender_id, // Normalized duplicate parity helper
        isOutgoing: true,
        createdAt: newMsg.created_at,
      };
    } catch (error) {
      if (error.message === "OFFLINE_PENDING") throw error;
      throw new Error("Real message broadcast interrupted: " + error.message);
    }
  },

  /**
   * Update message read/delivered verification status checkmarks.
   * Hardened for groups: Transitions are strictly managed by an atomic Postgres RPC
   * to guarantee no race conditions when multiple members fetch and acknowledge simultaneously.
   */
  async updateStatus(messageId, status, currentUserId) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(messageId);
      if (!messageId || !isUuid || !currentUserId) return;

      const { error } = await supabase.rpc("update_message_status", {
        p_message_id: messageId,
        p_status: status,
        p_user_id: currentUserId
      });

      if (error) {
        throw error;
      }
    } catch (e) {
      console.warn("Delivery state RPC update interrupted:", e);
    }
  },

  /**
   * Batch mark messages in a conversation as delivered.
   * Useful for syncing offline-received messages when app initializes or room opens.
   */
  async markConversationMessagesAsDelivered(conversationId, currentUserId) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId);
      if (!conversationId || !isUuid || !currentUserId) return;

      // 1. Fetch group context
      const { data: conv } = await supabase
        .from("conversations")
        .select("is_group, group_members_count")
        .eq("id", conversationId)
        .single();
      
      const isGroup = conv?.is_group;
      const totalMembers = conv?.group_members_count || 2;
      const targetCount = totalMembers - 1;

      // 2. Fetch pending 'sent' messages targeting this user
      const { data: pendingMsgs } = await supabase
        .from("messages")
        .select("id, delivered_to, sender_id")
        .eq("conversation_id", conversationId)
        .neq("sender_id", currentUserId)
        .eq("status", "sent");
      
      if (pendingMsgs && pendingMsgs.length > 0) {
        for (const msg of pendingMsgs) {
          const currentDeliveredTo = Array.isArray(msg.delivered_to) ? msg.delivered_to : [];
          if (!currentDeliveredTo.includes(currentUserId)) {
            const newList = [...currentDeliveredTo, currentUserId];
            const isFullyDelivered = !isGroup || newList.length >= targetCount;
            
            await supabase
              .from("messages")
              .update({
                delivered_to: newList,
                ...(isFullyDelivered ? { status: "delivered", delivered_at: new Date().toISOString() } : {})
              })
              .eq("id", msg.id);
          }
        }
      }

      // 3. Update conversation preview if needed
      const { data: lastMsg } = await supabase
        .from("messages")
        .select("status, sender_id")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (lastMsg && lastMsg.status === "delivered") {
        await supabase
          .from("conversations")
          .update({ last_message_status: "delivered" })
          .eq("id", conversationId)
          .eq("last_message_sender_id", lastMsg.sender_id);
      }
    } catch (e) {
      console.warn("Batch delivery update failed:", e);
    }
  },

  /**
   * Global delivery sync: Find all conversations for user and acknowledge pending 'sent' messages.
   * Prevents 'ghost' single ticks when receiver is online but hasn't opened specific rooms.
   */
  async syncAllPendingDeliveries(currentUserId) {
    if (!currentUserId) return;
    try {
      const { data: memberships } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", currentUserId);

      if (memberships && memberships.length > 0) {
        const convIds = memberships.map(m => m.conversation_id);
        
        // Update all pending 'sent' messages targeting this user in these conversations
        await supabase
          .from("messages")
          .update({ status: "delivered", delivered_at: new Date().toISOString() })
          .in("conversation_id", convIds)
          .neq("sender_id", currentUserId)
          .eq("status", "sent");

        // Sync conversation preview status fields
        await supabase
          .from("conversations")
          .update({ last_message_status: "delivered" })
          .in("id", convIds)
          .neq("last_message_sender_id", currentUserId)
          .eq("last_message_status", "sent");
      }
    } catch (err) {
      console.warn("Global delivery sync failure:", err);
    }
  },

  /**
   * Instantly flag incoming unread sequences targeting the user inside active conversation loops as Read.
   * Hardened for group array tracking.
   */
  async markConversationMessagesAsRead(conversationId, currentUserId) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId);
      if (!conversationId || !isUuid || !currentUserId) return;

      // 1. Fetch conversation metadata for member count
      const { data: conv } = await supabase
        .from("conversations")
        .select("is_group, group_members_count")
        .eq("id", conversationId)
        .single();
      
      const isGroup = conv?.is_group;
      const totalMembers = conv?.group_members_count || 2;
      const targetCount = totalMembers - 1;

      // 2. Fetch unread messages targeting this user
      const { data: unreadMsgs } = await supabase
        .from("messages")
        .select("id, read_by, sender_id")
        .eq("conversation_id", conversationId)
        .neq("sender_id", currentUserId)
        .neq("status", "read");
      
      if (unreadMsgs && unreadMsgs.length > 0) {
        for (const msg of unreadMsgs) {
          await this.updateStatus(msg.id, "read", currentUserId);
        }
      }

      // 3. Reset membership unread counter
      await supabase
        .from("conversation_members")
        .update({ unread_count: 0 })
        .eq("conversation_id", conversationId)
        .eq("user_id", currentUserId);

      // 4. Update conversation preview if the last message was indeed read by everyone
      // Note: This is an approximation for performance; in groups, the last message status only turns blue when everyone sees it.
      const { data: lastMsg } = await supabase
        .from("messages")
        .select("status, sender_id")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (lastMsg && lastMsg.status === "read") {
        await supabase
          .from("conversations")
          .update({ last_message_status: "read" })
          .eq("id", conversationId)
          .eq("last_message_sender_id", lastMsg.sender_id);
      }
    } catch (e) {
      console.warn("Exception updating message read state flags:", e);
    }
  },

  /**
   * Delete message globally for everyone by replacing text with placeholder.
   */
  async deleteMessageForEveryone(messageId, conversationId) {
    try {
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          messageId,
        );
      if (!messageId || !isUuid) return;

      const deletedPlaceholderText = "This message was deleted";
      await supabase
        .from("messages")
        .update({
          text: deletedPlaceholderText,
          type: "deleted",
        })
        .eq("id", messageId);

      if (conversationId) {
        await supabase
          .from("conversations")
          .update({
            last_message_text: deletedPlaceholderText,
            updated_at: new Date().toISOString(),
          })
          .eq("id", conversationId);
      }
    } catch (e) {
      console.warn("Delete for everyone exception:", e);
    }
  },

  /**
   * Toggle emoji reaction for current user encoded cleanly inside text.
   */
  async toggleReaction(
    messageId,
    currentUserId,
    emoji,
    currentCleanText,
    currentReactionsDict = {},
  ) {
    try {
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          messageId,
        );
      if (!messageId || !isUuid || !currentUserId) return;

      // Deep clone current reactions dict
      const newReactions = JSON.parse(JSON.stringify(currentReactionsDict));

      // Check if user already reacted with this exact emoji
      const hasReactedWithThisEmoji =
        Array.isArray(newReactions[emoji]) &&
        newReactions[emoji].includes(currentUserId);

      // First, remove user from all existing emojis to guarantee mutually exclusive reaction rule per user
      Object.keys(newReactions).forEach((key) => {
        if (Array.isArray(newReactions[key])) {
          newReactions[key] = newReactions[key].filter(
            (uid) => uid !== currentUserId,
          );
          if (newReactions[key].length === 0) {
            delete newReactions[key];
          }
        }
      });

      // If they hadn't reacted with this emoji, add them to it
      if (!hasReactedWithThisEmoji) {
        if (!newReactions[emoji]) {
          newReactions[emoji] = [];
        }
        newReactions[emoji].push(currentUserId);
      }

      const encodedText =
        currentCleanText + "|||R:" + JSON.stringify(newReactions);
      await supabase
        .from("messages")
        .update({ text: encodedText })
        .eq("id", messageId);

      return newReactions;
    } catch (e) {
      console.warn("Toggle reaction exception:", e);
      return null;
    }
  },
};
