import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { PatientId } from '@rep-counter/demo-data/patients';
import type { SessionResult } from '@rep-counter/contracts/session';
import type { Analysis, PendingResults, WorkspaceState } from './types';

export function createWorkspaceState(
  patientId: PatientId,
  pending: PendingResults = {},
  analysis: Analysis | null = null,
): WorkspaceState {
  return {
    patientId,
    analysis,
    pending,
    saving: {},
    errors: {},
    saved: {},
    confirmation: null,
    importId: null,
    importError: null,
  };
}

const workspaceSlice = createSlice({
  name: 'workspace',
  initialState: createWorkspaceState('alex'),
  reducers: {
    selectPatient(state, action: PayloadAction<PatientId>) {
      state.patientId = action.payload;
      state.analysis = null;
      state.confirmation = null;
      state.importId = null;
      state.importError = null;
    },
    beginImport(state, action: PayloadAction<{ patientId: PatientId; importId: string }>) {
      if (state.patientId !== action.payload.patientId || state.pending[action.payload.patientId])
        return;
      state.importId = action.payload.importId;
      state.importError = null;
    },
    imported(state, action: PayloadAction<{ importId: string; analysis: Analysis }>) {
      if (
        state.patientId !== action.payload.analysis.patientId ||
        state.importId !== action.payload.importId ||
        state.pending[state.patientId]
      )
        return;
      state.analysis = action.payload.analysis;
      state.confirmation = null;
      state.importId = null;
      state.importError = null;
      delete state.errors[state.patientId];
    },
    importFailed(
      state,
      action: PayloadAction<{ patientId: PatientId; importId: string; message: string }>,
    ) {
      if (
        state.patientId !== action.payload.patientId ||
        state.importId !== action.payload.importId
      )
        return;
      state.importId = null;
      state.importError = action.payload.message;
    },
    saveStarted(state, action: PayloadAction<{ patientId: PatientId; result: SessionResult }>) {
      const { patientId, result } = action.payload;
      state.pending[patientId] = result;
      state.saving[patientId] = result.sessionId;
      delete state.errors[patientId];
    },
    saveSucceeded(state, action: PayloadAction<{ patientId: PatientId; sessionId: string }>) {
      const { patientId, sessionId } = action.payload;
      // A response owns its original patient and session, even after navigation.
      if (state.pending[patientId]?.sessionId !== sessionId) return;
      if (state.patientId === patientId) state.confirmation = state.pending[patientId]!;
      delete state.pending[patientId];
      delete state.saving[patientId];
      delete state.errors[patientId];
      state.saved[patientId] = sessionId;
    },
    saveFailed(
      state,
      action: PayloadAction<{ patientId: PatientId; sessionId: string; message: string }>,
    ) {
      const { patientId, sessionId, message } = action.payload;
      if (state.saving[patientId] && state.saving[patientId] !== sessionId) return;
      delete state.saving[patientId];
      state.errors[patientId] = message;
    },
  },
});

export const actions = workspaceSlice.actions;
export const workspaceReducer = workspaceSlice.reducer;
export type WorkspaceAction = ReturnType<(typeof actions)[keyof typeof actions]>;
