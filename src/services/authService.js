import { supabase } from "../lib/supabaseClient";
import { storageService } from "./storageService";

export const authService = {
  /**
   * Triggers Google OAuth sign-in flow.
   */
  async signInWithGoogle() {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/chat`,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error("Google OAuth initialisation failed:", error);
      return { data: null, error: error.message || "Google Login failed." };
    }
  },

  /**
   * Triggers GitHub OAuth sign-in flow.
   */
  async signInWithGitHub() {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/chat`,
        },
      });
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error("GitHub OAuth initialisation failed:", error);
      return { data: null, error: error.message || "GitHub Login failed." };
    }
  },

  /**
   * Register a new user natively via Supabase Authentication and dynamically
   * instantiate their synchronized row inside the `profiles` table.
   */
  async register({ email, password, name, avatar, avatarFile }) {
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            avatar_url: avatar,
          },
        },
      });

      if (authError) throw authError;

      const user = authData.user;
      if (!user) {
        throw new Error(
          "Registration succeeded but user session metadata is not immediately present.",
        );
      }

      // Explicitly acquire true active session context to satisfy Postgres RLS check constraints
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

      // Securely upload avatar file only after authenticating successfully
      let finalAvatarUrl = avatar;
      if (avatarFile) {
        try {
          const uploadedUrl = await storageService.uploadFile(avatarFile, "avatars");
          if (uploadedUrl) {
            finalAvatarUrl = uploadedUrl;
          }
        } catch (uploadError) {
          console.warn("Avatar upload failed during registration:", uploadError);
        }
      }

      // Natively construct dynamic true profile schema
      const profilePayload = {
        id: user.id,
        name: name || email.split("@")[0],
        email: user.email,
        avatar:
          finalAvatarUrl ||
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
        status: "Available",
        online: true,
        last_seen: new Date().toISOString(),
      };

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(profilePayload);

      if (profileError) {
        console.warn("Real profile upsert pipeline exception:", profileError);
        throw new Error("Unable to create user profile metadata row due to database access parameters.");
      }

      return { user: profilePayload, error: null };
    } catch (error) {
      return { user: null, error: error.message || "Registration failed." };
    }
  },

  /**
   * Securely authenticate users passing actual target credentials, pulling complete dynamic schema info.
   */
  async login({ email, password }) {
    try {
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (authError) throw authError;

      const user = authData.user;

      // Extract persistent primary database item record
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        // Fallback hydration if profile wasn't ready
        const safeUser = {
          id: user.id,
          name: user.user_metadata?.full_name || email.split("@")[0],
          email: user.email,
          avatar:
            user.user_metadata?.avatar_url ||
            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
          status: "Available",
        };
        await supabase.from("profiles").upsert(safeUser);
        return { user: safeUser, error: null };
      }

      // Realtime online switch marker update
      await supabase
        .from("profiles")
        .update({ online: true, last_seen: new Date().toISOString() })
        .eq("id", user.id);

      return { user: profile, error: null };
    } catch (error) {
      return {
        user: null,
        error: error.message || "Invalid login credentials.",
      };
    }
  },

  /**
   * Terminate dynamic user session securely.
   */
  async logout() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user?.id) {
        const userId = session.user.id;

        // Clean up linked device from metadata before signing out
        try {
          const currentDeviceId = localStorage.getItem("wa_device_id");
          if (currentDeviceId && session.user) {
            const user = session.user;
            let linkedDevices = user.user_metadata?.linked_devices || [];
            linkedDevices = linkedDevices.filter(d => d.id !== currentDeviceId);

            // Wrap metadata updates and broadcasts in a Promise.race to avoid rate limit blocks
            await Promise.race([
              (async () => {
                try {
                  await supabase.auth.updateUser({
                    data: { linked_devices: linkedDevices }
                  });

                  // Broadcast updated list to other sessions
                  const channel = supabase.channel(`auth-session:${userId}`);
                  await new Promise((resolve) => {
                    channel.subscribe(async (status) => {
                      if (status === "SUBSCRIBED") {
                        await channel.send({
                          type: "broadcast",
                          event: "session-list-updated",
                          payload: { devices: linkedDevices }
                        });
                        setTimeout(resolve, 300);
                      } else {
                        resolve();
                      }
                    });
                  });
                } catch (updateErr) {
                  console.warn("Linked devices metadata update failed:", updateErr);
                }
              })(),
              new Promise((resolve) => setTimeout(resolve, 1500)) // 1.5 second timeout fallback
            ]);
          }
        } catch (metadataErr) {
          console.warn("Failed to remove device from linked_devices during logout:", metadataErr);
        }

        try {
          await supabase
            .from("profiles")
            .update({ online: false, last_seen: new Date().toISOString() })
            .eq("id", userId);
        } catch (dbErr) {
          console.warn("Failed to update profile online status:", dbErr);
        }
      }
    } catch (error) {
      console.error("Signout preparation error:", error);
    } finally {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.error("Supabase signOut error:", e);
      }
      await this.clearLocalSessionData();
    }
    return { success: true };
  },

  /**
   * Terminate all session mappings globally and invalidate tokens across all devices.
   */
  async logoutAllDevices() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user?.id) {
        const userId = session.user.id;

        // 1. Clear the metadata
        try {
          await supabase.auth.updateUser({
            data: { linked_devices: [] }
          });
        } catch (err) {
          console.warn("Failed to clear linked devices metadata:", err);
        }

        // 2. Update online status in database profiles
        try {
          await supabase
            .from("profiles")
            .update({ online: false, last_seen: new Date().toISOString() })
            .eq("id", userId);
        } catch (err) {
          console.warn("Failed to update profile status:", err);
        }

        // 3. Broadcast the realtime logout event with self: false and a 800ms socket flush delay
        try {
          const channel = supabase.channel(`auth-session:${userId}`, {
            config: { broadcast: { self: false } }
          });
          
          await new Promise((resolve) => {
            channel.subscribe(async (status) => {
              if (status === "SUBSCRIBED") {
                await channel.send({
                  type: "broadcast",
                  event: "logout-all",
                  payload: { userId },
                });
                // Wait 800ms to guarantee WebSocket packet is fully flushed before connection teardown
                setTimeout(resolve, 800);
              } else {
                resolve();
              }
            });
          });
        } catch (err) {
          console.warn("Failed to broadcast logout-all event:", err);
        }
      }
    } catch (error) {
      console.error("Global signout preparation error:", error);
    } finally {
      try {
        await supabase.auth.signOut({ scope: "global" });
      } catch (e) {
        console.error("Supabase signOut global error:", e);
      }
      await this.clearLocalSessionData();
    }
    return { success: true };
  },

  /**
   * Clear all local session cache, tokens, storage, cookies, and IndexedDB database.
   */
  async clearLocalSessionData() {
    if (typeof window === "undefined") return;

    // 1. Clear all cookies
    try {
      const cookies = document.cookie.split(";");
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + window.location.hostname;
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=." + window.location.hostname;
      }
    } catch (e) {
      console.warn("Failed to clear cookies:", e);
    }

    // 2. Clear IndexedDB
    try {
      const { indexedDBService } = await import("./indexedDBService");
      await indexedDBService.clearAllData();
    } catch (e) {
      console.warn("Failed to clear IndexedDB data:", e);
    }

    // 3. Clear sessionStorage
    try {
      sessionStorage.clear();
    } catch (e) {
      console.warn("Failed to clear sessionStorage:", e);
    }

    // 4. Clear localStorage (preserving non-sensitive preferences)
    try {
      const theme = localStorage.getItem("wa_theme");
      const lang = localStorage.getItem("language_preference");
      const deviceId = localStorage.getItem("wa_device_id");
      localStorage.clear();
      if (theme) localStorage.setItem("wa_theme", theme);
      if (lang) localStorage.setItem("language_preference", lang);
      if (deviceId) localStorage.setItem("wa_device_id", deviceId);
    } catch (e) {
      console.warn("Failed to clear localStorage:", e);
    }
  },

  /**
   * Refresh current actual auth session mapping cache dynamically.
   */
  async getCurrentUser() {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session?.user) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (profile) return profile;

      return {
        id: session.user.id,
        name:
          session.user.user_metadata?.full_name ||
          session.user.email?.split("@")[0] ||
          "User",
        email: session.user.email,
        avatar:
          session.user.user_metadata?.avatar_url ||
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
        status: "Available",
      };
    } catch (e) {
      return null;
    }
  },

  /**
   * Listen to pure native WebSocket subscription auth events.
   */
  onAuthStateChange(callback) {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      callback(event, session);
    });
    return subscription;
  },
};
