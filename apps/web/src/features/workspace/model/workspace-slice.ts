import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { PatientId } from '@rep-counter/demo-data/patients';
import type { SessionResult } from '@rep-counter/contracts/session';
import type { PlaybackSpeed, SignalSample } from '@rep-counter/contracts/signal';
import { advanceRepCounter } from '@rep-counter/domain/repetitions';
import type { Analysis, PendingResults, SimulationSource, WorkspaceState } from './types';

interface SessionOwner {
  patientId: PatientId;
  sessionId: string;
}

const isActive = (state: WorkspaceState) =>
  state.streamStatus === 'running' || state.streamStatus === 'interrupted';
const ownsSession = (state: WorkspaceState, owner: SessionOwner) =>
  state.patientId === owner.patientId && state.analysis?.result.sessionId === owner.sessionId;

export function createWorkspaceState(
  patientId: PatientId,
  pending: PendingResults = {},
  source: SimulationSource | null = null,
): WorkspaceState {
  return {
    patientId,
    source,
    analysis: null,
    playbackSpeed: 1,
    streamStatus: 'idle',
    streamError: null,
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
      if (isActive(state)) return;
      state.patientId = action.payload;
      state.source = null;
      state.analysis = null;
      state.streamStatus = 'idle';
      state.streamError = null;
      state.confirmation = null;
      state.importId = null;
      state.importError = null;
    },
    setPlaybackSpeed(state, action: PayloadAction<PlaybackSpeed>) {
      if (!isActive(state) && [1, 4, 8].includes(action.payload))
        state.playbackSpeed = action.payload;
    },
    beginImport(state, action: PayloadAction<{ patientId: PatientId; importId: string }>) {
      if (
        isActive(state) ||
        state.patientId !== action.payload.patientId ||
        state.pending[state.patientId]
      )
        return;
      state.importId = action.payload.importId;
      state.importError = null;
    },
    imported(
      state,
      action: PayloadAction<{ patientId: PatientId; importId: string; source: SimulationSource }>,
    ) {
      if (
        isActive(state) ||
        state.patientId !== action.payload.patientId ||
        state.importId !== action.payload.importId ||
        state.pending[state.patientId]
      )
        return;
      state.source = action.payload.source;
      state.analysis = null;
      state.streamStatus = 'idle';
      state.streamError = null;
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
    sessionStarted(state, action: PayloadAction<Analysis>) {
      if (
        isActive(state) ||
        state.pending[state.patientId] ||
        state.importId ||
        action.payload.patientId !== state.patientId
      )
        return;
      state.analysis = action.payload;
      state.streamStatus = 'running';
      state.streamError = null;
      state.confirmation = null;
      delete state.errors[state.patientId];
    },
    sampleReceived(state, action: PayloadAction<SessionOwner & SignalSample>) {
      if (state.streamStatus !== 'running' || !ownsSession(state, action.payload)) return;
      const analysis = state.analysis!;
      if (
        action.payload.index !== analysis.fixture.angles.length ||
        !Number.isFinite(action.payload.angle)
      )
        return;
      // Only received samples advance the counter; future fixture values never affect live results.
      analysis.counter = advanceRepCounter(analysis.counter, action.payload.angle);
      analysis.fixture.angles.push(action.payload.angle);
      analysis.result.reps = analysis.counter.reps;
      analysis.result.durationSec = analysis.fixture.angles.length / analysis.fixture.sampleRateHz;
    },
    streamInterrupted(state, action: PayloadAction<SessionOwner & { message: string }>) {
      if (state.streamStatus !== 'running' || !ownsSession(state, action.payload)) return;
      state.streamStatus = 'interrupted';
      state.streamError = action.payload.message;
    },
    sessionResumed(state, action: PayloadAction<SessionOwner>) {
      if (state.streamStatus !== 'interrupted' || !ownsSession(state, action.payload)) return;
      state.streamStatus = 'running';
      state.streamError = null;
    },
    sessionFinished(state, action: PayloadAction<SessionOwner>) {
      if (!isActive(state) || !ownsSession(state, action.payload)) return;
      state.streamStatus = 'completed';
      state.streamError = null;
    },
    saveStarted(state, action: PayloadAction<{ patientId: PatientId; result: SessionResult }>) {
      const { patientId, result } = action.payload;
      state.pending[patientId] = result;
      state.saving[patientId] = result.sessionId;
      delete state.errors[patientId];
    },
    saveSucceeded(state, action: PayloadAction<SessionOwner>) {
      const { patientId, sessionId } = action.payload;
      // A response owns its original patient and session, even after navigation.
      if (state.pending[patientId]?.sessionId !== sessionId) return;
      if (state.patientId === patientId) state.confirmation = state.pending[patientId]!;
      delete state.pending[patientId];
      delete state.saving[patientId];
      delete state.errors[patientId];
      state.saved[patientId] = sessionId;
    },
    saveFailed(state, action: PayloadAction<SessionOwner & { message: string }>) {
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
