import { configureStore, combineReducers } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import chatReducer from "./slices/chatSlice";
import messageReducer from "./slices/messageSlice";
import uiReducer from "./slices/uiSlice";
import callReducer from "./slices/callSlice";
import statusReducer from "./slices/statusSlice";
import lockReducer from "./slices/lockSlice";

const appReducer = combineReducers({
  auth: authReducer,
  chat: chatReducer,
  message: messageReducer,
  ui: uiReducer,
  call: callReducer,
  status: statusReducer,
  lock: lockReducer,
});

const rootReducer = (state, action) => {
  if (action.type === "auth/logout" || action.type === "RESET_STORE") {
    state = undefined;
  }
  return appReducer(state, action);
};

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});
