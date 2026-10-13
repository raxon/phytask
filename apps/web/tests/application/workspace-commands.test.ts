import { describe, expect, it, vi } from 'vitest';
import type { PatientId } from '@rep-counter/demo-data/patients';
import type { SessionResult } from '@rep-counter/contracts/session';
import { createAppStore } from '../../src/app/store';
import { createWorkspaceCommands } from '../../src/features/workspace/application/commands';
import type {
  PendingResultsStorage,
  SessionWriter,
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
    analyze: createAnalysisFactory({
      generateId: () => `session-${++sequence}`,
      performedAt: () => '2026-10-13T10:00:00.000Z',
    }),
    generateOperationId: () => `operation-${++sequence}`,
  });
  return { store, commands, state: () => store.getState().workspace };
}

describe('workspace operations with replaceable adapters', () => {
  it('preserves pending results owned by another open tab', async () => {
    const { adapter: persistence } = durableQueue();
    const sessions = {
      save: async () => {
        throw new Error('Lost response');
      },
    };
    const first = harness(sessions, persistence);
    const second = harness(sessions, persistence);
    first.commands.chooseExample(examples[0]!);
    second.store.dispatch(actions.selectPatient('jamie'));
    second.commands.chooseExample(examples[1]!);
    await first.commands.saveResult();
    await second.commands.saveResult();
    expect(persistence.load()).toEqual({
      alex: first.state().pending.alex,
      jamie: second.state().pending.jamie,
    });
    const restored = harness({ save: async () => {} }, persistence);
    await restored.commands.saveResult();
    expect(persistence.load()).toEqual({ jamie: second.state().pending.jamie });
  });

  it("does not overwrite another tab's unconfirmed result for the same patient", async () => {
    const { adapter: persistence } = durableQueue();
    const save = vi.fn<SessionWriter['save']>().mockRejectedValue(new Error('Lost response'));
    const first = harness({ save }, persistence);
    const second = harness({ save }, persistence);
    first.commands.chooseExample(examples[0]!);
    second.commands.chooseExample(examples[1]!);
    await first.commands.saveResult();
    await second.commands.saveResult();
    expect(save).toHaveBeenCalledTimes(1);
    expect(persistence.load()).toEqual({ alex: first.state().pending.alex });
    expect(second.state().errors.alex).toContain('Another tab');
  });

  it('persists before sending and retries the same result after restoring state', async () => {
    const persistence = new MemoryPendingResultsStorage();
    const save = vi
      .fn<SessionWriter['save']>()
      .mockRejectedValueOnce(new Error('Lost response'))
      .mockResolvedValue(undefined);
    const first = harness({ save }, persistence);
    first.commands.chooseExample(examples[0]!);
    const result = first.state().analysis!.result;
    await first.commands.saveResult();
    expect(persistence.pending.alex).toEqual(result);
    expect(first.state().errors.alex).toContain('server did not confirm');
    const restored = harness({ save }, persistence);
    await restored.commands.saveResult();
    expect(save).toHaveBeenNthCalledWith(1, 'alex', result);
    expect(save).toHaveBeenNthCalledWith(2, 'alex', result);
    expect(persistence.pending).toEqual({});
    expect(restored.state().saved.alex).toBe(result.sessionId);
  });

  it('does not send a result when durable retry storage is unavailable', async () => {
    const save = vi.fn<SessionWriter['save']>();
    const persistence: PendingResultsStorage = {
      load: () => ({}),
      save: async () => {
        throw new Error('Storage blocked');
      },
      remove: async () => {},
    };
    const app = harness({ save }, persistence);
    app.commands.chooseExample(examples[0]!);
    await app.commands.saveResult();
    expect(save).not.toHaveBeenCalled();
    expect(app.state().errors.alex).toContain('retry copy');
  });

  it('keeps an in-flight save attached to its original patient', async () => {
    let release!: () => void;
    const save = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const app = harness({ save });
    app.commands.chooseExample(examples[0]!);
    const original = app.state().analysis!.result;
    const pendingSave = app.commands.saveResult();
    app.store.dispatch(actions.selectPatient('jamie'));
    app.commands.chooseExample(examples[2]!);
    await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
    release();
    await pendingSave;
    expect(app.state().analysis?.patientId).toBe('jamie');
    expect(app.state().analysis?.result.reps).toBe(7);
    expect(app.state().saved.alex).toBe(original.sessionId);
    expect(app.state().confirmation).toBeNull();
  });

  it('does not submit a second write while the first is in flight', async () => {
    let release!: () => void;
    const save = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const app = harness({ save });
    app.commands.chooseExample(examples[0]!);
    const first = app.commands.saveResult();
    await app.commands.saveResult();
    await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save).toHaveBeenCalledTimes(1);
    release();
    await first;
  });

  it('ignores a late imported file after switching the selected patient', async () => {
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
    expect(app.state().analysis?.patientId).toBe('jamie');
    expect(app.state().analysis?.result.reps).toBe(8);
  });
});

describe('pending storage adapter', () => {
  it('preserves the existing storage schema and stores only result fields', async () => {
    const { adapter, values } = durableQueue();
    const app = harness({ save: async () => {} });
    app.commands.chooseExample(examples[0]!);
    const result = app.state().analysis!.result;
    await adapter.save('alex', result);
    expect(adapter.load()).toEqual({ alex: result });
    const raw = values.get(pendingStorageKey)!;
    expect(JSON.parse(raw).version).toBe(1);
    expect(raw).not.toContain('angles');
    expect(raw).not.toContain('token');
  });

  it('removes only the confirmed session and leaves a newer retry copy intact', async () => {
    const { adapter } = durableQueue();
    const app = harness({ save: async () => {} });
    app.commands.chooseExample(examples[0]!);
    const result = app.state().analysis!.result;
    expect(await adapter.save('alex', result)).toBe(true);
    expect(await adapter.save('alex', result)).toBe(true);
    await adapter.remove('alex', 'another-session');
    expect(adapter.load()).toEqual({ alex: result });
    await adapter.remove('alex', result.sessionId);
    expect(adapter.load()).toEqual({});
  });

  it('treats a corrupt or unavailable local storage as an empty queue', () => {
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
