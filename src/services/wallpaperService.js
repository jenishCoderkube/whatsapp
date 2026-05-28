import { supabase } from "../lib/supabaseClient";

export const wallpaperService = {
  /**
   * Get the global/default wallpaper for a user.
   * Checks database first, fallbacks to localStorage.
   */
  async getGlobalWallpaper(userId) {
    if (!userId) return null;
    
    // 1. Local Storage Fallback check
    let localVal = null;
    if (typeof window !== "undefined") {
      try {
        localVal = localStorage.getItem(`wa_wallpaper_user_${userId}_global`);
      } catch (e) {
        console.warn("localStorage read failed:", e);
      }
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("wallpaper")
        .eq("id", userId)
        .single();
      
      if (error) {
        // Log gently, might be column not migrated yet
        console.warn("Failed fetching global wallpaper from DB (could be missing column):", error.message);
        return localVal;
      }
      
      const dbVal = data?.wallpaper;
      if (dbVal && typeof window !== "undefined") {
        try {
          localStorage.setItem(`wa_wallpaper_user_${userId}_global`, dbVal);
        } catch (e) {}
      }
      return dbVal || localVal;
    } catch (err) {
      return localVal;
    }
  },

  /**
   * Set the global/default wallpaper for a user.
   */
  async setGlobalWallpaper(userId, wallpaperValue) {
    if (!userId) return false;

    // 1. Write to Local Storage
    if (typeof window !== "undefined") {
      try {
        if (wallpaperValue) {
          localStorage.setItem(`wa_wallpaper_user_${userId}_global`, wallpaperValue);
        } else {
          localStorage.removeItem(`wa_wallpaper_user_${userId}_global`);
        }
      } catch (e) {
        console.warn("localStorage write failed:", e);
      }
    }

    // 2. Write to Supabase DB profiles table
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ wallpaper: wallpaperValue })
        .eq("id", userId);

      if (error) {
        console.warn("Failed updating global wallpaper in DB (could be missing column):", error.message);
        return false;
      }
      return true;
    } catch (err) {
      return false;
    }
  },

  /**
   * Get custom wallpaper for a specific chat conversation.
   * Checks database first, fallbacks to localStorage.
   */
  async getChatWallpaper(userId, chatId) {
    if (!userId || !chatId) return null;

    // 1. Local Storage Fallback check
    let localVal = null;
    if (typeof window !== "undefined") {
      try {
        localVal = localStorage.getItem(`wa_wallpaper_user_${userId}_chat_${chatId}`);
      } catch (e) {
        console.warn("localStorage read failed:", e);
      }
    }

    try {
      const { data, error } = await supabase
        .from("conversation_members")
        .select("wallpaper")
        .eq("user_id", userId)
        .eq("conversation_id", chatId)
        .single();

      if (error) {
        console.warn("Failed fetching chat wallpaper from DB (could be missing column):", error.message);
        return localVal;
      }

      const dbVal = data?.wallpaper;
      if (dbVal && typeof window !== "undefined") {
        try {
          localStorage.setItem(`wa_wallpaper_user_${userId}_chat_${chatId}`, dbVal);
        } catch (e) {}
      }
      return dbVal || localVal;
    } catch (err) {
      return localVal;
    }
  },

  /**
   * Set custom wallpaper for a specific chat conversation.
   */
  async setChatWallpaper(userId, chatId, wallpaperValue) {
    if (!userId || !chatId) return false;

    // 1. Write to Local Storage
    if (typeof window !== "undefined") {
      try {
        if (wallpaperValue) {
          localStorage.setItem(`wa_wallpaper_user_${userId}_chat_${chatId}`, wallpaperValue);
        } else {
          localStorage.removeItem(`wa_wallpaper_user_${userId}_chat_${chatId}`);
        }
      } catch (e) {
        console.warn("localStorage write failed:", e);
      }
    }

    // 2. Write to Supabase DB conversation_members table
    try {
      const { error } = await supabase
        .from("conversation_members")
        .update({ wallpaper: wallpaperValue })
        .eq("user_id", userId)
        .eq("conversation_id", chatId);

      if (error) {
        console.warn("Failed updating chat wallpaper in DB (could be missing column):", error.message);
        return false;
      }
      return true;
    } catch (err) {
      return false;
    }
  },

  /**
   * Reset global wallpaper to default.
   */
  async resetGlobalWallpaper(userId) {
    return this.setGlobalWallpaper(userId, null);
  },

  /**
   * Reset chat-specific wallpaper.
   */
  async resetChatWallpaper(userId, chatId) {
    return this.setChatWallpaper(userId, chatId, null);
  }
};
