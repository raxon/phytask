import type { Fixture } from '@rep-counter/contracts/fixture';
import type { SessionResult } from '@rep-counter/contracts/session';
import type { PatientId } from '@rep-counter/demo-data/patients';
import type { PlaybackSpeed } from '@rep-counter/contracts/signal';
import type { RepCounterState } from '@rep-counter/domain/repetitions';

export interface SimulationSource {
  name: string;
  fixture: Fixture;
  fixtureId: string | null;
}

export interface Analysis {
  patientId: PatientId;
  name: string;
  fixture: Fixture;
  result: SessionResult;
  counter: RepCounterState;
}

export type PendingResults = Partial<Record<PatientId, SessionResult>>;

export interface WorkspaceState {
  patientId: PatientId;
  analysis: Analysis | null;
  source: SimulationSource | null;
  playbackSpeed: PlaybackSpeed;
  streamStatus: 'idle' | 'running' | 'interrupted' | 'completed';
  streamError: string | null;
  pending: PendingResults;
  saving: Partial<Record<PatientId, string>>;
  errors: Partial<Record<PatientId, string>>;
  saved: Partial<Record<PatientId, string>>;
  confirmation: SessionResult | null;
  importId: string | null;
  importError: string | null;
}
