import { createSlice } from "@reduxjs/toolkit";

const initialUser = {
  id: "user-1",
  name: "Alex Rivera",
  email: "alex@whatsapp.web",
  avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  status: "Available",
};

const initialState = {
  user: initialUser,
  isAuthenticated: true,
  loading: false,
  error: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    loginStart(state) {
      state.loading = true;
      state.error = null;
    },
    loginSuccess(state, action) {
      state.loading = false;
      state.isAuthenticated = true;
      state.user = {
        id: "user-" + Date.now(),
        name: action.payload.email.split("@")[0],
        email: action.payload.email,
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
        status: "Available",
      };
    },
    loginFailure(state, action) {
      state.loading = false;
      state.error = action.payload;
    },
    registerSuccess(state, action) {
      state.loading = false;
      state.isAuthenticated = true;
      state.user = {
        id: "user-" + Date.now(),
        name: action.payload.name || "New User",
        email: action.payload.email,
        avatar: action.payload.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
        status: "Available",
      };
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
  loginStart,
  loginSuccess,
  loginFailure,
  registerSuccess,
  logout,
  updateProfile,
} = authSlice.actions;

export default authSlice.reducer;
