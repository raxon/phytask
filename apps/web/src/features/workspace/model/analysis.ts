import type { Fixture } from '@rep-counter/contracts/fixture';
import type { PatientId } from '@rep-counter/demo-data/patients';
import { countReps } from '@rep-counter/domain/repetitions';
import type { Analysis } from './types';

export type AnalysisFactory = (patientId: PatientId, name: string, fixture: Fixture) => Analysis;

export function createAnalysisFactory(sources: {
  generateId(): string;
  performedAt(): string;
}): AnalysisFactory {
  return (patientId, name, fixture) => ({
    patientId,
    name,
    fixture,
    result: {
      sessionId: sources.generateId(),
      reps: countReps(fixture.angles),
      durationSec: fixture.angles.length / fixture.sampleRateHz,
      performedAt: sources.performedAt(),
    },
  });
}
