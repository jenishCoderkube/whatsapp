import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  mobileScreen: "list", // 'list' | 'chat'
  theme: "light", // 'light' | 'dark'
  profileOpen: false, // sidebar profile drawer
  attachmentMenuOpen: false,
  replyingMessage: null, // message object to reply to
  editingMessage: null, // message object to edit
  activeSearchPanelOpen: false, // in-chat search panel
  archivedViewOpen: false, // archived chats sidebar list
  linkedDevicesOpen: false, // linked devices modal state
  globalWallpaper: null, // global default wallpaper
  chatWallpapers: {}, // per-chat wallpaper config map { [chatId]: wallpaperValue }
  wallpaperModalOpen: false, // wallpaper settings panel visibility
  wallpaperTargetChatId: null, // target chat UUID for wallpapers, null for global/default setting
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setMobileScreen(state, action) {
      state.mobileScreen = action.payload;
    },
    toggleTheme(state) {
      state.theme = state.theme === "light" ? "dark" : "light";
      if (typeof document !== "undefined") {
        if (state.theme === "dark") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
        try {
          localStorage.setItem("wa_theme", state.theme);
        } catch (e) {}
      }
    },
    setTheme(state, action) {
      state.theme = action.payload;
      if (typeof document !== "undefined") {
        if (action.payload === "dark") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
        try {
          localStorage.setItem("wa_theme", action.payload);
        } catch (e) {}
      }
    },
    setProfileOpen(state, action) {
      state.profileOpen = action.payload;
    },
    setAttachmentMenuOpen(state, action) {
      state.attachmentMenuOpen = action.payload;
    },
    setReplyingMessage(state, action) {
      state.replyingMessage = action.payload;
      if (action.payload) {
        state.editingMessage = null; // Mutual exclusion
      }
    },
    setEditingMessage(state, action) {
      state.editingMessage = action.payload;
      if (action.payload) {
        state.replyingMessage = null; // Mutual exclusion
      }
    },
    setActiveSearchPanelOpen(state, action) {
      state.activeSearchPanelOpen = action.payload;
    },
    setArchivedViewOpen(state, action) {
      state.archivedViewOpen = action.payload;
    },
    setLinkedDevicesOpen(state, action) {
      state.linkedDevicesOpen = action.payload;
    },
    setGlobalWallpaperState(state, action) {
      state.globalWallpaper = action.payload;
    },
    setChatWallpaperState(state, action) {
      const { chatId, value } = action.payload;
      state.chatWallpapers[chatId] = value;
    },
    setWallpaperModal(state, action) {
      const { open, targetChatId } = action.payload;
      state.wallpaperModalOpen = open;
      state.wallpaperTargetChatId = targetChatId || null;
    },
  },
});

export const {
  setMobileScreen,
  toggleTheme,
  setTheme,
  setProfileOpen,
  setAttachmentMenuOpen,
  setReplyingMessage,
  setEditingMessage,
  setActiveSearchPanelOpen,
  setArchivedViewOpen,
  setLinkedDevicesOpen,
  setGlobalWallpaperState,
  setChatWallpaperState,
  setWallpaperModal,
} = uiSlice.actions;

export default uiSlice.reducer;

