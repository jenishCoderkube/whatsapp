import { createSlice } from "@reduxjs/toolkit";

const initialChats = [
  {
    id: "chat-1",
    name: "Sarah Jenkins",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
    unreadCount: 2,
    lastMessage: {
      text: "The new UI looks absolutely amazing! 🔥",
      timestamp: "10:42 AM",
      isOutgoing: false,
      status: "read",
    },
    online: true,
    phoneNumber: "+1 (555) 019-2834",
  },
  {
    id: "chat-2",
    name: "Design Team 🎨",
    avatar:
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80",
    unreadCount: 0,
    lastMessage: {
      text: "You: Sent the updated Figma design components.",
      timestamp: "Yesterday",
      isOutgoing: true,
      status: "delivered",
    },
    online: false,
    phoneNumber: "Group Chat",
  },
  {
    id: "chat-3",
    name: "Marcus Chen",
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    unreadCount: 1,
    lastMessage: {
      text: "Can we review the deployment schedule later today?",
      timestamp: "Yesterday",
      isOutgoing: false,
      status: "read",
    },
    online: true,
    phoneNumber: "+1 (555) 382-9911",
  },
  {
    id: "chat-4",
    name: "Mom ❤️",
    avatar:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80",
    unreadCount: 0,
    lastMessage: {
      text: "Don't forget to eat well dear!",
      timestamp: "Monday",
      isOutgoing: false,
      status: "read",
    },
    online: false,
    phoneNumber: "+1 (555) 882-0021",
  },
  {
    id: "chat-5",
    name: "Support Bot 🤖",
    avatar:
      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80",
    unreadCount: 0,
    lastMessage: {
      text: "Welcome to WhatsApp Web clone built with Next.js App Router!",
      timestamp: "5/2/2026",
      isOutgoing: false,
      status: "read",
    },
    online: true,
    phoneNumber: "Automated System",
  },
  {
    id: "chat-6",
    name: "Elena Rostova",
    avatar:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    unreadCount: 3,
    lastMessage: {
      text: "Let me know if you need any frontend guidance.",
      timestamp: "Tuesday",
      isOutgoing: false,
      status: "read",
    },
    online: true,
    phoneNumber: "+1 (555) 234-5678",
  },
  {
    id: "chat-7",
    name: "David Kim",
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    unreadCount: 0,
    lastMessage: {
      text: "Are we still meeting for lunch?",
      timestamp: "Tuesday",
      isOutgoing: false,
      status: "read",
    },
    online: false,
    phoneNumber: "+1 (555) 876-5432",
  },
  {
    id: "chat-8",
    name: "DevOps Alerts ⚡",
    avatar:
      "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=150&auto=format&fit=crop&q=80",
    unreadCount: 1,
    lastMessage: {
      text: "Deployment pipeline successfully completed.",
      timestamp: "May 1",
      isOutgoing: false,
      status: "read",
    },
    online: true,
    phoneNumber: "System Hook",
  },
  {
    id: "chat-9",
    name: "Sophia Patel",
    avatar:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
    unreadCount: 0,
    lastMessage: {
      text: "Check out these new logo SVGs I generated.",
      timestamp: "April 28",
      isOutgoing: false,
      status: "read",
    },
    online: false,
    phoneNumber: "+1 (555) 432-1098",
  },
  {
    id: "chat-10",
    name: "James Wilson",
    avatar:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80",
    unreadCount: 0,
    lastMessage: {
      text: "Thanks for the feedback!",
      timestamp: "April 25",
      isOutgoing: false,
      status: "read",
    },
    online: false,
    phoneNumber: "+1 (555) 678-9012",
  },
];

const initialState = {
  chats: initialChats,
  activeChatId: "chat-1", // default active chat
  searchQuery: "",
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
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
        // Move chat to top of list
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
  },
});

export const { setActiveChat, setSearchQuery, updateLastMessage, clearUnread } =
  chatSlice.actions;

export default chatSlice.reducer;
