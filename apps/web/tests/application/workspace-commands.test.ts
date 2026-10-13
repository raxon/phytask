import { describe, expect, it, vi } from 'vitest';
import type { PatientId } from '@rep-counter/demo-data/patients';
import type { SessionResult } from '@rep-counter/contracts/session';
import { createAppStore } from '../../src/app/store';
import { createWorkspaceCommands } from '../../src/features/workspace/application/commands';
import type {
  PendingResultsStorage,
  SessionWriter,
  SignalStream,
} from '../../src/features/workspace/application/ports';
import { createAnalysisFactory } from '../../src/features/workspace/model/analysis';
import { examples } from '../../src/features/workspace/model/examples';
import type { PendingResults } from '../../src/features/workspace/model/types';
import { actions, createWorkspaceState } from '../../src/features/workspace/model/workspace-slice';
import {
  createPendingResultsStorage,
  pendingStorageKey,
} from '../../src/features/workspace/infrastructure/pending-results-storage';

class MemoryPendingResultsStorage implements PendingResultsStorage {
  pending: PendingResults = {};
  load() {
    return structuredClone(this.pending);
  }
  async save(patientId: PatientId, result: SessionResult) {
    this.pending[patientId] = structuredClone(result);
    return true;
  }
  async remove(patientId: PatientId, sessionId: string) {
    if (this.pending[patientId]?.sessionId === sessionId) delete this.pending[patientId];
  }
}

class ManualSignalStream implements SignalStream {
  subscriptions: Parameters<SignalStream['subscribe']>[0][] = [];
  stop = vi.fn();
  subscribe(options: Parameters<SignalStream['subscribe']>[0]) {
    this.subscriptions.push(options);
    return this.stop;
  }
  get latest() {
    return this.subscriptions.at(-1)!;
  }
  feedAll() {
    const current = this.latest;
    current.source.fixture.angles.slice(current.fromIndex).forEach((angle, offset) => {
      current.onSample({ index: current.fromIndex + offset, angle });
    });
    current.onComplete();
  }
}

function durableQueue() {
  const values = new Map<string, string>();
  let tail = Promise.resolve();
  const adapter = createPendingResultsStorage(
    () => ({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
    }),
    ['alex', 'jamie'],
    {
      run<T>(operation: () => T): Promise<T> {
        const result = tail.then(operation);
        tail = result.then(
          () => {},
          () => {},
        );
        return result;
      },
    },
  );
  return { adapter, values };
}

function harness(
  sessions: SessionWriter,
  pendingResults: PendingResultsStorage = new MemoryPendingResultsStorage(),
) {
  let sequence = 0;
  const signals = new ManualSignalStream();
  const store = createAppStore(createWorkspaceState('alex', pendingResults.load()));
  const commands = createWorkspaceCommands({
    state: {
      get: () => store.getState().workspace,
      dispatch: (action) => {
        store.dispatch(action);
      },
    },
    pendingResults,
    sessions,
    signals,
    analyze: createAnalysisFactory({
      generateId: () => 'session-' + ++sequence,
      performedAt: () => '2026-10-13T10:00:00.000Z',
    }),
    generateOperationId: () => 'operation-' + ++sequence,
  });
  const state = () => store.getState().workspace;
  const settled = () => vi.waitFor(() => expect(state().saving).toEqual({}));
  async function run(example = examples[0]!) {
    commands.chooseExample(example);
    commands.startSession();
    signals.feedAll();
    await settled();
  }
  return { store, commands, state, signals, run, settled };
}

const result: SessionResult = {
  sessionId: 'stored-result',
  reps: 10,
  durationSec: 36.2,
  performedAt: '2026-10-13T10:00:00.000Z',
};

describe('live workspace operations', () => {
  it('selects a source without precounting and sends nothing until Finish', async () => {
    const save = vi.fn<SessionWriter['save']>().mockResolvedValue(undefined);
    const app = harness({ save });
    app.commands.chooseExample(examples[0]!);
    expect(app.state().analysis).toBeNull();
    await app.commands.saveResult();
    expect(save).not.toHaveBeenCalled();
    app.commands.startSession();
    const identity = { ...app.state().analysis!.result };
    app.signals.latest.onSample({ index: 0, angle: 99 });
    app.signals.latest.onSample({ index: 1, angle: 160 });
    expect(app.state().analysis!.result.reps).toBe(0);
    app.signals.latest.onSample({ index: 2, angle: 181.6 });
    expect(app.state().analysis!.result.reps).toBe(1);
    expect(app.state().analysis!.result.durationSec).toBe(3 / 30);
    await app.commands.saveResult();
    expect(save).not.toHaveBeenCalled();
    app.store.dispatch(actions.selectPatient('jamie'));
    expect(app.state().patientId).toBe('alex');
    await app.commands.finishSession();
    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith('alex', { ...identity, reps: 1, durationSec: 3 / 30 });
    expect(Object.keys(save.mock.calls[0]![1]).sort()).toEqual([
      'durationSec',
      'performedAt',
      'reps',
      'sessionId',
    ]);
  });

  it.each(examples)(
    'counts and automatically saves $title only when its stream completes',
    async (example) => {
      const save = vi.fn<SessionWriter['save']>().mockResolvedValue(undefined);
      const app = harness({ save });
      await app.run(example);
      expect(save).toHaveBeenCalledOnce();
      expect(app.state().analysis!.result.reps).toBe(example.fixture.expectedReps);
      expect(app.state().analysis!.result.durationSec).toBe(
        example.fixture.angles.length / example.fixture.sampleRateHz,
      );
      expect(app.state().streamStatus).toBe('completed');
      expect(app.signals.stop).toHaveBeenCalledOnce();
    },
  );

  it('resumes after a disconnect with the same ID, counter and next index', async () => {
    const save = vi.fn<SessionWriter['save']>().mockResolvedValue(undefined);
    const app = harness({ save });
    app.commands.chooseExample(examples[0]!);
    app.commands.startSession();
    const original = app.signals.latest;
    const identity = { ...app.state().analysis!.result };
    original.onSample({ index: 0, angle: 90 });
    original.onSample({ index: 1, angle: 100 });
    original.onError('Connection lost');
    expect(app.state().streamStatus).toBe('interrupted');
    expect(save).not.toHaveBeenCalled();
    app.commands.resumeSession();
    expect(app.signals.latest.fromIndex).toBe(2);
    original.onSample({ index: 2, angle: 170 });
    expect(app.state().analysis!.fixture.angles).toHaveLength(2);
    app.signals.latest.onSample({ index: 2, angle: 161 });
    await app.commands.finishSession();
    expect(save).toHaveBeenCalledWith('alex', { ...identity, reps: 1, durationSec: 3 / 30 });
  });

  it('does not save a truncated or invalid stream until explicitly finished', async () => {
    const save = vi.fn<SessionWriter['save']>().mockResolvedValue(undefined);
    const app = harness({ save });
    app.commands.chooseExample(examples[0]!);
    app.commands.startSession();
    app.signals.latest.onSample({ index: 0, angle: 90 });
    app.signals.latest.onComplete();
    expect(app.state().streamStatus).toBe('interrupted');
    expect(save).not.toHaveBeenCalled();
    app.commands.resumeSession();
    app.signals.latest.onSample({ index: 3, angle: 170 });
    expect(app.state().streamStatus).toBe('interrupted');
    expect(app.state().analysis!.fixture.angles).toEqual([90]);
    await app.commands.finishSession();
    expect(save.mock.calls[0]![1].reps).toBe(0);
  });

  it('ignores old sample callbacks after Finish and after starting another session', async () => {
    const app = harness({ save: async () => {} });
    app.commands.chooseExample(examples[0]!);
    app.commands.startSession();
    const old = app.signals.latest;
    const id = app.state().analysis!.result.sessionId;
    old.onSample({ index: 0, angle: 90 });
    await app.commands.finishSession();
    old.onSample({ index: 1, angle: 170 });
    expect(app.state().analysis!.result.reps).toBe(0);
    app.commands.startSession();
    expect(app.state().analysis!.result.sessionId).not.toBe(id);
    old.onSample({ index: 0, angle: 90 });
    expect(app.state().analysis!.fixture.angles).toEqual([]);
  });

  it('persists before the automatic POST and retries the exact result after reload', async () => {
    const persistence = new MemoryPendingResultsStorage();
    const save = vi
      .fn<SessionWriter['save']>()
      .mockRejectedValueOnce(new Error('Lost response'))
      .mockResolvedValue(undefined);
    const first = harness({ save }, persistence);
    await first.run();
    const frozen = first.state().pending.alex!;
    expect(persistence.pending.alex).toEqual(frozen);
    const restored = harness({ save }, persistence);
    await restored.commands.saveResult();
    expect(save).toHaveBeenNthCalledWith(1, 'alex', frozen);
    expect(save).toHaveBeenNthCalledWith(2, 'alex', frozen);
    expect(persistence.pending).toEqual({});
  });

  it('preserves retry results owned by another tab and removes only its confirmed owner', async () => {
    const { adapter } = durableQueue();
    const sessions = {
      save: async () => {
        throw new Error('Lost response');
      },
    };
    const first = harness(sessions, adapter);
    const second = harness(sessions, adapter);
    second.store.dispatch(actions.selectPatient('jamie'));
    await first.run();
    await second.run(examples[1]!);
    expect(adapter.load()).toEqual({
      alex: first.state().pending.alex,
      jamie: second.state().pending.jamie,
    });
    const restored = harness({ save: async () => {} }, adapter);
    await restored.commands.saveResult();
    expect(adapter.load()).toEqual({ jamie: second.state().pending.jamie });
  });

  it("does not overwrite another tab's unconfirmed result for the same patient", async () => {
    const { adapter } = durableQueue();
    const save = vi.fn<SessionWriter['save']>().mockRejectedValue(new Error('Lost response'));
    const first = harness({ save }, adapter);
    const second = harness({ save }, adapter);
    await first.run();
    await second.run(examples[1]!);
    expect(save).toHaveBeenCalledOnce();
    expect(adapter.load()).toEqual({ alex: first.state().pending.alex });
    expect(second.state().errors.alex).toContain('Another tab');
  });

  it('does not POST when durable retry storage is unavailable', async () => {
    const save = vi.fn<SessionWriter['save']>();
    const app = harness(
      { save },
      {
        load: () => ({}),
        save: async () => {
          throw new Error('Storage blocked');
        },
        remove: async () => {},
      },
    );
    await app.run();
    expect(save).not.toHaveBeenCalled();
    expect(app.state().errors.alex).toContain('retry copy');
  });

  it('keeps an automatic save attached to its owner after changing patient', async () => {
    let release!: () => void;
    const save = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const app = harness({ save });
    app.commands.chooseExample(examples[0]!);
    app.commands.startSession();
    app.signals.feedAll();
    const original = app.state().analysis!.result;
    app.store.dispatch(actions.selectPatient('jamie'));
    app.commands.chooseExample(examples[2]!);
    app.commands.startSession();
    app.signals.latest.onSample({ index: 0, angle: 90 });
    app.signals.latest.onSample({ index: 1, angle: 170 });
    await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
    release();
    await app.settled();
    expect(app.state().analysis?.patientId).toBe('jamie');
    expect(app.state().analysis?.result.reps).toBe(1);
    expect(app.state().saved.alex).toBe(original.sessionId);
    expect(app.state().confirmation).toBeNull();
  });

  it('does not POST again when Finish or retry is clicked while saving', async () => {
    let release!: () => void;
    const save = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const app = harness({ save });
    app.commands.chooseExample(examples[0]!);
    app.commands.startSession();
    app.signals.feedAll();
    await app.commands.finishSession();
    await app.commands.saveResult();
    await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
    release();
    await app.settled();
  });

  it('ignores an imported file that finishes after changing patients', async () => {
    let release!: (text: string) => void;
    const text = new Promise<string>((resolve) => {
      release = resolve;
    });
    const app = harness({ save: async () => {} });
    const importing = app.commands.importFile({ name: 'clean.json', text: () => text });
    app.store.dispatch(actions.selectPatient('jamie'));
    app.commands.chooseExample(examples[1]!);
    release(JSON.stringify(examples[0]!.fixture));
    await importing;
    expect(app.state().source?.fixture.expectedReps).toBe(8);
    expect(app.state().analysis).toBeNull();
  });
});

describe('pending storage adapter', () => {
  it('preserves the existing schema and stores only result fields', async () => {
    const { adapter, values } = durableQueue();
    await adapter.save('alex', result);
    expect(adapter.load()).toEqual({ alex: result });
    const raw = values.get(pendingStorageKey)!;
    expect(JSON.parse(raw).version).toBe(1);
    expect(raw).not.toContain('angles');
    expect(raw).not.toContain('token');
  });
  it('removes only the confirmed session and keeps a newer retry copy', async () => {
    const { adapter } = durableQueue();
    expect(await adapter.save('alex', result)).toBe(true);
    expect(await adapter.save('alex', result)).toBe(true);
    await adapter.remove('alex', 'another-session');
    expect(adapter.load()).toEqual({ alex: result });
    await adapter.remove('alex', result.sessionId);
    expect(adapter.load()).toEqual({});
  });
  it('treats corrupt or unavailable storage as an empty queue', () => {
    expect(
      createPendingResultsStorage(
        () => ({ getItem: () => '{broken', setItem: () => {} }),
        ['alex'],
        { run: async (operation) => operation() },
      ).load(),
    ).toEqual({});
    expect(
      createPendingResultsStorage(
        () => {
          throw new Error('Storage blocked');
        },
        ['alex'],
        { run: async (operation) => operation() },
      ).load(),
    ).toEqual({});
  });
});
