import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  messages: {},
};

const messageSlice = createSlice({
  name: "message",
  initialState,
  reducers: {
    setMessages(state, action) {
      const { chatId, messages } = action.payload;
      const seen = new Set();
      const unique = [];
      for (const m of messages) {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          unique.push(m);
        }
      }
      state.messages[chatId] = unique;
    },
    prependMessages(state, action) {
      const { chatId, messages } = action.payload;
      if (!state.messages[chatId]) {
        state.messages[chatId] = [];
      }
      // Filter out elements already present to prevent duplicate React keys
      const existingIds = new Set(state.messages[chatId].map((m) => m.id));
      const newUnique = messages.filter((m) => !existingIds.has(m.id));
      state.messages[chatId] = [...newUnique, ...state.messages[chatId]];
    },
    replaceOptimisticMessage(state, action) {
      const { chatId, tempId, confirmedMessage } = action.payload;
      const list = state.messages[chatId];
      if (list) {
        const existingConfirmedIdx = list.findIndex((m) => m.id === confirmedMessage.id);
        if (existingConfirmedIdx !== -1) {
          // If the confirmed ID is already present via real-time subscription broadcast, cleanly drop the speculative duplicate row
          state.messages[chatId] = list.filter((m) => m.id !== tempId);
        } else {
          const idx = list.findIndex((m) => m.id === tempId);
          if (idx !== -1) {
            list[idx] = confirmedMessage;
          } else {
            list.push(confirmedMessage);
          }
        }
      }
    },
    addMessage(state, action) {
      const { chatId, message } = action.payload;
      if (!state.messages[chatId]) {
        state.messages[chatId] = [];
      }
      const list = state.messages[chatId];
      // Prevent duplicate row insertion if key identity matches exactly
      if (list.some((m) => m.id === message.id)) {
        return;
      }
      // Accurately prevent duplication while permitting identical payload arrays on batch transfers
      const exists = list.some(
        (m) =>
          (m.mediaUrl && message.mediaUrl && m.mediaUrl === message.mediaUrl) ||
          (m.text && message.text && m.text === message.text && m.timestamp === message.timestamp && !m.mediaUrl && !message.mediaUrl && m.type === message.type)
      );
      if (!exists) {
        list.push(message);
      }
    },
    updateMessageStatus(state, action) {
      const { chatId, messageId, status } = action.payload;
      const list = state.messages[chatId];
      if (list) {
        const msg = list.find((m) => m.id === messageId);
        if (msg) {
          const statusWeight = { pending: 0, failed: 0, sent: 1, delivered: 2, read: 3 };
          const oldWeight = statusWeight[msg.status] || 0;
          const newWeight = statusWeight[status] || 0;
          if (newWeight >= oldWeight) {
            msg.status = status;
          }
        }
      }
    },
    updateMessage(state, action) {
      const { chatId, message } = action.payload;
      const list = state.messages[chatId];
      if (list) {
        const idx = list.findIndex((m) => m.id === message.id);
        if (idx !== -1) {
          const oldStatus = list[idx].status;
          const newStatus = message.status;
          const statusWeight = { pending: 0, failed: 0, sent: 1, delivered: 2, read: 3 };
          
          let finalStatus = newStatus;
          if (oldStatus && newStatus) {
            const oldWeight = statusWeight[oldStatus] || 0;
            const newWeight = statusWeight[newStatus] || 0;
            if (oldWeight > newWeight) {
              finalStatus = oldStatus;
            }
          }
          
          list[idx] = { ...list[idx], ...message, status: finalStatus || oldStatus };
        }
      }
    },
    resetMessages(state) {
      state.messages = {};
    },
  },
});

export const {
  setMessages,
  prependMessages,
  replaceOptimisticMessage,
  addMessage,
  updateMessageStatus,
  updateMessage,
  resetMessages,
} = messageSlice.actions;

export default messageSlice.reducer;
