import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDatabase(path: string): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS sessions (
      patient_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      reps INTEGER NOT NULL CHECK (reps >= 0),
      duration_sec REAL NOT NULL CHECK (duration_sec >= 0),
      performed_at TEXT NOT NULL,
      PRIMARY KEY (patient_id, session_id)
    );
    CREATE INDEX IF NOT EXISTS sessions_by_patient_date
      ON sessions(patient_id, performed_at DESC);
  `);
  return db;
}
