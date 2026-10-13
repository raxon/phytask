import { createSelector } from '@reduxjs/toolkit';
import type { WorkspaceState } from './types';

export const selectWorkspaceView = createSelector(
  (state: WorkspaceState) => state,
  (state) => {
    const pendingResult = state.pending[state.patientId];
    const currentResult = pendingResult ?? state.analysis?.result ?? state.confirmation;
    return {
      patientId: state.patientId,
      analysis: state.analysis,
      pendingResult,
      currentResult,
      isSaving: Boolean(state.saving[state.patientId]),
      isSaved: Boolean(currentResult && state.saved[state.patientId] === currentResult.sessionId),
      isImporting: Boolean(state.importId),
      importError: state.importError,
      saveError: state.errors[state.patientId],
    };
  },
);

export type WorkspaceView = ReturnType<typeof selectWorkspaceView>;
