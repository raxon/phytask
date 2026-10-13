import type { DatabaseSync } from 'node:sqlite';
import type { SessionResult } from '@rep-counter/contracts/session';
import type { SessionRepository } from '../../application/ports/session-repository';

const projection =
  'session_id AS sessionId, reps, duration_sec AS durationSec, performed_at AS performedAt';

export function createSqliteSessionRepository(db: DatabaseSync): SessionRepository {
  const insert =
    db.prepare(`INSERT INTO sessions (patient_id, session_id, reps, duration_sec, performed_at)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT (patient_id, session_id) DO NOTHING`);
  const find = db.prepare(
    `SELECT ${projection} FROM sessions WHERE patient_id = ? AND session_id = ?`,
  );
  const list = db.prepare(
    `SELECT ${projection} FROM sessions WHERE patient_id = ? ORDER BY performed_at DESC, session_id ASC`,
  );

  return {
    createOrGet(patientId, result) {
      const inserted = insert.run(
        patientId,
        result.sessionId,
        result.reps,
        result.durationSec,
        result.performedAt,
      );
      const row = find.get(patientId, result.sessionId);
      if (!row) throw new Error('The stored session could not be read.');
      return { created: Number(inserted.changes) === 1, result: row as unknown as SessionResult };
    },
    listByPatient(patientId) {
      return list.all(patientId) as unknown as SessionResult[];
    },
  };
}
