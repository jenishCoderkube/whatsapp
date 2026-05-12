import { createSlice } from "@reduxjs/toolkit";

const initialMessages = {
  "chat-1": [
    {
      id: "msg-1",
      text: "Hey Sarah! Have you checked out the new layout updates?",
      timestamp: "10:30 AM",
      isOutgoing: true,
      status: "read",
      type: "text",
    },
    {
      id: "msg-2",
      text: "Yes, I just loaded the dev server.",
      timestamp: "10:32 AM",
      isOutgoing: false,
      status: "read",
      type: "text",
    },
    {
      id: "msg-3",
      text: "Here is the screenshot preview of the new WhatsApp green theme implementation:",
      timestamp: "10:35 AM",
      isOutgoing: true,
      status: "read",
      type: "image",
      mediaUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
    },
    {
      id: "msg-4",
      text: "Voice message placeholder",
      timestamp: "10:40 AM",
      isOutgoing: false,
      status: "read",
      type: "voice",
      duration: "0:45",
    },
    {
      id: "msg-5",
      text: "The new UI looks absolutely amazing! 🔥",
      timestamp: "10:42 AM",
      isOutgoing: false,
      status: "read",
      type: "text",
    },
  ],
  "chat-2": [
    {
      id: "msg-201",
      text: "Welcome team! Let's drop design component files here.",
      timestamp: "Yesterday",
      isOutgoing: false,
      status: "read",
      type: "text",
    },
    {
      id: "msg-202",
      text: "WhatsApp-Web-Design-Tokens.pdf",
      timestamp: "Yesterday",
      isOutgoing: true,
      status: "delivered",
      type: "file",
      fileName: "WhatsApp-Web-Design-Tokens.pdf",
      fileSize: "4.2 MB",
    },
    {
      id: "msg-203",
      text: "Sent the updated Figma design components.",
      timestamp: "Yesterday",
      isOutgoing: true,
      status: "delivered",
      type: "text",
    },
  ],
  "chat-3": [
    {
      id: "msg-301",
      text: "Hi Alex, hope you are doing well.",
      timestamp: "Yesterday",
      isOutgoing: false,
      status: "read",
      type: "text",
    },
    {
      id: "msg-302",
      text: "Can we review the deployment schedule later today?",
      timestamp: "Yesterday",
      isOutgoing: false,
      status: "read",
      type: "text",
    },
  ],
  "chat-4": [
    {
      id: "msg-401",
      text: "Hi sweetie, how is work going?",
      timestamp: "Monday",
      isOutgoing: false,
      status: "read",
      type: "text",
    },
    {
      id: "msg-402",
      text: "Don't forget to eat well dear!",
      timestamp: "Monday",
      isOutgoing: false,
      status: "read",
      type: "text",
    },
  ],
  "chat-5": [
    {
      id: "msg-501",
      text: "Welcome to WhatsApp Web clone built with Next.js App Router!",
      timestamp: "5/2/2026",
      isOutgoing: false,
      status: "read",
      type: "text",
    },
    {
      id: "msg-502",
      text: "Try sending a message, uploading a placeholder image, or switching chat layouts seamlessly.",
      timestamp: "5/2/2026",
      isOutgoing: false,
      status: "read",
      type: "text",
    },
  ],
  "chat-6": [
    {
      id: "msg-601",
      text: "Hi Alex, did you review the CSS custom properties module?",
      timestamp: "Tuesday",
      isOutgoing: false,
      status: "read",
      type: "text",
    },
    {
      id: "msg-602",
      text: "Yes, fully merged into globals.css cleanly.",
      timestamp: "Tuesday",
      isOutgoing: true,
      status: "read",
      type: "text",
    },
    {
      id: "msg-603",
      text: "Awesome. Let me know if you need any frontend guidance.",
      timestamp: "Tuesday",
      isOutgoing: false,
      status: "read",
      type: "text",
    },
  ],
  "chat-7": [
    {
      id: "msg-701",
      text: "Hey, are we still meeting for lunch?",
      timestamp: "Tuesday",
      isOutgoing: false,
      status: "read",
      type: "text",
    },
  ],
  "chat-8": [
    {
      id: "msg-801",
      text: "Triggering automatic deployment to production staging cluster.",
      timestamp: "May 1",
      isOutgoing: false,
      status: "read",
      type: "text",
    },
    {
      id: "msg-802",
      text: "Deployment pipeline successfully completed.",
      timestamp: "May 1",
      isOutgoing: false,
      status: "read",
      type: "text",
    },
  ],
  "chat-9": [
    {
      id: "msg-901",
      text: "Check out these new logo SVGs I generated.",
      timestamp: "April 28",
      isOutgoing: false,
      status: "read",
      type: "text",
    },
  ],
  "chat-10": [
    {
      id: "msg-1001",
      text: "Sent the accessibility review metrics.",
      timestamp: "April 25",
      isOutgoing: true,
      status: "read",
      type: "text",
    },
    {
      id: "msg-1002",
      text: "Thanks for the feedback!",
      timestamp: "April 25",
      isOutgoing: false,
      status: "read",
      type: "text",
    },
  ],
};

const initialState = {
  messages: initialMessages,
};

const messageSlice = createSlice({
  name: "message",
  initialState,
  reducers: {
    addMessage(state, action) {
      const { chatId, message } = action.payload;
      if (!state.messages[chatId]) {
        state.messages[chatId] = [];
      }
      state.messages[chatId].push(message);
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

export const { addMessage, updateMessageStatus } = messageSlice.actions;

export default messageSlice.reducer;
