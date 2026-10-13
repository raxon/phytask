import type { SessionResult } from '@rep-counter/contracts/session';
import type { PatientId } from '@rep-counter/demo-data/patients';
import type { AnalysisFactory } from '../model/analysis';
import type { PendingResults, WorkspaceState } from '../model/types';
import type { WorkspaceAction } from '../model/workspace-slice';

export interface PendingResultsStorage {
  load(): PendingResults;
  /** Return false when another session already owns this patient's retry slot. */
  save(patientId: PatientId, result: SessionResult): Promise<boolean>;
  remove(patientId: PatientId, sessionId: string): Promise<void>;
}

export interface SessionWriter {
  save(patientId: PatientId, result: SessionResult): Promise<void>;
}

export interface WorkspaceStateAccess {
  get(): WorkspaceState;
  dispatch(action: WorkspaceAction): void;
}

export interface FixtureFile {
  name: string;
  text(): Promise<string>;
}

export interface WorkspaceDependencies {
  state: WorkspaceStateAccess;
  pendingResults: PendingResultsStorage;
  sessions: SessionWriter;
  analyze: AnalysisFactory;
  generateOperationId(): string;
}
