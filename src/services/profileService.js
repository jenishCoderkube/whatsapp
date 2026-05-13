import { supabase } from "../lib/supabaseClient";

export const profileService = {
  /**
   * Search real database user profiles by partial name or email matching dynamically.
   * Excludes the current authenticated user from returned targets natively.
   */
  async searchProfiles(query = "", currentUserId = null) {
    try {
      let dbQuery = supabase
        .from("profiles")
        .select("*")
        .limit(20);

      if (query.trim()) {
        dbQuery = dbQuery.or(`name.ilike.%${query.trim()}%,email.ilike.%${query.trim()}%`);
      }

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentUserId);
      if (currentUserId && isUuid) {
        dbQuery = dbQuery.neq("id", currentUserId);
      }

      const { data, error } = await dbQuery;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.warn("Search profiles real query exception:", error);
      return [];
    }
  },

  /**
   * Retrieve dynamic complete target user profile record directly from Supabase.
   */
  async getProfileById(userId) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
      if (!userId || !isUuid) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      return null;
    }
  },

  /**
   * Dynamically broadcast current client connection status directly into target profiles row.
   */
  async updatePresence(userId, isOnline) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
      if (!userId || !isUuid) return;

      await supabase
        .from("profiles")
        .update({
          online: isOnline,
          last_seen: new Date().toISOString(),
        })
        .eq("id", userId);
    } catch (error) {
      // Swallowed safely to preserve real-time client loop stability
    }
  },
};
