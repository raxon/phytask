import type { Fixture } from '@rep-counter/contracts/fixture';
import type { PatientId } from '@rep-counter/demo-data/patients';
import { createRepCounter } from '@rep-counter/domain/repetitions';
import type { Analysis } from './types';

export type AnalysisFactory = (patientId: PatientId, name: string, fixture: Fixture) => Analysis;

export function createAnalysisFactory(sources: {
  generateId(): string;
  performedAt(): string;
}): AnalysisFactory {
  return (patientId, name, fixture) => ({
    patientId,
    name,
    fixture: { ...fixture, angles: [] },
    counter: createRepCounter(),
    result: {
      sessionId: sources.generateId(),
      reps: 0,
      durationSec: 0,
      performedAt: sources.performedAt(),
    },
  });
}
