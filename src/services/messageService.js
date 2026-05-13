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
        .select("*")
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
        return {
          id: msg.id,
          text: msg.text || "",
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
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId);

      return {
        id: newMsg.id,
        text: newMsg.text || "",
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
      throw new Error("Real message broadcast interrupted: " + error.message);
    }
  },

  /**
   * Update message read/delivered verification status checkmarks.
   */
  async updateStatus(messageId, status) {
    try {
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          messageId,
        );
      if (!messageId || !isUuid) return;
      await supabase.from("messages").update({ status }).eq("id", messageId);
    } catch (e) {}
  },

  /**
   * Instantly flag incoming unread sequences targeting the user inside active conversation loops as Read.
   */
  async markConversationMessagesAsRead(conversationId, currentUserId) {
    try {
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          conversationId,
        );
      if (!conversationId || !isUuid || !currentUserId) return;

      // Overwrite target database status fields natively
      await supabase
        .from("messages")
        .update({ status: "read" })
        .eq("conversation_id", conversationId)
        .neq("sender_id", currentUserId)
        .neq("status", "read");

      // Reset membership relative count counters dynamically
      await supabase
        .from("conversation_members")
        .update({ unread_count: 0 })
        .eq("conversation_id", conversationId)
        .eq("user_id", currentUserId);

      // Realign root UI parent preview items
      await supabase
        .from("conversations")
        .update({ last_message_status: "read" })
        .eq("id", conversationId);
    } catch (e) {
      console.warn("Exception updating message read state flags:", e);
    }
  },
};
