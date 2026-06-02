import { supabase } from "../lib/supabaseClient";

export const lockSyncService = {
  /**
   * Fetch lock settings from Supabase Auth user metadata
   */
  async fetchLockSettings() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      const user = session?.user;
      if (error || !user) return null;
      return user.user_metadata?.lock_settings || null;
    } catch (e) {
      console.error("Failed to fetch lock settings from Supabase:", e);
      return null;
    }
  },

  /**
   * Save lock settings to Supabase Auth user metadata
   */
  async saveLockSettings(settings) {
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          lock_settings: settings
        }
      });
      if (error) throw error;
      return true;
    } catch (e) {
      console.error("Failed to save lock settings to Supabase:", e);
      return false;
    }
  }
};
