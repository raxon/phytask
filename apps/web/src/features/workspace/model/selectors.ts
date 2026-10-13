import { createSelector } from '@reduxjs/toolkit';
import type { WorkspaceState } from './types';

export const selectWorkspaceView = createSelector(
  (state: WorkspaceState) => state,
  (state) => {
    const pendingResult = state.pending[state.patientId];
    const currentResult = pendingResult ?? state.analysis?.result ?? state.confirmation;
    const isRunning = state.streamStatus === 'running';
    const isInterrupted = state.streamStatus === 'interrupted';
    const isActive = isRunning || isInterrupted;
    const sampleCount = state.analysis?.fixture.angles.length ?? 0;
    const totalSamples = state.source?.fixture.angles.length ?? 0;
    return {
      patientId: state.patientId,
      analysis: state.analysis,
      source: state.source,
      playbackSpeed: state.playbackSpeed,
      streamStatus: state.streamStatus,
      streamError: state.streamError,
      isRunning,
      isInterrupted,
      isActive,
      isCompleted: state.streamStatus === 'completed',
      canStart: Boolean(
        state.source &&
        !isActive &&
        !pendingResult &&
        !state.saving[state.patientId] &&
        !state.importId,
      ),
      sampleCount,
      totalSamples,
      currentAngle: state.analysis?.fixture.angles.at(-1) ?? null,
      progress: totalSamples ? Math.min(100, (sampleCount / totalSamples) * 100) : 0,
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
