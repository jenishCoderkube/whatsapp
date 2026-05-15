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
        const sorted = [...action.payload].sort(
          (a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
        );
        state.chats = sorted;
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
        let finalStatus = status;
        const oldMessage = chat.lastMessage;
        
        // Only apply status weight priority if we are updating the SAME message.
        // If the text or timestamp changed, it's a new message and should reset to 'sent' or 'delivered'.
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
      const onlineMap = action.payload;
      state.chats.forEach((chat) => {
        if (!chat.isGroup) {
          const peerId = chat.peerId;
          chat.online = !!onlineMap[peerId];
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
  clearUnread,
  incrementUnread,
  removeChat,
  updateChatMembership,
  updateChatAvatar,
  setUserTyping,
  syncOnlineUsers,
  resetChats,
} = chatSlice.actions;

export default chatSlice.reducer;
