import { configureStore } from '@reduxjs/toolkit';
import matchesReducer from './slices/matchesSlice';
import teamsReducer from './slices/teamsSlice';
import authReducer from './slices/authSlice';

export const store = configureStore({
  reducer: {
    matches: matchesReducer,
    teams: teamsReducer,
    auth: authReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;