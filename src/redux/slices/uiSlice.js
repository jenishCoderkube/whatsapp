import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  mobileScreen: "list", // 'list' | 'chat'
  theme: "light", // 'light' | 'dark'
  profileOpen: false, // sidebar profile drawer
  attachmentMenuOpen: false,
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
      // Ensure dark class is applied to root html/body dynamically if needed
      if (typeof document !== "undefined") {
        if (state.theme === "dark") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
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
      }
    },
    setProfileOpen(state, action) {
      state.profileOpen = action.payload;
    },
    setAttachmentMenuOpen(state, action) {
      state.attachmentMenuOpen = action.payload;
    },
  },
});

export const {
  setMobileScreen,
  toggleTheme,
  setTheme,
  setProfileOpen,
  setAttachmentMenuOpen,
} = uiSlice.actions;

export default uiSlice.reducer;
