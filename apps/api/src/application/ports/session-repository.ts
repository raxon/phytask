import type { SessionResult } from '@rep-counter/contracts/session';

export interface StoredSession {
  created: boolean;
  result: SessionResult;
}

export interface SessionRepository {
  /** The adapter must enforce uniqueness atomically, including concurrent retries. */
  createOrGet(patientId: string, result: SessionResult): StoredSession;
  listByPatient(patientId: string): SessionResult[];
}
