import { supabase } from "../lib/supabaseClient";
import { parseMessageText, encodeMessageText } from "../utils/messageParser";

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
        const { text: cleanText, reactions, replyTo, isForwarded, noPreview } = parseMessageText(msg.text || "");

        return {
          id: msg.id,
          conversationId: msg.conversation_id,
          conversation_id: msg.conversation_id,
          text: cleanText,
          rawText: msg.text || "",
          reactions,
          replyTo: msg.reply_to || replyTo,
          isForwarded: msg.is_forwarded || isForwarded,
          noPreview: msg.no_preview || noPreview,
          editedAt: msg.edited_at,
          editHistory: msg.edit_history,
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
    replyTo = null,
    isForwarded = false,
    noPreview = false,
    clientId = null,
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

      const encodedText = encodeMessageText(text, replyTo, isForwarded, {}, noPreview);

      const insertPayload = {
        conversation_id: conversationId,
        sender_id: senderId,
        text: encodedText,
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
            hour12: true,
          }),
        reply_to: replyTo,
        is_forwarded: isForwarded,
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

      let newMsg = null;
      if (clientId) {
        try {
          const { data, error } = await supabase
            .from("messages")
            .insert({ ...insertPayload, client_id: clientId })
            .select()
            .single();
          if (error) throw error;
          newMsg = data;
        } catch (insertErr) {
          // Fallback if client_id column is not yet present in the DB schema (Pg code 42703: undefined_column)
          if (insertErr.code === "42703") {
            const { data, error } = await supabase
              .from("messages")
              .insert(insertPayload)
              .select()
              .single();
            if (error) throw error;
            newMsg = data;
          } else {
            throw insertErr;
          }
        }
      } else {
        const { data, error } = await supabase
          .from("messages")
          .insert(insertPayload)
          .select()
          .single();
        if (error) throw error;
        newMsg = data;
      }

      // Update background parent preview text strips asynchronously
      let previewText = text;
      if (type === "image") previewText = "Photo";
      if (type === "file") previewText = "Document";
      if (type === "voice") previewText = "Voice Message";
      if (type === "video") previewText = "Video";
      if (type === "sticker") previewText = "Sticker";
      if (type === "gif") previewText = "GIF";

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

      const { text: cleanText, reactions, replyTo: parsedReplyTo, isForwarded: parsedIsForward, noPreview: parsedNoPreview } = parseMessageText(newMsg.text || "");

      return {
        id: newMsg.id,
        conversationId: newMsg.conversation_id,
        conversation_id: newMsg.conversation_id,
        text: cleanText,
        rawText: newMsg.text || "",
        reactions: {},
        replyTo: newMsg.reply_to || parsedReplyTo || replyTo,
        isForwarded: newMsg.is_forwarded || parsedIsForward || isForwarded,
        noPreview: newMsg.no_preview || parsedNoPreview || noPreview,
        editedAt: newMsg.edited_at,
        editHistory: newMsg.edit_history,
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

      // 1. Fetch message to check time limit and conversation ID
      const { data: currentMsg, error: getError } = await supabase
        .from("messages")
        .select("created_at, sender_id, type, conversation_id")
        .eq("id", messageId)
        .single();
      if (getError || !currentMsg) return;

      // Validate 1-hour limit on the backend (3,600,000 milliseconds)
      const msgTime = new Date(currentMsg.created_at).getTime();
      if (Date.now() - msgTime > 3600000) {
        throw new Error("Time limit (1 hour) exceeded for Delete for Everyone");
      }

      const actualConvId = conversationId || currentMsg.conversation_id;
      const deletedPlaceholderText = "This message was deleted";

      // 2. Perform the update of the message row
      const { error: updateError } = await supabase
        .from("messages")
        .update({
          text: deletedPlaceholderText,
          type: "deleted",
        })
        .eq("id", messageId);
      if (updateError) throw updateError;

      // 3. Update conversation last message ONLY if this was the latest message in that conversation
      if (actualConvId) {
        // Fetch the latest remaining message in this conversation ordered by created_at desc
        const { data: latestMsgs, error: latestError } = await supabase
          .from("messages")
          .select("id")
          .eq("conversation_id", actualConvId)
          .order("created_at", { ascending: false })
          .limit(1);

        if (!latestError && latestMsgs && latestMsgs.length > 0) {
          // If the message we just updated is the latest message in the DB
          if (latestMsgs[0].id === messageId) {
            await supabase
              .from("conversations")
              .update({
                last_message_text: deletedPlaceholderText,
                updated_at: new Date().toISOString(),
              })
              .eq("id", actualConvId);
          }
        }
      }
    } catch (e) {
      console.warn("Delete for everyone exception:", e);
      throw e;
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

  /**
   * Search conversation messages dynamically directly in the PostgreSQL database.
   */
  async searchConversationMessages(conversationId, queryTerm) {
    try {
      if (!conversationId || !queryTerm?.trim()) return [];
      
      const { data, error } = await supabase
        .from("messages")
        .select("*, profiles:sender_id(name, avatar)")
        .eq("conversation_id", conversationId)
        .ilike("text", `%${queryTerm.trim()}%`)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      if (!data) return [];

      return data.map((msg) => {
        const { text: cleanText } = parseMessageText(msg.text || "");
        return {
          id: msg.id,
          text: cleanText,
          rawText: msg.text,
          createdAt: msg.created_at,
          senderName: msg.profiles?.name || "Member",
        };
      });
    } catch (e) {
      console.warn("searchConversationMessages database error:", e);
      return [];
    }
  },

  /**
   * Fetch context messages surrounding a target message by ID.
   * Gets up to `limitCount` older and `limitCount` newer messages.
   */
  async fetchMessageContext(messageId, limitCount = 20, currentUserId = null) {
    try {
      if (!messageId) return [];

      const { data: targetMsg, error: targetError } = await supabase
        .from("messages")
        .select("*, profiles:sender_id(name, avatar)")
        .eq("id", messageId)
        .single();

      if (targetError || !targetMsg) throw targetError || new Error("Target message not found");

      const conversationId = targetMsg.conversation_id;
      const targetCreatedAt = targetMsg.created_at;

      const { data: beforeData, error: beforeError } = await supabase
        .from("messages")
        .select("*, profiles:sender_id(name, avatar)")
        .eq("conversation_id", conversationId)
        .lt("created_at", targetCreatedAt)
        .order("created_at", { ascending: false })
        .limit(limitCount);

      if (beforeError) throw beforeError;

      const { data: afterData, error: afterError } = await supabase
        .from("messages")
        .select("*, profiles:sender_id(name, avatar)")
        .eq("conversation_id", conversationId)
        .gt("created_at", targetCreatedAt)
        .order("created_at", { ascending: true })
        .limit(limitCount);

      if (afterError) throw afterError;

      const mapMessage = (msg) => {
        const isMine = currentUserId ? msg.sender_id === currentUserId : false;
        const { text: cleanText, reactions, replyTo, isForwarded, noPreview } = parseMessageText(msg.text || "");
        return {
          id: msg.id,
          conversationId: msg.conversation_id,
          conversation_id: msg.conversation_id,
          text: cleanText,
          rawText: msg.text || "",
          reactions,
          replyTo: msg.reply_to || replyTo,
          isForwarded: msg.is_forwarded || isForwarded,
          noPreview: msg.no_preview || noPreview,
          editedAt: msg.edited_at,
          editHistory: msg.edit_history,
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
          sender_id: msg.sender_id,
          senderName: msg.profiles?.name || "Member",
          senderAvatar: msg.profiles?.avatar,
          createdAt: msg.created_at,
        };
      };

      const chronologicalBefore = (beforeData || []).reverse().map(mapMessage);
      const targetMapped = mapMessage(targetMsg);
      const chronologicalAfter = (afterData || []).map(mapMessage);

      return [...chronologicalBefore, targetMapped, ...chronologicalAfter];
    } catch (e) {
      console.warn("fetchMessageContext error:", e);
      return [];
    }
  },

  /**
   * Fetch newer messages in chronological ascending order subsequent to cursor created_at timestamp.
   */
  async fetchNewerMessages(
    conversationId,
    afterCreatedAtCursor,
    limitCount = 20,
    currentUserId = null,
  ) {
    try {
      if (!conversationId || !afterCreatedAtCursor) return [];

      const { data, error } = await supabase
        .from("messages")
        .select("*, profiles:sender_id(name, avatar)")
        .eq("conversation_id", conversationId)
        .gt("created_at", afterCreatedAtCursor)
        .order("created_at", { ascending: true })
        .limit(limitCount);

      if (error) throw error;
      if (!data) return [];

      return data.map((msg) => {
        const isMine = currentUserId ? msg.sender_id === currentUserId : false;
        const { text: cleanText, reactions, replyTo, isForwarded, noPreview } = parseMessageText(msg.text || "");

        return {
          id: msg.id,
          conversationId: msg.conversation_id,
          conversation_id: msg.conversation_id,
          text: cleanText,
          rawText: msg.text || "",
          reactions,
          replyTo: msg.reply_to || replyTo,
          isForwarded: msg.is_forwarded || isForwarded,
          noPreview: msg.no_preview || noPreview,
          editedAt: msg.edited_at,
          editHistory: msg.edit_history,
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
          sender_id: msg.sender_id,
          senderName: msg.profiles?.name || "Member",
          senderAvatar: msg.profiles?.avatar,
          createdAt: msg.created_at,
        };
      });
    } catch (error) {
      console.warn("fetchNewerMessages error:", error);
      return [];
    }
  },

  /**
   * Remove quoted reply context from a message.
   */
  async removeMessageReplyContext(messageId) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(messageId);
      if (!messageId || !isUuid) return;

      // 1. Fetch current raw text
      const { data: msg } = await supabase
        .from("messages")
        .select("text")
        .eq("id", messageId)
        .single();
      
      if (!msg) return;

      // 2. Parse and strip out the ReplyTo: part
      let cleanText = msg.text || "";
      if (cleanText.includes("|||ReplyTo:")) {
        const parts = cleanText.split("|||ReplyTo:");
        // Keep reactions or other parts if present
        let afterPart = "";
        if (parts[1] && parts[1].includes("|||R:")) {
          const rParts = parts[1].split("|||R:");
          afterPart = "|||R:" + rParts[1];
        }
        cleanText = parts[0] + afterPart;
      }

      // 3. Update in database
      const { error } = await supabase
        .from("messages")
        .update({
          text: cleanText,
          reply_to: null
        })
        .eq("id", messageId);
      
      if (error) throw error;
    } catch (e) {
      console.warn("Failed to remove reply context:", e);
    }
  },

  /**
   * Edit a sent message within a configurable time limit.
   * Preserves delivery/read states and updates the last message text in the conversation.
   */
  async editMessage(messageId, newText, currentUserId) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(messageId);
      if (!messageId || !isUuid || !currentUserId) {
        throw new Error("Invalid parameters for editing message.");
      }

      // 1. Fetch current message state
      const { data: currentMsg, error: fetchError } = await supabase
        .from("messages")
        .select("*")
        .eq("id", messageId)
        .single();

      if (fetchError || !currentMsg) {
        throw new Error("Message not found.");
      }

      // 2. Validate permissions (must be the sender)
      if (currentMsg.sender_id !== currentUserId) {
        throw new Error("Action restricted: You can only edit your own messages.");
      }

      // 3. Validate message type (cannot edit deleted messages)
      if (currentMsg.type === "deleted" || currentMsg.text === "This message was deleted") {
        throw new Error("Action restricted: Cannot edit deleted messages.");
      }

      // 4. Validate time limit (e.g. 15 minutes)
      const EDIT_TIME_LIMIT_MS = 15 * 60 * 1000;
      const messageAge = Date.now() - new Date(currentMsg.created_at).getTime();
      if (messageAge > EDIT_TIME_LIMIT_MS) {
        throw new Error("Action restricted: Messages can only be edited within 15 minutes.");
      }

      // 5. Check if text is actually changed
      const { text: cleanCurrentText } = parseMessageText(currentMsg.text || "");
      if (cleanCurrentText.trim() === newText.trim()) {
        return currentMsg; // No change needed, return unchanged
      }

      // 6. Build the new encoded message text (preserving reactions, replies, noPreview, etc.)
      const parsed = parseMessageText(currentMsg.text || "");
      const newEncodedText = encodeMessageText(
        newText,
        currentMsg.reply_to || parsed.replyTo,
        currentMsg.is_forwarded || parsed.isForwarded,
        parsed.reactions,
        parsed.noPreview
      );

      // 7. Update edit history
      const currentHistory = Array.isArray(currentMsg.edit_history) ? currentMsg.edit_history : [];
      const newHistoryItem = {
        text: cleanCurrentText,
        editedAt: new Date().toISOString()
      };
      const updatedHistory = [...currentHistory, newHistoryItem];

      // 8. Update in database
      const { data: updatedMsg, error: updateError } = await supabase
        .from("messages")
        .update({
          text: newEncodedText,
          edited_at: new Date().toISOString(),
          edit_history: updatedHistory
        })
        .eq("id", messageId)
        .select()
        .single();

      if (updateError) throw updateError;

      // 9. Update last message text in conversation if this is indeed the latest message
      // Fetch latest message in the conversation
      const { data: latestMsg } = await supabase
        .from("messages")
        .select("id, created_at, text, type")
        .eq("conversation_id", currentMsg.conversation_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (latestMsg && latestMsg.id === messageId) {
        let previewText = newText;
        if (currentMsg.type === "image") previewText = "Photo";
        if (currentMsg.type === "file") previewText = "Document";
        if (currentMsg.type === "voice") previewText = "Voice Message";
        if (currentMsg.type === "video") previewText = "Video";
        if (currentMsg.type === "sticker") previewText = "Sticker";
        if (currentMsg.type === "gif") previewText = "GIF";

        await supabase
          .from("conversations")
          .update({
            last_message_text: previewText,
            updated_at: new Date().toISOString(),
          })
          .eq("id", currentMsg.conversation_id);
      }

      const { text: cleanText, reactions, replyTo: parsedReplyTo, isForwarded: parsedIsForward, noPreview: parsedNoPreview } = parseMessageText(updatedMsg.text || "");

      return {
        id: updatedMsg.id,
        conversationId: updatedMsg.conversation_id,
        conversation_id: updatedMsg.conversation_id,
        text: cleanText,
        rawText: updatedMsg.text || "",
        reactions: reactions || {},
        replyTo: updatedMsg.reply_to || parsedReplyTo,
        isForwarded: updatedMsg.is_forwarded || parsedIsForward,
        noPreview: updatedMsg.no_preview || parsedNoPreview,
        editedAt: updatedMsg.edited_at,
        editHistory: updatedMsg.edit_history,
        timestamp: updatedMsg.timestamp_string || new Date(updatedMsg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: updatedMsg.status,
        type: updatedMsg.type,
        mediaUrl: updatedMsg.media_url,
        fileName: updatedMsg.file_name,
        fileSize: updatedMsg.file_size,
        duration: updatedMsg.duration,
        senderId: updatedMsg.sender_id,
        sender_id: updatedMsg.sender_id,
        isOutgoing: true,
        createdAt: updatedMsg.created_at,
      };
    } catch (error) {
      console.warn("editMessage exception:", error);
      throw error;
    }
  }
};
