import { createSlice } from "@reduxjs/toolkit";

const getInitialMutedUsers = () => {
  if (typeof window !== "undefined") {
    try {
      return JSON.parse(localStorage.getItem("wa_muted_status_users") || "[]");
    } catch (e) {
      return [];
    }
  }
  return [];
};

const initialState = {
  statuses: [], // List of status groups [{ userId, name, avatar, statuses: [...], hasUnseen: boolean }]
  myStatuses: [], // List of status items uploaded by current user
  activeUserId: null, // ID of user currently being viewed in the status viewer
  activeStatusIndex: 0, // Current index of the viewed user's status updates
  statusViewOpen: false, // Whether the status panel is open
  loading: false,
  uploading: false,
  uploadProgress: null,
  privacy: "contacts", // 'everyone' | 'contacts' | 'selected' | 'hide'
  privacyList: [], // List of UUIDs for selective privacy
  mutedUsers: getInitialMutedUsers(), // Array of user IDs whose statuses are muted
};

const statusSlice = createSlice({
  name: "status",
  initialState,
  reducers: {
    setStatusViewOpen(state, action) {
      state.statusViewOpen = action.payload;
      if (!action.payload) {
        state.activeUserId = null;
        state.activeStatusIndex = 0;
      }
    },
    setStatuses(state, action) {
      state.statuses = action.payload;
    },
    setMyStatuses(state, action) {
      state.myStatuses = action.payload;
    },
    addStatusLocal(state, action) {
      // Add status item locally (optimistic update)
      state.myStatuses.unshift(action.payload);
    },
    removeStatusLocal(state, action) {
      state.myStatuses = state.myStatuses.filter((s) => s.id !== action.payload);
    },
    setActiveUser(state, action) {
      state.activeUserId = action.payload;
      state.activeStatusIndex = 0;
    },
    setActiveStatusIndex(state, action) {
      state.activeStatusIndex = action.payload;
    },
    setUploading(state, action) {
      state.uploading = action.payload;
    },
    setUploadProgress(state, action) {
      state.uploadProgress = action.payload;
    },
    setPrivacySettings(state, action) {
      state.privacy = action.payload.privacy;
      state.privacyList = action.payload.privacyList || [];
    },
    setLoading(state, action) {
      state.loading = action.payload;
    },
    muteUser(state, action) {
      const userId = action.payload;
      if (!state.mutedUsers.includes(userId)) {
        state.mutedUsers.push(userId);
        if (typeof window !== "undefined") {
          localStorage.setItem("wa_muted_status_users", JSON.stringify(state.mutedUsers));
        }
      }
    },
    unmuteUser(state, action) {
      const userId = action.payload;
      state.mutedUsers = state.mutedUsers.filter((id) => id !== userId);
      if (typeof window !== "undefined") {
        localStorage.setItem("wa_muted_status_users", JSON.stringify(state.mutedUsers));
      }
    },
    markStatusAsSeenLocal(state, action) {
      const { statusId, currentUserId } = action.payload;
      
      // Update myStatuses if it matches
      state.myStatuses = state.myStatuses.map((s) => {
        if (s.id === statusId) {
          const views = s.views || [];
          if (!views.some((v) => v.viewerId === currentUserId)) {
            return {
              ...s,
              views: [...views, { viewerId: currentUserId, createdAt: new Date().toISOString() }],
            };
          }
        }
        return s;
      });

      // Update statuses list
      state.statuses = state.statuses.map((group) => {
        let updatedStatuses = group.statuses.map((s) => {
          if (s.id === statusId) {
            const views = s.views || [];
            if (!views.some((v) => v.viewerId === currentUserId)) {
              return {
                ...s,
                views: [...views, { viewerId: currentUserId, createdAt: new Date().toISOString() }],
                isSeen: true,
              };
            }
            return { ...s, isSeen: true };
          }
          return s;
        });

        // Re-evaluate hasUnseen
        const hasUnseen = updatedStatuses.some((s) => !s.isSeen);

        return {
          ...group,
          statuses: updatedStatuses,
          hasUnseen,
        };
      });
    },
    updateStatusReactionLocal(state, action) {
      const { statusId, viewerId, reaction } = action.payload;
      
      // Helper function to update status views
      const updateViews = (views) => {
        return (views || []).map((v) => {
          if (v.viewerId === viewerId) {
            return { ...v, reaction };
          }
          return v;
        });
      };

      state.myStatuses = state.myStatuses.map((s) => {
        if (s.id === statusId) {
          return { ...s, views: updateViews(s.views) };
        }
        return s;
      });

      state.statuses = state.statuses.map((group) => {
        return {
          ...group,
          statuses: group.statuses.map((s) => {
            if (s.id === statusId) {
              return { ...s, views: updateViews(s.views) };
            }
            return s;
          }),
        };
      });
    },
  },
});

export const {
  setStatusViewOpen,
  setStatuses,
  setMyStatuses,
  addStatusLocal,
  removeStatusLocal,
  setActiveUser,
  setActiveStatusIndex,
  setUploading,
  setUploadProgress,
  setPrivacySettings,
  setLoading,
  muteUser,
  unmuteUser,
  markStatusAsSeenLocal,
  updateStatusReactionLocal,
} = statusSlice.actions;

export default statusSlice.reducer;
