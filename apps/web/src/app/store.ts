import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { workspaceReducer } from '../features/workspace/model/workspace-slice';
import type { WorkspaceState } from '../features/workspace/model/types';
import { sessionsApi } from '../features/sessions/api/sessions-api';

const rootReducer = combineReducers({
  workspace: workspaceReducer,
  [sessionsApi.reducerPath]: sessionsApi.reducer,
});

export function createAppStore(initialWorkspace: WorkspaceState) {
  return configureStore({
    reducer: rootReducer,
    preloadedState: { workspace: initialWorkspace },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(sessionsApi.middleware),
  });
}

export type AppStore = ReturnType<typeof createAppStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
