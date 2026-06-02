import { createSlice } from "@reduxjs/toolkit";

const getDeletedForMeIds = () => {
  if (typeof window !== "undefined") {
    try {
      return JSON.parse(localStorage.getItem("wa_deleted_for_me") || "[]");
    } catch (e) {
      return [];
    }
  }
  return [];
};

const initialState = {
  messages: {},
};

const messageSlice = createSlice({
  name: "message",
  initialState,
  reducers: {
    setMessages(state, action) {
      const { chatId, messages } = action.payload;
      const deletedIds = getDeletedForMeIds();
      const seen = new Set();
      const unique = [];
      for (const m of messages) {
        if (!seen.has(m.id) && !deletedIds.includes(m.id)) {
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
      const deletedIds = getDeletedForMeIds();
      const filtered = messages.filter((m) => !deletedIds.includes(m.id));
      // Filter out elements already present to prevent duplicate React keys
      const existingIds = new Set(state.messages[chatId].map((m) => m.id));
      const newUnique = filtered.filter((m) => !existingIds.has(m.id));
      state.messages[chatId] = [...newUnique, ...state.messages[chatId]];
    },
    appendMessages(state, action) {
      const { chatId, messages } = action.payload;
      if (!state.messages[chatId]) {
        state.messages[chatId] = [];
      }
      const deletedIds = getDeletedForMeIds();
      const filtered = messages.filter((m) => !deletedIds.includes(m.id));
      const existingIds = new Set(state.messages[chatId].map((m) => m.id));
      const newUnique = filtered.filter((m) => !existingIds.has(m.id));
      state.messages[chatId] = [...state.messages[chatId], ...newUnique];
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
            const prevMsg = list[idx];
            list[idx] = { ...confirmedMessage, uiId: prevMsg.uiId || tempId };
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
      const deletedIds = getDeletedForMeIds();
      if (deletedIds.includes(message.id)) {
        return;
      }
      const list = state.messages[chatId];
      
      // Prevent duplicate row insertion if key identity matches exactly
      if (list.some((m) => m.id === message.id)) {
        return;
      }

      // If this is a real database message, try to find and resolve its optimistic counterpart
      if (message.id && !message.id.startsWith("msg-temp-")) {
        const optIdx = list.findIndex(
          (m) =>
            m.id &&
            (message.clientId ? m.id === message.clientId :
             (m.id.startsWith("msg-temp-") &&
              m.type === message.type &&
              (message.fileName ? m.fileName === message.fileName : m.text === message.text)))
        );

        if (optIdx !== -1) {
          const prevMsg = list[optIdx];
          const statusWeight = { pending: 0, failed: 0, sent: 1, delivered: 2, read: 3 };
          const oldWeight = statusWeight[prevMsg.status] || 0;
          const newWeight = statusWeight[message.status] || 0;
          const finalStatus = newWeight >= oldWeight ? message.status : prevMsg.status;

          list[optIdx] = {
            ...prevMsg,
            ...message,
            id: message.id,
            uiId: prevMsg.uiId || prevMsg.id,
            status: finalStatus,
          };
          return;
        }
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
        let idx = list.findIndex((m) => m.id === message.id);
        if (idx === -1 && message.id && !message.id.startsWith("msg-temp-")) {
          idx = list.findIndex(
            (m) =>
              m.id &&
              m.id.startsWith("msg-temp-") &&
              m.type === message.type &&
              (message.fileName ? m.fileName === message.fileName : m.text === message.text)
          );
        }

        if (idx !== -1) {
          const prevMsg = list[idx];
          const oldStatus = prevMsg.status;
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
          
          list[idx] = {
            ...prevMsg,
            ...message,
            id: message.id,
            uiId: prevMsg.uiId || prevMsg.id,
            status: finalStatus || oldStatus,
          };
        }
      }
    },
    toggleMessageReaction(state, action) {
      const { chatId, messageId, userId, emoji } = action.payload;
      const list = state.messages[chatId];
      if (list) {
        const msg = list.find((m) => m.id === messageId);
        if (msg) {
          if (!msg.reactions) {
            msg.reactions = {};
          }
          const reactions = JSON.parse(JSON.stringify(msg.reactions));
          const hasReacted = Array.isArray(reactions[emoji]) && reactions[emoji].includes(userId);
          
          // Remove from all existing emojis to enforce mutual exclusivity
          Object.keys(reactions).forEach((key) => {
            if (Array.isArray(reactions[key])) {
              reactions[key] = reactions[key].filter((uid) => uid !== userId);
              if (reactions[key].length === 0) {
                delete reactions[key];
              }
            }
          });

          // Add if not already reacted
          if (!hasReacted) {
            if (!reactions[emoji]) {
              reactions[emoji] = [];
            }
            reactions[emoji].push(userId);
          }

          msg.reactions = reactions;
        }
      }
    },
    deleteMessage(state, action) {
      const { chatId, messageId } = action.payload;
      const list = state.messages[chatId];
      if (list) {
        state.messages[chatId] = list.filter((m) => m.id !== messageId);
      }
    },
    updateSenderProfile(state, action) {
      const { senderId, name, avatar } = action.payload;
      Object.keys(state.messages).forEach((chatId) => {
        state.messages[chatId].forEach((msg) => {
          if (msg.senderId === senderId) {
            if (name && msg.senderName !== name) msg.senderName = name;
            if (avatar && msg.senderAvatar !== avatar) msg.senderAvatar = avatar;
          }
        });
      });
    },
    resetMessages(state) {
      state.messages = {};
    },
  },
});

export const {
  setMessages,
  prependMessages,
  appendMessages,
  replaceOptimisticMessage,
  addMessage,
  updateMessageStatus,
  updateMessage,
  toggleMessageReaction,
  deleteMessage,
  updateSenderProfile,
  resetMessages,
} = messageSlice.actions;

export default messageSlice.reducer;
