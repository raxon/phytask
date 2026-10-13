import { parseFixture } from '@rep-counter/contracts/fixture';
import { errorMessage } from '../../../shared/lib/api-error';
import { actions } from '../model/workspace-slice';
import type { ExampleSession } from '../model/examples';
import type { FixtureFile, WorkspaceDependencies } from './ports';

/** UI commands depend on ports, so storage and transport can be replaced independently. */
export function createWorkspaceCommands(dependencies: WorkspaceDependencies) {
  const { state, pendingResults, sessions, analyze, generateOperationId } = dependencies;

  return {
    chooseExample(example: ExampleSession): void {
      const { patientId, pending } = state.get();
      if (pending[patientId]) return;
      const importId = generateOperationId();
      state.dispatch(actions.beginImport({ patientId, importId }));
      state.dispatch(
        actions.imported({
          importId,
          analysis: analyze(patientId, example.fileName, example.fixture),
        }),
      );
    },

    async importFile(file: FixtureFile): Promise<void> {
      const { patientId, pending } = state.get();
      if (pending[patientId]) return;
      const importId = generateOperationId();
      state.dispatch(actions.beginImport({ patientId, importId }));
      try {
        const fixture = parseFixture(JSON.parse(await file.text()));
        state.dispatch(
          actions.imported({ importId, analysis: analyze(patientId, file.name, fixture) }),
        );
      } catch (error) {
        const message =
          error instanceof SyntaxError
            ? 'This file contains invalid JSON. Choose a session fixture.'
            : error instanceof Error
              ? error.message
              : 'This file could not be read.';
        state.dispatch(actions.importFailed({ patientId, importId, message }));
      }
    },

    async saveResult(): Promise<void> {
      const snapshot = state.get();
      const patientId = snapshot.patientId;
      const result = snapshot.pending[patientId] ?? snapshot.analysis?.result;
      if (!result || snapshot.saving[patientId] || snapshot.saved[patientId] === result.sessionId)
        return;
      // Reserve the result before waiting for a shared storage lock or another click.
      state.dispatch(actions.saveStarted({ patientId, result }));
      try {
        // Persist before sending: a lost response must never create a new session ID.
        if (!(await pendingResults.save(patientId, result))) {
          state.dispatch(
            actions.saveFailed({
              patientId,
              sessionId: result.sessionId,
              message: 'Another tab has a pending result for this patient. Reload to retry it.',
            }),
          );
          return;
        }
      } catch {
        state.dispatch(
          actions.saveFailed({
            patientId,
            sessionId: result.sessionId,
            message: 'This browser could not keep a retry copy. Allow local storage before saving.',
          }),
        );
        return;
      }
      try {
        await sessions.save(patientId, result);
        state.dispatch(actions.saveSucceeded({ patientId, sessionId: result.sessionId }));
        try {
          await pendingResults.remove(patientId, result.sessionId);
        } catch {
          /* A stale retry copy is safe because the API is idempotent. */
        }
      } catch (error) {
        state.dispatch(
          actions.saveFailed({
            patientId,
            sessionId: result.sessionId,
            message: errorMessage(error),
          }),
        );
      }
    },
  };
}
