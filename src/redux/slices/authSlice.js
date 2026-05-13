import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  user: null,
  isAuthenticated: false,
  loading: false,
  error: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAuthState(state, action) {
      state.user = action.payload.user;
      state.isAuthenticated = !!action.payload.user;
      state.loading = false;
    },
    loginStart(state) {
      state.loading = true;
      state.error = null;
    },
    loginSuccess(state, action) {
      state.loading = false;
      state.isAuthenticated = true;
      if (action.payload?.user) {
        state.user = action.payload.user;
      } else {
        state.user = {
          id: action.payload?.id || "00000000-0000-0000-0000-000000000001",
          name: action.payload?.name || action.payload?.email?.split("@")[0] || "User",
          email: action.payload?.email || "demo@whatsapp.web",
          avatar: action.payload?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
          status: action.payload?.status || "Available",
        };
      }
    },
    loginFailure(state, action) {
      state.loading = false;
      state.error = action.payload;
    },
    registerSuccess(state, action) {
      state.loading = false;
      state.isAuthenticated = true;
      if (action.payload?.user) {
        state.user = action.payload.user;
      } else {
        state.user = {
          id: action.payload?.id || "00000000-0000-0000-0000-000000000001",
          name: action.payload?.name || "New User",
          email: action.payload?.email || "demo@whatsapp.web",
          avatar: action.payload?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
          status: "Available",
        };
      }
    },
    logout(state) {
      state.user = null;
      state.isAuthenticated = false;
      state.error = null;
    },
    updateProfile(state, action) {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
  },
});

export const {
  setAuthState,
  loginStart,
  loginSuccess,
  loginFailure,
  registerSuccess,
  logout,
  updateProfile,
} = authSlice.actions;

export default authSlice.reducer;
