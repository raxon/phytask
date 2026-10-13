export interface Fixture {
  angles: number[];
  sampleRateHz: number;
  description?: string;
  expectedReps?: number;
}

export function parseFixture(input: unknown): Fixture {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('Choose a JSON object with angles and sampleRateHz.');
  }
  const value = input as Record<string, unknown>;
  if (
    !Array.isArray(value.angles) ||
    !value.angles.every((angle) => typeof angle === 'number' && Number.isFinite(angle))
  ) {
    throw new Error('Every angle must be a finite number.');
  }
  if (
    typeof value.sampleRateHz !== 'number' ||
    !Number.isFinite(value.sampleRateHz) ||
    value.sampleRateHz <= 0
  ) {
    throw new Error('sampleRateHz must be a positive, finite number.');
  }
  if (value.description !== undefined && typeof value.description !== 'string') {
    throw new Error('description must be text.');
  }
  if (
    value.expectedReps !== undefined &&
    (typeof value.expectedReps !== 'number' ||
      !Number.isSafeInteger(value.expectedReps) ||
      value.expectedReps < 0)
  ) {
    throw new Error('expectedReps must be a non-negative integer.');
  }
  return {
    angles: value.angles as number[],
    sampleRateHz: value.sampleRateHz,
    description: value.description as string | undefined,
    expectedReps: value.expectedReps as number | undefined,
  };
}
