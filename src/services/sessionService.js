import { supabase } from "../lib/supabaseClient";

// Helper to get or generate a unique device ID
export function getOrCreateDeviceId() {
  if (typeof window === "undefined") return "server-side";
  let deviceId = localStorage.getItem("wa_device_id");
  if (!deviceId) {
    deviceId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem("wa_device_id", deviceId);
  }
  return deviceId;
}

// Helper to parse User Agent and get device name/details
export function getDeviceInfo() {
  if (typeof window === "undefined") {
    return {
      name: "Server Session",
      platform: "Server",
      browser: "Server",
      isBrowser: true,
    };
  }
  const ua = navigator.userAgent;
  let browser = "Browser";
  let os = "OS";

  // Browser detection
  if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("SamsungBrowser")) browser = "Samsung Browser";
  else if (ua.includes("Opera") || ua.includes("OPR")) browser = "Opera";
  else if (ua.includes("Trident")) browser = "Internet Explorer";
  else if (ua.includes("Edge") || ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Safari")) browser = "Safari";

  // OS detection
  if (ua.includes("Windows NT 10.0")) os = "Windows 10/11";
  else if (ua.includes("Windows NT 6.3")) os = "Windows 8.1";
  else if (ua.includes("Windows NT 6.2")) os = "Windows 8";
  else if (ua.includes("Windows NT 6.1")) os = "Windows 7";
  else if (ua.includes("Macintosh") || ua.includes("Mac OS X")) os = "macOS";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("Linux")) os = "Linux";

  return {
    name: `${browser} (${os})`,
    platform: os,
    browser: browser,
    isBrowser: !/Mobi|Android|iPhone|iPad/i.test(ua),
  };
}

let sessionChannel = null;

export const sessionService = {
  // Get all active sessions stored in Supabase Auth user_metadata
  async getActiveSessions() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (error || !user) return [];
    return user.user_metadata?.linked_devices || [];
  },

  // Initialize/register the current device in the linked_devices metadata
  async registerCurrentDevice(
    userId,
    onLoggedOutCallback,
    onListUpdatedCallback,
  ) {
    if (!userId) return { currentDeviceId: null, activeDevices: [] };

    const currentDeviceId = getOrCreateDeviceId();
    const info = getDeviceInfo();
    const nowStr = new Date().toISOString();

    // 1. Fetch latest user metadata from Supabase
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (error || !user) {
      return { currentDeviceId, activeDevices: [] };
    }

    let linkedDevices = user.user_metadata?.linked_devices || [];

    // Ensure all devices have valid schemas
    linkedDevices = linkedDevices.filter((d) => d && d.id);

    const existingDeviceIndex = linkedDevices.findIndex(
      (d) => d.id === currentDeviceId,
    );

    let needsUpdate = false;
    let updateFailed = false;

    if (existingDeviceIndex > -1) {
      const dev = linkedDevices[existingDeviceIndex];
      const lastActiveTime = dev.lastActive ? new Date(dev.lastActive) : new Date(0);
      const diffMs = new Date() - lastActiveTime;
      
      // Update only if metadata changed, or last active is older than 5 minutes
      if (
        dev.name !== info.name ||
        dev.platform !== info.platform ||
        dev.browser !== info.browser ||
        dev.isBrowser !== info.isBrowser ||
        diffMs > 5 * 60 * 1000
      ) {
        linkedDevices[existingDeviceIndex] = {
          ...dev,
          name: info.name,
          platform: info.platform,
          browser: info.browser,
          isBrowser: info.isBrowser,
          lastActive: nowStr,
        };
        needsUpdate = true;
      }
    } else {
      // Add new device
      linkedDevices.push({
        id: currentDeviceId,
        name: info.name,
        platform: info.platform,
        browser: info.browser,
        isBrowser: info.isBrowser,
        loginTime: nowStr,
        lastActive: nowStr,
      });
      needsUpdate = true;
    }

    // 2. Save back to Supabase only if needed
    if (needsUpdate) {
      const { error: updateError } = await supabase.auth.updateUser({
        data: { linked_devices: linkedDevices },
      });

      if (updateError) {
        console.error(
          "Error registering current device in metadata:",
          updateError,
        );
        updateFailed = true;
      }
    }

    // 3. Subscribe to the Realtime broadcast channel for session updates
    if (sessionChannel) {
      supabase.removeChannel(sessionChannel);
    }

    sessionChannel = supabase.channel(`auth-session:${userId}`, {
      config: { broadcast: { self: true } },
    });

    sessionChannel
      .on("broadcast", { event: "logout-device" }, (payload) => {
        if (payload.payload?.deviceId === currentDeviceId) {
          if (onLoggedOutCallback) onLoggedOutCallback();
        }
      })
      .on("broadcast", { event: "logout-all-except" }, (payload) => {
        if (payload.payload?.currentDeviceId !== currentDeviceId) {
          if (onLoggedOutCallback) onLoggedOutCallback();
        }
      })
      .on("broadcast", { event: "logout-all" }, (payload) => {
        if (onLoggedOutCallback) onLoggedOutCallback();
      })
      .on("broadcast", { event: "session-list-updated" }, (payload) => {
        // Check if our own device was removed from the list in this update
        const updatedList = payload.payload?.devices || [];
        const stillExists = updatedList.some((d) => d.id === currentDeviceId);
        if (!stillExists) {
          if (onLoggedOutCallback) onLoggedOutCallback();
        } else if (onListUpdatedCallback) {
          onListUpdatedCallback(updatedList);
        }
      })
      .subscribe();

    // 4. Double check if our device is in the active list (in case we were deleted while offline)
    const isStillActive = linkedDevices.some((d) => d.id === currentDeviceId);
    // If updating metadata failed (e.g. rate limit), do NOT force logout. Let the user stay in.
    if (!isStillActive && !updateFailed) {
      if (onLoggedOutCallback) onLoggedOutCallback();
      return { currentDeviceId, activeDevices: [], loggedOut: true };
    }

    // 5. Broadcast that the list was updated
    await sessionChannel.send({
      type: "broadcast",
      event: "session-list-updated",
      payload: { devices: linkedDevices },
    });

    return { currentDeviceId, activeDevices: linkedDevices };
  },

  // Update activity timestamp in database
  async updateLastActive(userId, currentDeviceId) {
    if (!userId || !currentDeviceId) return;

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (error || !user) return;

    let linkedDevices = user.user_metadata?.linked_devices || [];
    const index = linkedDevices.findIndex((d) => d.id === currentDeviceId);
    if (index > -1) {
      const dev = linkedDevices[index];
      const lastActiveTime = dev.lastActive ? new Date(dev.lastActive) : new Date(0);
      const diffMs = new Date() - lastActiveTime;

      // Only hit the Supabase updateUser API if last active was updated more than 5 minutes ago
      if (diffMs < 5 * 60 * 1000) {
        return;
      }

      linkedDevices[index].lastActive = new Date().toISOString();
      await supabase.auth.updateUser({
        data: { linked_devices: linkedDevices },
      });

      if (sessionChannel) {
        await sessionChannel.send({
          type: "broadcast",
          event: "session-list-updated",
          payload: { devices: linkedDevices },
        });
      }
    }
  },

  // Logout a single device
  async logoutDevice(userId, targetDeviceId) {
    if (!userId || !targetDeviceId) return;

    // 1. Fetch latest metadata
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (error || !user) return;

    let linkedDevices = user.user_metadata?.linked_devices || [];
    linkedDevices = linkedDevices.filter((d) => d.id !== targetDeviceId);

    // 2. Update user metadata
    await supabase.auth.updateUser({
      data: { linked_devices: linkedDevices },
    });

    // 3. Broadcast logout command to the target device
    if (sessionChannel) {
      await sessionChannel.send({
        type: "broadcast",
        event: "logout-device",
        payload: { deviceId: targetDeviceId },
      });
      // Also broadcast the updated list to other devices
      await sessionChannel.send({
        type: "broadcast",
        event: "session-list-updated",
        payload: { devices: linkedDevices },
      });
    }
  },

  // Logout all other devices except current device
  async logoutAllOtherDevices(userId, currentDeviceId) {
    if (!userId || !currentDeviceId) return;

    // 1. Fetch latest metadata
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (error || !user) return;

    let linkedDevices = user.user_metadata?.linked_devices || [];
    const currentDevice = linkedDevices.find((d) => d.id === currentDeviceId);
    const updatedDevices = currentDevice ? [currentDevice] : [];

    // 2. Update user metadata
    await supabase.auth.updateUser({
      data: { linked_devices: updatedDevices },
    });

    // 3. Broadcast logout command to all except current
    if (sessionChannel) {
      await sessionChannel.send({
        type: "broadcast",
        event: "logout-all-except",
        payload: { currentDeviceId },
      });
      // Also broadcast the updated list
      await sessionChannel.send({
        type: "broadcast",
        event: "session-list-updated",
        payload: { devices: updatedDevices },
      });
    }
  },

  // Logout all devices including current device
  async logoutAllDevices(userId) {
    if (!userId) return;

    // 1. Clear user metadata in auth.users
    await supabase.auth.updateUser({
      data: { linked_devices: [] },
    });

    // 2. Broadcast logout command to all devices
    if (sessionChannel) {
      await sessionChannel.send({
        type: "broadcast",
        event: "logout-all",
        payload: { userId },
      });
    }
  },

  // Unsubscribe channel
  unsubscribe() {
    if (sessionChannel) {
      supabase.removeChannel(sessionChannel);
      sessionChannel = null;
    }
  },
};
