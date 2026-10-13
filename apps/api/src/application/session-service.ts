import type { SessionResult } from '@rep-counter/contracts/session';
import type { SessionRepository } from './ports/session-repository';

export type SaveSessionOutcome =
  { status: 'created' | 'existing'; result: SessionResult } | { status: 'conflict' };

export interface SessionUseCases {
  save(patientId: string, result: SessionResult): SaveSessionOutcome;
  list(patientId: string): SessionResult[];
}

export function createSessionService(repository: SessionRepository): SessionUseCases {
  return {
    save(patientId, result) {
      const saved = repository.createOrGet(patientId, result);
      if (
        !saved.created &&
        (saved.result.reps !== result.reps ||
          saved.result.durationSec !== result.durationSec ||
          saved.result.performedAt !== result.performedAt)
      )
        return { status: 'conflict' };
      return { status: saved.created ? 'created' : 'existing', result: saved.result };
    },
    list(patientId) {
      return repository.listByPatient(patientId);
    },
  };
}
