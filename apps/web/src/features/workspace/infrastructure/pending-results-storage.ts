import { parseSession } from '@rep-counter/contracts/session';
import type { PatientId } from '@rep-counter/demo-data/patients';
import type { PendingResultsStorage } from '../application/ports';
import type { PendingResults } from '../model/types';

interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface StorageCoordinator {
  run<T>(operation: () => T): Promise<T>;
}

export const pendingStorageKey = 'rep-counter.pending.v1';

export function createPendingResultsStorage(
  getStorage: () => KeyValueStorage,
  patientIds: readonly PatientId[],
  coordinator: StorageCoordinator,
): PendingResultsStorage {
  const load: PendingResultsStorage['load'] = () => {
    try {
      const stored = JSON.parse(getStorage().getItem(pendingStorageKey) ?? 'null');
      if (!stored || stored.version !== 1 || typeof stored.pending !== 'object' || !stored.pending)
        return {};
      const pending: PendingResults = {};
      for (const id of patientIds) {
        const result = parseSession(stored.pending[id]);
        if (result) pending[id] = result;
      }
      return pending;
    } catch {
      return {};
    }
  };
  return {
    load,
    save(patientId, result) {
      // A shared lock makes read/check/write indivisible across browser tabs.
      return coordinator.run(() => {
        // Read the durable queue, not a tab's stale Redux snapshot, before changing one owner.
        const pending = load();
        const previous = pending[patientId];
        if (
          previous &&
          (previous.sessionId !== result.sessionId ||
            previous.reps !== result.reps ||
            previous.durationSec !== result.durationSec ||
            previous.performedAt !== result.performedAt)
        )
          return false;
        pending[patientId] = result;
        getStorage().setItem(pendingStorageKey, JSON.stringify({ version: 1, pending }));
        return true;
      });
    },
    remove(patientId, sessionId) {
      return coordinator.run(() => {
        const pending = load();
        if (pending[patientId]?.sessionId !== sessionId) return;
        delete pending[patientId];
        getStorage().setItem(pendingStorageKey, JSON.stringify({ version: 1, pending }));
      });
    },
  };
}
