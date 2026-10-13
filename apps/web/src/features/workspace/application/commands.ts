import { parseFixture } from '@rep-counter/contracts/fixture';
import type { PlaybackSpeed } from '@rep-counter/contracts/signal';
import { errorMessage } from '../../../shared/lib/api-error';
import { actions } from '../model/workspace-slice';
import type { Analysis } from '../model/types';
import type { ExampleSession } from '../model/examples';
import type { FixtureFile, WorkspaceDependencies } from './ports';

/** UI commands depend on ports, so signal sources, storage and transport can be replaced. */
export function createWorkspaceCommands(dependencies: WorkspaceDependencies) {
  const { state, pendingResults, sessions, signals, analyze, generateOperationId } = dependencies;
  let connection: { sessionId: string; stop(): void } | null = null;
  const isActive = () => ['running', 'interrupted'].includes(state.get().streamStatus);

  function disconnect() {
    const previous = connection;
    connection = null;
    previous?.stop();
  }

  async function saveResult(): Promise<void> {
    const snapshot = state.get();
    const patientId = snapshot.patientId;
    const result =
      snapshot.pending[patientId] ??
      (snapshot.streamStatus === 'completed' ? snapshot.analysis?.result : null);
    if (!result || snapshot.saving[patientId] || snapshot.saved[patientId] === result.sessionId)
      return;
    state.dispatch(actions.saveStarted({ patientId, result }));
    try {
      // Persist a frozen result before POST; live samples and tokens are never stored.
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
  }

  async function finishSession(): Promise<void> {
    const snapshot = state.get();
    if (!snapshot.analysis || !isActive()) return;
    disconnect();
    const owner = { patientId: snapshot.patientId, sessionId: snapshot.analysis.result.sessionId };
    // Completion freezes the prefix before either manual or automatic saving can begin.
    state.dispatch(actions.sessionFinished(owner));
    await saveResult();
  }

  function connect(analysis: Analysis) {
    const snapshot = state.get();
    const source = snapshot.source;
    if (!source) return;
    const owner = { patientId: analysis.patientId, sessionId: analysis.result.sessionId };
    const current = { sessionId: owner.sessionId, stop: () => {} };
    connection = current;
    const interrupt = (message: string) => {
      if (connection !== current) return;
      disconnect();
      state.dispatch(actions.streamInterrupted({ ...owner, message }));
    };
    try {
      current.stop = signals.subscribe({
        patientId: owner.patientId,
        source,
        speed: snapshot.playbackSpeed,
        fromIndex: analysis.fixture.angles.length,
        onSample(sample) {
          if (connection !== current) return;
          const received = state.get().analysis?.fixture.angles.length;
          if (
            !Number.isFinite(sample.angle) ||
            sample.index !== received ||
            sample.index >= source.fixture.angles.length
          ) {
            interrupt('The signal sequence was interrupted. Resume or finish this session.');
            return;
          }
          state.dispatch(
            actions.sampleReceived({ ...owner, index: sample.index, angle: sample.angle }),
          );
        },
        onComplete() {
          if (connection !== current) return;
          if (state.get().analysis?.fixture.angles.length !== source.fixture.angles.length) {
            interrupt('The signal ended early. Resume or finish this session.');
            return;
          }
          void finishSession();
        },
        onError: interrupt,
      });
      // A synchronous source can complete before subscribe returns its cleanup function.
      if (connection !== current) current.stop();
    } catch {
      interrupt('The signal could not be opened. Resume or finish this session.');
    }
  }

  return {
    chooseExample(example: ExampleSession): void {
      const { patientId, pending } = state.get();
      if (pending[patientId] || isActive()) return;
      const importId = generateOperationId();
      state.dispatch(actions.beginImport({ patientId, importId }));
      state.dispatch(
        actions.imported({
          patientId,
          importId,
          source: { name: example.fileName, fixture: example.fixture, fixtureId: example.id },
        }),
      );
    },
    async importFile(file: FixtureFile): Promise<void> {
      const { patientId, pending } = state.get();
      if (pending[patientId] || isActive()) return;
      const importId = generateOperationId();
      state.dispatch(actions.beginImport({ patientId, importId }));
      try {
        const fixture = parseFixture(JSON.parse(await file.text()));
        state.dispatch(
          actions.imported({
            patientId,
            importId,
            source: { name: file.name, fixture, fixtureId: null },
          }),
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
    setPlaybackSpeed(speed: PlaybackSpeed): void {
      state.dispatch(actions.setPlaybackSpeed(speed));
    },
    startSession(): void {
      const snapshot = state.get();
      if (
        !snapshot.source ||
        isActive() ||
        snapshot.pending[snapshot.patientId] ||
        snapshot.saving[snapshot.patientId] ||
        snapshot.importId
      )
        return;
      const analysis = analyze(snapshot.patientId, snapshot.source.name, snapshot.source.fixture);
      state.dispatch(actions.sessionStarted(analysis));
      connect(analysis);
    },
    resumeSession(): void {
      const snapshot = state.get();
      if (snapshot.streamStatus !== 'interrupted' || !snapshot.analysis) return;
      state.dispatch(
        actions.sessionResumed({
          patientId: snapshot.patientId,
          sessionId: snapshot.analysis.result.sessionId,
        }),
      );
      connect(snapshot.analysis);
    },
    finishSession,
    saveResult,
  };
}
