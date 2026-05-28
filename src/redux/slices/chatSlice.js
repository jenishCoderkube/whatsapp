import { createSlice } from "@reduxjs/toolkit";

const sortChatsHelper = (chats) => {
  return [...chats].sort((a, b) => {
    // 1. Both pinned: sort by pinnedAt or updatedAt
    if (a.isPinned && b.isPinned) {
      return new Date(b.pinnedAt || b.updatedAt || 0) - new Date(a.pinnedAt || a.updatedAt || 0);
    }
    // 2. Only A pinned: goes first
    if (a.isPinned) return -1;
    // 3. Only B pinned: goes first
    if (b.isPinned) return 1;
    // 4. Neither pinned: sort by updatedAt
    return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
  });
};

const initialState = {
  chats: [],
  activeChatId: null,
  searchQuery: "",
  typingMap: {}, // { [chatId]: { [userId]: boolean } }
  onlineMap: {}, // { [userId]: boolean }
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setChats(state, action) {
      if (action.payload) {
        state.chats = sortChatsHelper(action.payload).map(chat => {
          if (!chat.isGroup && chat.peerId) {
            chat.online = !!state.onlineMap[chat.peerId];
          }
          return chat;
        });
        if (
          state.activeChatId &&
          !state.chats.some((c) => c.id === state.activeChatId)
        ) {
          state.activeChatId = null;
        }
      }
    },
    appendChat(state, action) {
      const newChat = action.payload;
      if (!newChat.isGroup && newChat.peerId) {
        newChat.online = !!state.onlineMap[newChat.peerId];
      }
      const filtered = state.chats.filter((c) => c.id !== newChat.id);
      state.chats = sortChatsHelper([newChat, ...filtered]);
      state.activeChatId = newChat.id;
    },
    setActiveChat(state, action) {
      state.activeChatId = action.payload;
      const chat = state.chats.find((c) => c.id === action.payload);
      if (chat) {
        chat.unreadCount = 0;
      }
    },
    setSearchQuery(state, action) {
      state.searchQuery = action.payload;
    },
    updateLastMessage(state, action) {
      const { chatId, text, timestamp, isOutgoing, status, avatar, name } = action.payload;
      const chat = state.chats.find((c) => c.id === chatId);
      if (chat) {
        let finalStatus = status;
        const oldMessage = chat.lastMessage;
        
        const isSameMessage = oldMessage && 
                             oldMessage.text === text && 
                             oldMessage.timestamp === timestamp;

        if (isSameMessage && oldMessage.status && status) {
          const statusWeight = { pending: 0, failed: 0, sent: 1, delivered: 2, read: 3 };
          const oldWeight = statusWeight[oldMessage.status] || 0;
          const newWeight = statusWeight[status] || 0;
          if (oldWeight > newWeight) {
            finalStatus = oldMessage.status;
          }
        }

        chat.lastMessage = { text, timestamp, isOutgoing, status: finalStatus };
        chat.updatedAt = new Date().toISOString();

        if (!chat.isGroup) {
          if (avatar && chat.avatar !== avatar) {
            chat.avatar = avatar;
          }
          if (name && chat.name !== name) {
            chat.name = name;
          }
        }

        const filtered = state.chats.filter((c) => c.id !== chatId);
        state.chats = sortChatsHelper([chat, ...filtered]);
      }
    },
    togglePinChat(state, action) {
      const chatId = action.payload;
      const chat = state.chats.find((c) => c.id === chatId);
      if (chat) {
        chat.isPinned = !chat.isPinned;
        chat.pinnedAt = chat.isPinned ? new Date().toISOString() : null;
        state.chats = sortChatsHelper(state.chats);
        
        // Sync custom localStorage fallbacks to remain 100% resilient across sessions
        if (typeof window !== "undefined") {
          try {
            const currentPinned = JSON.parse(localStorage.getItem("wa_pinned_chats") || "[]");
            if (chat.isPinned) {
              if (!currentPinned.includes(chatId)) currentPinned.push(chatId);
            } else {
              const idx = currentPinned.indexOf(chatId);
              if (idx > -1) currentPinned.splice(idx, 1);
            }
            localStorage.setItem("wa_pinned_chats", JSON.stringify(currentPinned));
          } catch (e) {}
        }
      }
    },
    toggleArchiveChat(state, action) {
      const chatId = action.payload;
      const chat = state.chats.find((c) => c.id === chatId);
      if (chat) {
        chat.isArchived = !chat.isArchived;
        chat.archivedAt = chat.isArchived ? new Date().toISOString() : null;
        
        // Automatically unpin if archived (WhatsApp logic)
        if (chat.isArchived && chat.isPinned) {
          chat.isPinned = false;
          chat.pinnedAt = null;
        }

        state.chats = sortChatsHelper(state.chats);

        if (chat.isArchived && state.activeChatId === chatId) {
          state.activeChatId = null;
        }

        // Sync custom localStorage fallbacks to remain 100% resilient across sessions
        if (typeof window !== "undefined") {
          try {
            const currentArchived = JSON.parse(localStorage.getItem("wa_archived_chats") || "[]");
            if (chat.isArchived) {
              if (!currentArchived.includes(chatId)) currentArchived.push(chatId);
            } else {
              const idx = currentArchived.indexOf(chatId);
              if (idx > -1) currentArchived.splice(idx, 1);
            }
            localStorage.setItem("wa_archived_chats", JSON.stringify(currentArchived));
          } catch (e) {}
        }
      }
    },
    clearUnread(state, action) {
      const chat = state.chats.find((c) => c.id === action.payload);
      if (chat) {
        chat.unreadCount = 0;
      }
    },
    incrementUnread(state, action) {
      const chatId = action.payload;
      if (state.activeChatId !== chatId) {
        const chat = state.chats.find((c) => c.id === chatId);
        if (chat) {
          chat.unreadCount = (chat.unreadCount || 0) + 1;
          
          // Auto un-archive if archived and gets a new message (WhatsApp Web native style!)
          if (chat.isArchived) {
            chat.isArchived = false;
            chat.archivedAt = null;
            state.chats = sortChatsHelper(state.chats);
            if (typeof window !== "undefined") {
              try {
                const currentArchived = JSON.parse(localStorage.getItem("wa_archived_chats") || "[]");
                const idx = currentArchived.indexOf(chatId);
                if (idx > -1) {
                  currentArchived.splice(idx, 1);
                  localStorage.setItem("wa_archived_chats", JSON.stringify(currentArchived));
                }
              } catch (e) {}
            }
          }
        }
      }
    },
    removeChat(state, action) {
      const chatId = action.payload;
      state.chats = state.chats.filter((c) => c.id !== chatId);
      if (state.activeChatId === chatId) {
        state.activeChatId = null;
      }
    },
    updateChatMembership(state, action) {
      const { chatId, isLeft } = action.payload;
      const chat = state.chats.find((c) => c.id === chatId);
      if (chat) {
        chat.isLeft = isLeft;
      }
    },
    updateChatAvatar(state, action) {
      const { chatId, avatar } = action.payload;
      const chat = state.chats.find((c) => c.id === chatId);
      if (chat) {
        chat.avatar = avatar;
      }
    },
    updateChatDisappearingDuration(state, action) {
      const { chatId, disappearingDuration } = action.payload;
      const chat = state.chats.find((c) => c.id === chatId);
      if (chat) {
        chat.disappearingDuration = disappearingDuration;
      }
    },
    updateChatWallpaper(state, action) {
      const { chatId, wallpaper } = action.payload;
      const chat = state.chats.find((c) => c.id === chatId);
      if (chat) {
        chat.wallpaper = wallpaper;
      }
    },
    setUserTyping(state, action) {
      const { chatId, userId, isTyping, userName } = action.payload;
      if (!state.typingMap[chatId]) {
        state.typingMap[chatId] = {};
      }
      if (isTyping) {
        state.typingMap[chatId][userId] = userName || true;
      } else {
        delete state.typingMap[chatId][userId];
      }
    },
    syncOnlineUsers(state, action) {
      const onlineMap = action.payload || {};
      state.onlineMap = onlineMap;
      state.chats.forEach((chat) => {
        if (!chat.isGroup && chat.peerId) {
          const isOnlineNow = !!onlineMap[chat.peerId];
          // Realtime transition from online -> offline correctly records the exact leave moment locally
          if (chat.online && !isOnlineNow) {
            chat.lastSeen = new Date().toISOString();
          }
          chat.online = isOnlineNow;
        }
      });
    },
    updatePeerProfile(state, action) {
      const { peerId, name, avatar, online, lastSeen } = action.payload;
      state.chats.forEach((chat) => {
        if (!chat.isGroup && chat.peerId === peerId) {
          if (name && chat.name !== name) chat.name = name;
          if (avatar && chat.avatar !== avatar) chat.avatar = avatar;
          if (online !== undefined && chat.online !== online) chat.online = online;
          if (lastSeen !== undefined && chat.lastSeen !== lastSeen) chat.lastSeen = lastSeen;
        }
      });
    },
    resetChats(state) {
      state.chats = [];
      state.activeChatId = null;
      state.searchQuery = "";
    },
  },
});

export const {
  setChats,
  appendChat,
  setActiveChat,
  setSearchQuery,
  updateLastMessage,
  togglePinChat,
  toggleArchiveChat,
  clearUnread,
  incrementUnread,
  removeChat,
  updateChatMembership,
  updateChatAvatar,
  updateChatDisappearingDuration,
  updateChatWallpaper,
  setUserTyping,
  syncOnlineUsers,
  updatePeerProfile,
  resetChats,
} = chatSlice.actions;

export default chatSlice.reducer;

