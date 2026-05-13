import { createSlice } from "@reduxjs/toolkit";

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
        state.chats = action.payload;
        // Verify activeChatId stays bound cleanly without auto-selecting an initial chat
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
      // Filter out duplication
      const filtered = state.chats.filter((c) => c.id !== newChat.id);
      state.chats = [newChat, ...filtered];
      state.activeChatId = newChat.id;
    },
    setActiveChat(state, action) {
      state.activeChatId = action.payload;
      // Clear unread count when opening chat
      const chat = state.chats.find((c) => c.id === action.payload);
      if (chat) {
        chat.unreadCount = 0;
      }
    },
    setSearchQuery(state, action) {
      state.searchQuery = action.payload;
    },
    updateLastMessage(state, action) {
      const { chatId, text, timestamp, isOutgoing, status } = action.payload;
      const chat = state.chats.find((c) => c.id === chatId);
      if (chat) {
        chat.lastMessage = { text, timestamp, isOutgoing, status };
        // Move chat to top of list efficiently avoiding whole-array re-allocation keys
        const filtered = state.chats.filter((c) => c.id !== chatId);
        state.chats = [chat, ...filtered];
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
        }
      }
    },
    setUserTyping(state, action) {
      const { chatId, userId, isTyping } = action.payload;
      if (!state.typingMap[chatId]) {
        state.typingMap[chatId] = {};
      }
      if (isTyping) {
        state.typingMap[chatId][userId] = true;
      } else {
        delete state.typingMap[chatId][userId];
      }
    },
    syncOnlineUsers(state, action) {
      // Complete dict mapping of currently present users online: { [userId]: true }
      state.onlineMap = action.payload || {};
      // Update individual matching chat records dynamically
      state.chats.forEach((chat) => {
        if (!chat.isGroup && chat.peerId) {
          chat.online = !!state.onlineMap[chat.peerId];
        }
      });
    },
  },
});

export const {
  setChats,
  appendChat,
  setActiveChat,
  setSearchQuery,
  updateLastMessage,
  clearUnread,
  incrementUnread,
  setUserTyping,
  syncOnlineUsers,
} = chatSlice.actions;

export default chatSlice.reducer;
