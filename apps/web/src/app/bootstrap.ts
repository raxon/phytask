import { patients, type PatientId } from '@rep-counter/demo-data/patients';
import { createAppStore } from './store';
import { examples } from '../features/workspace/model/examples';
import { createWorkspaceState } from '../features/workspace/model/workspace-slice';
import { createAnalysisFactory } from '../features/workspace/model/analysis';
import { createWorkspaceCommands } from '../features/workspace/application/commands';
import {
  createPendingResultsStorage,
  pendingStorageKey,
} from '../features/workspace/infrastructure/pending-results-storage';
import { createRtkSessionWriter } from '../features/workspace/infrastructure/rtk-session-writer';
import { createBrowserSignalStream } from '../features/workspace/infrastructure/browser-signal-stream';

// Concrete browser adapters are wired at this composition root.
const pendingResults = createPendingResultsStorage(
  () => window.localStorage,
  Object.keys(patients) as PatientId[],
  { run: (operation) => navigator.locks.request(pendingStorageKey, operation) },
);
const analyze = createAnalysisFactory({
  generateId: () => crypto.randomUUID(),
  performedAt: () => new Date().toISOString(),
});
const pending = pendingResults.load();
const first = examples[0]!;
const initialSource = pending.alex
  ? null
  : {
      name: first.fileName,
      fixture: first.fixture,
      fixtureId: first.id,
    };

export const store = createAppStore(createWorkspaceState('alex', pending, initialSource));
export const workspaceCommands = createWorkspaceCommands({
  state: {
    get: () => store.getState().workspace,
    dispatch: (action) => {
      store.dispatch(action);
    },
  },
  pendingResults,
  sessions: createRtkSessionWriter(store.dispatch),
  signals: createBrowserSignalStream({
    request: (url, options) => fetch(url, options),
    tokenFor: (patientId) => patients[patientId].token,
    schedule: (callback, intervalMs) => {
      const timer = window.setInterval(callback, intervalMs);
      return () => window.clearInterval(timer);
    },
  }),
  analyze,
  generateOperationId: () => crypto.randomUUID(),
});
