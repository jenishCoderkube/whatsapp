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

      // Resilient check: Query columns if migrated, fallback if not
      let members = [];
      try {
        const { data, error } = await supabase
          .from("conversation_members")
          .select(`
            unread_count,
            conversation_id,
            is_left,
            is_pinned,
            pinned_at,
            is_archived,
            archived_at,
            wallpaper,
            conversations (*)
          `)
          .eq("user_id", userId);

        if (error) throw error;
        members = data || [];
      } catch (err) {
        const { data, error } = await supabase
          .from("conversation_members")
          .select(`
            unread_count,
            conversation_id,
            is_left,
            conversations (*)
          `)
          .eq("user_id", userId);

        if (error) throw error;
        members = data || [];
      }

      if (members.length === 0) return [];

      // Batch query all peer conversation members and their profiles for 1-to-1 chats at once
      const oneToOneConvIds = members
        .filter((item) => item.conversations && !item.conversations.is_group)
        .map((item) => item.conversation_id);

      const peerMap = {};
      if (oneToOneConvIds.length > 0) {
        const { data: peerMembers, error: peerError } = await supabase
          .from("conversation_members")
          .select(`
            conversation_id,
            user_id,
            profiles (*)
          `)
          .in("conversation_id", oneToOneConvIds)
          .neq("user_id", userId);

        if (peerError) {
          console.error("Failed fetching peer profiles in batch:", peerError);
        } else if (peerMembers) {
          for (const pm of peerMembers) {
            if (pm.profiles) {
              peerMap[pm.conversation_id] = {
                peerId: pm.user_id,
                profile: pm.profiles
              };
            }
          }
        }
      }

      const mappedChats = [];

      for (const item of members) {
        const conv = item.conversations;
        if (!conv) continue;

        let name = conv.name || "Chat";
        let avatar = conv.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80";
        let online = false;
        let phoneNumber = conv.is_group ? `${conv.group_members_count || 2} members` : "Contact";
        let peerId = null;
        let lastSeen = null;

        // Fallbacks for Pin/Archive states
        let isPinned = item.is_pinned || false;
        let pinnedAt = item.pinned_at || null;
        let isArchived = item.is_archived || false;
        let archivedAt = item.archived_at || null;

        if (typeof window !== "undefined") {
          try {
            const pinnedList = JSON.parse(localStorage.getItem("wa_pinned_chats") || "[]");
            const archivedList = JSON.parse(localStorage.getItem("wa_archived_chats") || "[]");
            
            if (pinnedList.includes(conv.id)) {
              isPinned = true;
              if (!pinnedAt) pinnedAt = new Date().toISOString();
            }
            if (archivedList.includes(conv.id)) {
              isArchived = true;
              if (!archivedAt) archivedAt = new Date().toISOString();
            }
          } catch (e) {}
        }

        // For 1-to-1, resolve the dynamic peer profile profile details using pre-fetched peerMap
        if (!conv.is_group) {
          const peerData = peerMap[conv.id];
          if (peerData) {
            peerId = peerData.peerId;
            const peerProfile = peerData.profile;
            if (peerProfile) {
              name = peerProfile.name || name;
              avatar = peerProfile.avatar || avatar;
              online = peerProfile.online || false;
              phoneNumber = peerProfile.email || "Direct Contact";
              lastSeen = peerProfile.last_seen;
            }
          }
        }

        let chatWallpaper = item.wallpaper || null;
        if (!chatWallpaper && typeof window !== "undefined") {
          try {
            chatWallpaper = localStorage.getItem(`wa_wallpaper_user_${userId}_chat_${conv.id}`);
          } catch (e) {}
        }

        mappedChats.push({
          id: conv.id,
          name,
          avatar,
          unreadCount: item.unread_count || 0,
          isLeft: item.is_left || false,
          isPinned,
          pinnedAt,
          isArchived,
          archivedAt,
          lastMessage: conv.last_message_text ? {
            text: conv.last_message_text,
            timestamp: conv.last_message_timestamp || "",
            status: conv.last_message_status || "sent",
            isOutgoing: conv.last_message_sender_id === userId,
          } : null,
          online,
          phoneNumber,
          peerId,
          lastSeen,
          isGroup: conv.is_group || false,
          groupCreatorId: conv.group_creator_id,
          groupMembersCount: conv.group_members_count || 0,
          updatedAt: conv.updated_at,
          disappearingDuration: conv.disappearing_duration || 0,
          wallpaper: chatWallpaper,
        });
      }


      // Sort natively pushing pinned first, then sorting chronologically
      return mappedChats.sort((a, b) => {
        if (a.isPinned && b.isPinned) {
          return new Date(b.pinnedAt || b.updatedAt || 0) - new Date(a.pinnedAt || a.updatedAt || 0);
        }
        if (a.isPinned) return -1;
        if (b.isPinned) return 1;
        return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
      });
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
          .select("conversation_id, conversations!inner(is_group, disappearing_duration)")
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
            groupCreatorId: null,
            disappearingDuration: targetMemberships[0].conversations?.disappearing_duration || 0,
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
        disappearingDuration: newConv.disappearing_duration || 0,
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
          last_message_timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }),
          last_message_status: "sent",
          last_message_sender_id: currentUserId,
          group_creator_id: currentUserId,
          group_members_count: Array.from(new Set([currentUserId, ...memberIds])).length,
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
          isOutgoing: true,
        },
        online: false,
        phoneNumber: `${allMembers.length} members`,
        isGroup: true,
        groupCreatorId: newGroup.group_creator_id,
        groupMembersCount: allMembers.length,
        updatedAt: newGroup.updated_at,
        disappearingDuration: newGroup.disappearing_duration || 0,
      };
    } catch (error) {
      throw new Error("Group pipeline construction aborted: " + error.message);
    }
  },

  /**
   * Fetch all members of a specific group room.
   */
  async getGroupMembers(conversationId) {
    const { data, error } = await supabase
      .from("conversation_members")
      .select("user_id, is_left, profiles(*)")
      .eq("conversation_id", conversationId)
      .eq("is_left", false);
    
    if (error) throw error;
    return data.map(m => m.profiles);
  },

  /**
   * Add new participants to an existing group.
   */
  async addGroupMembers(conversationId, memberIds, adminId) {
    try {
      const uniqueIds = Array.from(new Set(memberIds));
      
      // 0. Fetch existing memberships to filter out those who are already active members
      const { data: currentMemberships } = await supabase
        .from("conversation_members")
        .select("user_id, is_left")
        .eq("conversation_id", conversationId)
        .in("user_id", uniqueIds);

      const alreadyActiveIds = currentMemberships?.filter(m => !m.is_left).map(m => m.user_id) || [];
      const leftMemberIds = currentMemberships?.filter(m => m.is_left).map(m => m.user_id) || [];
      
      // We only want to process users who aren't already active participants
      const usersToProcess = uniqueIds.filter(id => !alreadyActiveIds.includes(id));
      if (usersToProcess.length === 0) return;

      const newMemberIds = usersToProcess.filter(id => !leftMemberIds.includes(id));
      const membersToReactivate = usersToProcess.filter(id => leftMemberIds.includes(id));

      // 1. Reactivate left members
      if (membersToReactivate.length > 0) {
        await supabase
          .from("conversation_members")
          .update({ is_left: false, unread_count: 0 })
          .eq("conversation_id", conversationId)
          .in("user_id", membersToReactivate);
      }

      // 2. Insert brand new members
      if (newMemberIds.length > 0) {
        const insertPayloads = newMemberIds.map((uid) => ({
          conversation_id: conversationId,
          user_id: uid,
        }));
        await supabase.from("conversation_members").insert(insertPayloads);
      }

      // 3. Update count in parent conversations table
      const { data: members } = await supabase
        .from("conversation_members")
        .select("user_id")
        .eq("conversation_id", conversationId)
        .eq("is_left", false);
      
      await supabase
        .from("conversations")
        .update({ group_members_count: members.length, updated_at: new Date().toISOString() })
        .eq("id", conversationId);

      // Create system messages for each processed member
      for (const uid of usersToProcess) {
        const { data: profile } = await supabase.from("profiles").select("name").eq("id", uid).single();
        const { data: adminProfile } = await supabase.from("profiles").select("name").eq("id", adminId).single();
        
        await supabase.from("messages").insert({
          conversation_id: conversationId,
          sender_id: adminId,
          text: `${adminProfile?.name || "Admin"} added ${profile?.name || "Member"}`,
          type: "system",
          status: "sent",
          delivered_to: [],
          read_by: []
        });
      }
    } catch (err) {
      console.error("Add group members failed:", err);
      throw err;
    }
  },

  /**
   * Remove a member from a group (Soft delete/Leave).
   */
  async removeGroupMember(conversationId, userId, adminId) {
    try {
      const { data: profile } = await supabase.from("profiles").select("name").eq("id", userId).single();
      const { data: adminProfile } = await supabase.from("profiles").select("name").eq("id", adminId).single();

      // Soft leave instead of hard delete
      const { error } = await supabase
        .from("conversation_members")
        .update({ is_left: true, unread_count: 0 })
        .eq("conversation_id", conversationId)
        .eq("user_id", userId);
      
      if (error) throw error;

      // Update count in parent
      const { data: members } = await supabase
        .from("conversation_members")
        .select("user_id")
        .eq("conversation_id", conversationId)
        .eq("is_left", false);
      
      await supabase
        .from("conversations")
        .update({ group_members_count: members.length, updated_at: new Date().toISOString() })
        .eq("id", conversationId);

      // System message
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: adminId,
        text: adminId === userId ? `${profile?.name} left` : `${adminProfile?.name || "Admin"} removed ${profile?.name}`,
        type: "system",
        status: "sent",
        delivered_to: [],
        read_by: []
      });
    } catch (err) {
      console.error("Remove group member failed:", err);
      throw err;
    }
  },

  /**
   * Leave a group room.
   */
  async leaveGroup(conversationId, userId) {
    return this.removeGroupMember(conversationId, userId, userId);
  },

  /**
   * Update group avatar.
   */
  async updateGroupAvatar(conversationId, avatarUrl) {
    const { error } = await supabase
      .from("conversations")
      .update({ avatar: avatarUrl, updated_at: new Date().toISOString() })
      .eq("id", conversationId);
    
    if (error) throw error;
    return true;
  },

  async togglePinChat(chatId, userId, isPinned) {
    try {
      // 1. Local fallbacks
      if (typeof window !== "undefined") {
        const pinnedList = JSON.parse(localStorage.getItem("wa_pinned_chats") || "[]");
        if (isPinned) {
          if (!pinnedList.includes(chatId)) pinnedList.push(chatId);
        } else {
          const idx = pinnedList.indexOf(chatId);
          if (idx > -1) pinnedList.splice(idx, 1);
        }
        localStorage.setItem("wa_pinned_chats", JSON.stringify(pinnedList));
      }

      // 2. DB Update
      await supabase
        .from("conversation_members")
        .update({
          is_pinned: isPinned,
          pinned_at: isPinned ? new Date().toISOString() : null
        })
        .eq("conversation_id", chatId)
        .eq("user_id", userId);
    } catch (e) {
      console.warn("Resilient pin sync bypass exception:", e);
    }
  },

  async toggleArchiveChat(chatId, userId, isArchived) {
    try {
      // 1. Local fallbacks
      if (typeof window !== "undefined") {
        const archivedList = JSON.parse(localStorage.getItem("wa_archived_chats") || "[]");
        if (isArchived) {
          if (!archivedList.includes(chatId)) archivedList.push(chatId);
          // Auto unpin
          const pinnedList = JSON.parse(localStorage.getItem("wa_pinned_chats") || "[]");
          const pinIdx = pinnedList.indexOf(chatId);
          if (pinIdx > -1) {
            pinnedList.splice(pinIdx, 1);
            localStorage.setItem("wa_pinned_chats", JSON.stringify(pinnedList));
          }
        } else {
          const idx = archivedList.indexOf(chatId);
          if (idx > -1) archivedList.splice(idx, 1);
        }
        localStorage.setItem("wa_archived_chats", JSON.stringify(archivedList));
      }

      // 2. DB Update
      const updatePayload = {
        is_archived: isArchived,
        archived_at: isArchived ? new Date().toISOString() : null
      };
      if (isArchived) {
        updatePayload.is_pinned = false;
        updatePayload.pinned_at = null;
      }

      await supabase
        .from("conversation_members")
        .update(updatePayload)
        .eq("conversation_id", chatId)
        .eq("user_id", userId);
    } catch (e) {
      console.warn("Resilient archive sync bypass exception:", e);
    }
  },

  /**
   * Update the disappearing messages settings for a chat (seconds duration).
   * Also inserts a system notification message indicating the setting has changed.
   */
  async updateDisappearingDuration(conversationId, duration, userId) {
    try {
      const { data: updatedConv, error } = await supabase
        .from("conversations")
        .update({
          disappearing_duration: duration,
          updated_at: new Date().toISOString()
        })
        .eq("id", conversationId)
        .select()
        .single();

      if (error) throw error;

      // Insert system message about setting change
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", userId)
        .single();
      
      const userName = profile?.name || "Someone";
      let text = "";
      if (duration === 0) {
        text = `${userName} turned off disappearing messages.`;
      } else if (duration === 86400) {
        text = `${userName} set messages to disappear after 24 hours.`;
      } else if (duration === 604800) {
        text = `${userName} set messages to disappear after 7 days.`;
      } else if (duration === 7776000) {
        text = `${userName} set messages to disappear after 90 days.`;
      }

      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: userId,
        text,
        type: "system",
        status: "sent",
        delivered_to: [],
        read_by: []
      });

      return updatedConv;
    } catch (err) {
      console.error("updateDisappearingDuration failed:", err);
      throw err;
    }
  }
};
