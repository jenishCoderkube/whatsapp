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
      state.messages[chatId] = messages;
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
        const idx = list.findIndex((m) => m.id === tempId);
        if (idx !== -1) {
          list[idx] = confirmedMessage;
        } else {
          // If not found, append directly ensuring duplicate guard
          if (!list.some((m) => m.id === confirmedMessage.id)) {
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
      // Accurately prevent duplication while permitting identical payload arrays on batch transfers
      const exists = state.messages[chatId].some(
        (m) =>
          m.id === message.id ||
          (m.mediaUrl && message.mediaUrl && m.mediaUrl === message.mediaUrl) ||
          (m.text && message.text && m.text === message.text && m.timestamp === message.timestamp && !m.mediaUrl && !message.mediaUrl)
      );
      if (!exists) {
        state.messages[chatId].push(message);
      }
    },
    updateMessageStatus(state, action) {
      const { chatId, messageId, status } = action.payload;
      const list = state.messages[chatId];
      if (list) {
        const msg = list.find((m) => m.id === messageId);
        if (msg) {
          msg.status = status;
        }
      }
    },
  },
});

export const {
  setMessages,
  prependMessages,
  replaceOptimisticMessage,
  addMessage,
  updateMessageStatus,
} = messageSlice.actions;

export default messageSlice.reducer;
