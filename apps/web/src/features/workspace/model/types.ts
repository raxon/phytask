import type { Fixture } from '@rep-counter/contracts/fixture';
import type { SessionResult } from '@rep-counter/contracts/session';
import type { PatientId } from '@rep-counter/demo-data/patients';

export interface Analysis {
  patientId: PatientId;
  name: string;
  fixture: Fixture;
  result: SessionResult;
}

export type PendingResults = Partial<Record<PatientId, SessionResult>>;

export interface WorkspaceState {
  patientId: PatientId;
  analysis: Analysis | null;
  pending: PendingResults;
  saving: Partial<Record<PatientId, string>>;
  errors: Partial<Record<PatientId, string>>;
  saved: Partial<Record<PatientId, string>>;
  confirmation: SessionResult | null;
  importId: string | null;
  importError: string | null;
}
