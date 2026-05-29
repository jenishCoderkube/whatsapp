import { supabase } from "../lib/supabaseClient";
import { messageService } from "./messageService";

let watchId = null;
let lastPosition = null;
let activeTimer = null;

// Haversine formula to compute distance in meters
function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const locationService = {
  /**
   * Request browser location permission and send a static current location snapshot message
   */
  async sendStaticCurrentLocation(conversationId, userId, preFetchedCoords = null) {
    if (!preFetchedCoords && !navigator.geolocation) {
      throw new Error("Geolocation is not supported by your browser");
    }

    const runWithCoords = async (coords) => {
      const { latitude, longitude } = coords;
      const sentMsg = await messageService.sendMessage({
        conversationId,
        senderId: userId,
        text: "Current Location",
        type: "location",
        mediaUrl: `${latitude},${longitude}`, // Static coordinates snapshot
        fileSize: 0,
      });
      return sentMsg;
    };

    if (preFetchedCoords) {
      return runWithCoords(preFetchedCoords);
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const sentMsg = await runWithCoords(position.coords);
            resolve(sentMsg);
          } catch (err) {
            reject(err);
          }
        },
        (permissionError) => {
          reject(permissionError);
        },
        { enableHighAccuracy: true }
      );
    });
  },

  /**
   * Request browser location permissions and start sharing live location
   */
  async startSharing(conversationId, userId, durationMs, preFetchedCoords = null) {
    if (!preFetchedCoords && !navigator.geolocation) {
      throw new Error("Geolocation is not supported by your browser");
    }

    const runWithCoords = async (coords) => {
      const { latitude, longitude } = coords;
      const expiresAt = new Date(Date.now() + durationMs).toISOString();

      // 1. Upsert coordinates into the live_locations database table
      const { error: upsertError } = await supabase
        .from("live_locations")
        .upsert(
          {
            conversation_id: conversationId,
            user_id: userId,
            latitude,
            longitude,
            expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "conversation_id,user_id" }
        );

      if (upsertError) throw upsertError;

      // 2. Post a live_location message in the chat
      const sentMsg = await messageService.sendMessage({
        conversationId,
        senderId: userId,
        text: "Shared live location",
        type: "live_location",
        mediaUrl: `${latitude},${longitude}`, // Initial coordinates
        fileName: expiresAt, // Expiration ISO string
        fileSize: 0,
        duration: Math.round(durationMs / 1000), // Duration in seconds
      });

      // 3. Set up battery/network optimized high-accuracy tracking watcher
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (activeTimer) {
        clearTimeout(activeTimer);
      }

      lastPosition = { latitude, longitude, timestamp: Date.now() };

      activeTimer = setTimeout(() => {
        this.stopSharing(conversationId, userId);
      }, durationMs);

      watchId = navigator.geolocation.watchPosition(
        async (pos) => {
          const { latitude: newLat, longitude: newLng } = pos.coords;
          const now = Date.now();

          // Battery and Network transmission optimization:
          // Skip DB update if user moved less than 10 meters AND less than 10 seconds passed
          if (lastPosition) {
            const distance = getDistanceFromLatLonInMeters(
              lastPosition.latitude,
              lastPosition.longitude,
              newLat,
              newLng
            );
            const elapsed = now - lastPosition.timestamp;

            if (distance < 10 && elapsed < 10000) {
              return; // Skip update to preserve battery
            }
          }

          lastPosition = { latitude: newLat, longitude: newLng, timestamp: now };

          await supabase.from("live_locations").upsert(
            {
              conversation_id: conversationId,
              user_id: userId,
              latitude: newLat,
              longitude: newLng,
              expires_at: expiresAt,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "conversation_id,user_id" }
          );
        },
        (watchError) => {
          console.warn("Location tracking watcher warning:", watchError);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 10000, // Cache positions up to 10s
        }
      );

      return sentMsg;
    };

    if (preFetchedCoords) {
      return runWithCoords(preFetchedCoords);
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const sentMsg = await runWithCoords(position.coords);
            resolve(sentMsg);
          } catch (err) {
            reject(err);
          }
        },
        (permissionError) => {
          reject(permissionError);
        },
        { enableHighAccuracy: true }
      );
    });
  },

  /**
   * Stop sharing live location and clear tracking watchers
   */
  async stopSharing(conversationId, userId) {
    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    if (activeTimer) {
      clearTimeout(activeTimer);
      activeTimer = null;
    }
    lastPosition = null;

    try {
      await supabase
        .from("live_locations")
        .delete()
        .eq("conversation_id", conversationId)
        .eq("user_id", userId);
    } catch (err) {
      console.warn("Error deleting live location share row:", err);
    }
  },

  /**
   * Check if client is currently actively sharing location
   */
  isCurrentlySharing() {
    return watchId !== null;
  },

  /**
   * Fetch all unexpired active location shares in a conversation
   */
  async getActiveLocations(conversationId) {
    try {
      const { data, error } = await supabase
        .from("live_locations")
        .select("*, profiles:user_id(name, avatar)")
        .eq("conversation_id", conversationId)
        .gt("expires_at", new Date().toISOString());

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("Failed to fetch active conversation locations:", err);
      return [];
    }
  },

  /**
   * Set up real-time subscription channel for location updates in a conversation
   */
  subscribeToLocationUpdates(conversationId, onUpdate) {
    const channel = supabase
      .channel(`live-loc-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_locations",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          // Fetch profile info for updates to have names and avatars populated
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const { data: profile } = await supabase
              .from("profiles")
              .select("name, avatar")
              .eq("id", payload.new.user_id)
              .single();

            onUpdate({
              type: payload.eventType,
              location: {
                ...payload.new,
                profiles: profile || { name: "Someone", avatar: null },
              },
            });
          } else if (payload.eventType === "DELETE") {
            onUpdate({
              type: payload.eventType,
              location: payload.old,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
