import { createSlice, current } from "@reduxjs/toolkit";

const getSavedState = () => {
  if (typeof window === "undefined") return {};
  try {
    const data = localStorage.getItem("wa_lock_settings");
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error("Failed to read lock settings:", e);
  }
  return {};
};

const saveStateToStorage = (state, syncToSupabase = true) => {
  if (typeof window === "undefined") return;
  try {
    const currentState = current(state);
    const dataToSave = {
      isAppLockEnabled: currentState.isAppLockEnabled,
      lockType: currentState.lockType,
      savedPin: currentState.savedPin,
      savedPattern: currentState.savedPattern,
      autoLockTimeout: currentState.autoLockTimeout,
      lockedChatIds: currentState.lockedChatIds,
      lastUnlockedTime: currentState.lastUnlockedTime,
    };
    localStorage.setItem("wa_lock_settings", JSON.stringify(dataToSave));

    if (syncToSupabase) {
      // Exclude runtime local activity metadata from Supabase user_metadata
      const { lastUnlockedTime, ...databaseSettings } = dataToSave;
      import("../../services/lockSyncService")
        .then(({ lockSyncService }) => {
          lockSyncService.saveLockSettings(databaseSettings);
        })
        .catch((err) => {
          console.warn("Supabase lock sync background import error:", err);
        });
    }
  } catch (e) {
    console.error("Failed to save lock settings:", e);
  }
};

const savedState = getSavedState();

const initialState = {
  isAppLockEnabled: savedState.isAppLockEnabled || false,
  lockType: savedState.lockType || "pin", // 'pin' | 'pattern'
  savedPin: savedState.savedPin || null,
  savedPattern: savedState.savedPattern || null,
  autoLockTimeout: savedState.autoLockTimeout !== undefined ? savedState.autoLockTimeout : 0, // minutes (0 = Immediately)
  lockedChatIds: savedState.lockedChatIds || [],
  
  // Runtime states (not persisted across restarts unless session is active)
  isAppLocked: false, // Will be computed on launch
  lastUnlockedTime: savedState.lastUnlockedTime || null,
  authorizedChatIds: [], // Temp unlocked chat IDs in current session
  isLockedChatsFolderUnlocked: false,
};

const lockSlice = createSlice({
  name: "lock",
  initialState,
  reducers: {
    initializeLock(state) {
      if (!state.isAppLockEnabled) {
        state.isAppLocked = false;
        return;
      }
      
      const now = Date.now();
      const lastUnlocked = state.lastUnlockedTime;
      const timeoutMs = state.autoLockTimeout * 60 * 1000;

      if (state.autoLockTimeout === 0) {
        // "Immediately" / on every fresh load
        state.isAppLocked = true;
      } else if (lastUnlocked && now - lastUnlocked < timeoutMs) {
        // Session still active
        state.isAppLocked = false;
      } else {
        // Session expired or no last unlock time
        state.isAppLocked = true;
      }
    },
    setAppLockEnabled(state, action) {
      state.isAppLockEnabled = action.payload;
      if (!action.payload) {
        state.isAppLocked = false;
      }
      saveStateToStorage(state);
    },
    setLockConfiguration(state, action) {
      const { type, pin, pattern, timeout } = action.payload;
      if (type !== undefined) state.lockType = type;
      if (pin !== undefined) state.savedPin = pin;
      if (pattern !== undefined) state.savedPattern = pattern;
      if (timeout !== undefined) state.autoLockTimeout = timeout;
      saveStateToStorage(state);
    },
    lockApp(state) {
      if (state.isAppLockEnabled) {
        state.isAppLocked = true;
        state.lastUnlockedTime = null;
        state.authorizedChatIds = [];
        state.isLockedChatsFolderUnlocked = false;
        saveStateToStorage(state, false);
      }
    },
    unlockApp(state) {
      state.isAppLocked = false;
      state.lastUnlockedTime = Date.now();
      saveStateToStorage(state, false);
    },
    lockChat(state, action) {
      const chatId = action.payload;
      if (!state.lockedChatIds.includes(chatId)) {
        state.lockedChatIds.push(chatId);
      }
      saveStateToStorage(state);
    },
    unlockChat(state, action) {
      const chatId = action.payload;
      state.lockedChatIds = state.lockedChatIds.filter(id => id !== chatId);
      state.authorizedChatIds = state.authorizedChatIds.filter(id => id !== chatId);
      saveStateToStorage(state);
    },
    authorizeChat(state, action) {
      const chatId = action.payload;
      if (!state.authorizedChatIds.includes(chatId)) {
        state.authorizedChatIds.push(chatId);
      }
    },
    setLockedChatsFolderUnlocked(state, action) {
      state.isLockedChatsFolderUnlocked = action.payload;
    },
    updateLastUnlockedTime(state) {
      if (state.isAppLockEnabled && !state.isAppLocked) {
        state.lastUnlockedTime = Date.now();
        saveStateToStorage(state, false);
      }
    },
    setLockSettingsFromSupabase(state, action) {
      const settings = action.payload;
      if (settings) {
        if (settings.isAppLockEnabled !== undefined) state.isAppLockEnabled = settings.isAppLockEnabled;
        if (settings.lockType !== undefined) state.lockType = settings.lockType;
        if (settings.savedPin !== undefined) state.savedPin = settings.savedPin;
        if (settings.savedPattern !== undefined) state.savedPattern = settings.savedPattern;
        if (settings.autoLockTimeout !== undefined) state.autoLockTimeout = settings.autoLockTimeout;
        if (settings.lockedChatIds !== undefined) state.lockedChatIds = settings.lockedChatIds;
        
        try {
          localStorage.setItem("wa_lock_settings", JSON.stringify(settings));
        } catch (e) {}
      }
    },
    clearLockSettings(state) {
      state.isAppLockEnabled = false;
      state.lockType = "pin";
      state.savedPin = null;
      state.savedPattern = null;
      state.autoLockTimeout = 0;
      state.lockedChatIds = [];
      state.isAppLocked = false;
      state.lastUnlockedTime = null;
      state.authorizedChatIds = [];
      state.isLockedChatsFolderUnlocked = false;
      try {
        localStorage.removeItem("wa_lock_settings");
      } catch (e) {}
    }
  }
});

export const {
  initializeLock,
  setAppLockEnabled,
  setLockConfiguration,
  lockApp,
  unlockApp,
  lockChat,
  unlockChat,
  authorizeChat,
  setLockedChatsFolderUnlocked,
  updateLastUnlockedTime,
  setLockSettingsFromSupabase,
  clearLockSettings,
} = lockSlice.actions;

export default lockSlice.reducer;
