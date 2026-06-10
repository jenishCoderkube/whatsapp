import { supabase } from "../lib/supabaseClient";

export const blockService = {
  /**
   * Block a user.
   */
  async blockUser(blockerId, blockedId) {
    if (!blockerId || !blockedId) return null;
    const { data, error } = await supabase
      .from("blocked_users")
      .insert([{ blocker_id: blockerId, blocked_id: blockedId }])
      .select();

    if (error) {
      console.error("Block user failed:", error);
      throw error;
    }
    return data;
  },

  /**
   * Unblock a user.
   */
  async unblockUser(blockerId, blockedId) {
    if (!blockerId || !blockedId) return null;
    const { data, error } = await supabase
      .from("blocked_users")
      .delete()
      .eq("blocker_id", blockerId)
      .eq("blocked_id", blockedId)
      .select();

    if (error) {
      console.error("Unblock user failed:", error);
      throw error;
    }
    return data;
  },

  /**
   * Get profiles of users blocked by this user.
   */
  async getBlockedUsers(userId) {
    if (!userId) return [];
    try {
      const { data: relations, error: relError } = await supabase
        .from("blocked_users")
        .select("blocked_id")
        .eq("blocker_id", userId);

      if (relError) throw relError;
      if (!relations || relations.length === 0) return [];

      const blockedIds = relations.map((r) => r.blocked_id);
      const { data: profiles, error: profError } = await supabase
        .from("profiles")
        .select("*")
        .in("id", blockedIds);

      if (profError) throw profError;
      return profiles || [];
    } catch (error) {
      console.warn("Error getting blocked users:", error);
      return [];
    }
  },

  /**
   * Get list of user IDs who blocked this user.
   */
  async getBlockedByUsers(userId) {
    if (!userId) return [];
    try {
      const { data, error } = await supabase
        .from("blocked_users")
        .select("blocker_id")
        .eq("blocked_id", userId);

      if (error) throw error;
      return data ? data.map((r) => r.blocker_id) : [];
    } catch (error) {
      console.warn("Error getting blocked by list:", error);
      return [];
    }
  },

  /**
   * Subscribe to block relationship changes in real-time.
   * This handles additions/deletions of block records.
   */
  subscribeToBlockedChanges(userId, onEvent) {
    if (!userId) return null;
    return supabase
      .channel(`blocked_users_realtime_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "blocked_users",
        },
        (payload) => {
          onEvent(payload);
        }
      )
      .subscribe();
  },
};
