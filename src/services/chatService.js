import { supabase } from "../lib/supabaseClient";

export const chatService = {
  /**
   * Fetch all real conversation rows joined by the user dynamically from Supabase,
   * dynamically resolving peer mapping metadata for 1-to-1 chats to guarantee absolute drop-in interface parity.
   */
  async getUserChats(userId) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
      if (!userId || !isUuid) return [];

      // Query real database membership associations
      const { data: members, error: membersError } = await supabase
        .from("conversation_members")
        .select(`
          unread_count,
          conversation_id,
          conversations (*)
        `)
        .eq("user_id", userId);

      if (membersError) throw membersError;
      if (!members || members.length === 0) return [];

      // Extract valid conversations natively
      const mappedChats = [];

      for (const item of members) {
        const conv = item.conversations;
        if (!conv) continue;

        let name = conv.name || "Chat";
        let avatar = conv.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80";
        let online = false;
        let phoneNumber = conv.is_group ? "Group Chat" : "Contact";
        let peerId = null;
        let lastSeen = null;

        // For 1-to-1, resolve the dynamic peer profile schema natively
        if (!conv.is_group) {
          const { data: peerMembers } = await supabase
            .from("conversation_members")
            .select("user_id")
            .eq("conversation_id", conv.id)
            .neq("user_id", userId)
            .limit(1);

          if (peerMembers && peerMembers.length > 0) {
            peerId = peerMembers[0].user_id;
            const { data: peerProfile } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", peerId)
              .single();

            if (peerProfile) {
              name = peerProfile.name;
              avatar = peerProfile.avatar || avatar;
              online = peerProfile.online || false;
              phoneNumber = peerProfile.email || "Direct Contact";
              lastSeen = peerProfile.last_seen;
            }
          }
        }

        mappedChats.push({
          id: conv.id,
          name,
          avatar,
          unreadCount: item.unread_count || 0,
          lastMessage: conv.last_message_text ? {
            text: conv.last_message_text,
            timestamp: conv.last_message_timestamp || "",
            status: conv.last_message_status || "read",
            isOutgoing: false, // fallback calculated dynamically in ui state reducers
          } : null,
          online,
          phoneNumber,
          peerId,
          lastSeen,
          isGroup: conv.is_group || false,
          updatedAt: conv.updated_at,
        });
      }

      // Sort natively pushing latest updated active threads upwards
      return mappedChats.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    } catch (error) {
      console.warn("Dynamic user chats sync database exception:", error);
      return [];
    }
  },

  /**
   * Automatically resolve peer association lookup or insert fresh active verified room item.
   */
  async createOrOpenOneToOneChat(currentUserId, targetUser) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentUserId);
      if (!isUuid) {
        throw new Error("Current authenticated user identifier is not a valid database UUID mapping.");
      }

      // 1. Search true shared conversation IDs
      const { data: myMemberships } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", currentUserId);

      if (myMemberships && myMemberships.length > 0) {
        const myConvIds = myMemberships.map((m) => m.conversation_id);

        const { data: targetMemberships } = await supabase
          .from("conversation_members")
          .select("conversation_id, conversations!inner(is_group)")
          .eq("user_id", targetUser.id)
          .in("conversation_id", myConvIds)
          .eq("conversations.is_group", false);

        if (targetMemberships && targetMemberships.length > 0) {
          // Real room row already created, drop-in resolve directly
          const existingId = targetMemberships[0].conversation_id;
          return {
            id: existingId,
            name: targetUser.name,
            avatar: targetUser.avatar,
            unreadCount: 0,
            lastMessage: null,
            online: targetUser.online,
            phoneNumber: targetUser.email,
            peerId: targetUser.id,
            lastSeen: targetUser.last_seen,
            isGroup: false,
          };
        }
      }

      // 2. Spawn fresh verified database room item
      const { data: newConv, error: convError } = await supabase
        .from("conversations")
        .insert({
          is_group: false,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (convError) throw convError;

      // 3. Append relational peer records cleanly
      await supabase.from("conversation_members").insert([
        { conversation_id: newConv.id, user_id: currentUserId },
        { conversation_id: newConv.id, user_id: targetUser.id },
      ]);

      return {
        id: newConv.id,
        name: targetUser.name,
        avatar: targetUser.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb",
        unreadCount: 0,
        lastMessage: null,
        online: targetUser.online || false,
        phoneNumber: targetUser.email || "Contact",
        peerId: targetUser.id,
        lastSeen: targetUser.last_seen,
        isGroup: false,
      };
    } catch (error) {
      throw new Error("Unable to establish pristine conversation thread: " + error.message);
    }
  },

  /**
   * Spawn native multi-user Group chat strictly driven by database rows.
   */
  async createGroupChat({ name, avatar, currentUserId, memberIds = [] }) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentUserId);
      if (!isUuid) {
        throw new Error("Invalid operational state: Current user does not hold a proper database UUID token.");
      }

      // Insert persistent group item record
      const { data: newGroup, error } = await supabase
        .from("conversations")
        .insert({
          name,
          avatar,
          is_group: true,
          last_message_text: "Group created.",
          last_message_timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Construct distinct absolute member payload indices
      const allMembers = Array.from(new Set([currentUserId, ...memberIds]));
      const insertPayloads = allMembers.map((uid) => ({
        conversation_id: newGroup.id,
        user_id: uid,
      }));

      await supabase.from("conversation_members").insert(insertPayloads);

      return {
        id: newGroup.id,
        name: newGroup.name,
        avatar: newGroup.avatar || "https://images.unsplash.com/photo-1522071820081-009f0129c71c",
        unreadCount: 0,
        lastMessage: {
          text: "Group created.",
          timestamp: newGroup.last_message_timestamp,
          status: "sent",
        },
        online: false,
        phoneNumber: "Group Chat",
        isGroup: true,
      };
    } catch (error) {
      throw new Error("Group pipeline construction aborted: " + error.message);
    }
  },
};
