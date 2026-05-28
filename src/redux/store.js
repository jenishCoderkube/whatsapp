import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import chatReducer from "./slices/chatSlice";
import messageReducer from "./slices/messageSlice";
import uiReducer from "./slices/uiSlice";
import callReducer from "./slices/callSlice";
import statusReducer from "./slices/statusSlice";
import lockReducer from "./slices/lockSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    chat: chatReducer,
    message: messageReducer,
    ui: uiReducer,
    call: callReducer,
    status: statusReducer,
    lock: lockReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});
