import { describe, expect, it } from 'vitest';
import { countReps } from '@rep-counter/domain/repetitions';
import { parseFixture } from '@rep-counter/contracts/fixture';
import clean from '@rep-counter/demo-data/fixtures/session-clean.json';
import noisy from '@rep-counter/demo-data/fixtures/session-noisy.json';
import shallow from '@rep-counter/demo-data/fixtures/session-shallow.json';

describe('countReps', () => {
  it.each([
    ['clean', clean, 10],
    ['noisy', noisy, 8],
    ['shallow', shallow, 7],
  ] as const)('counts the %s fixture', (_name, fixture, expected) => {
    expect(countReps(fixture.angles)).toBe(expected);
    expect(countReps(fixture.angles)).toBe(fixture.expectedReps);
  });

  it.each([
    { name: 'empty session', angles: [], reps: 0 },
    { name: 'standing still', angles: [172, 173, 161, 180], reps: 0 },
    { name: 'exact depth threshold', angles: [172, 100, 161], reps: 0 },
    { name: 'exact standing threshold', angles: [172, 99, 160], reps: 0 },
    { name: 'strictly crossed thresholds', angles: [100, 99.9, 160, 160.1], reps: 1 },
    { name: 'starts at the bottom', angles: [99, 161], reps: 1 },
    { name: 'long bottom pause', angles: [172, 99, 92, 92, 94, 98, 161, 172], reps: 1 },
    {
      name: 'bottom threshold jitter',
      angles: [172, 99, 101, 98, 100, 102, 159, 161, 163],
      reps: 1,
    },
    { name: 'shallow attempts', angles: [172, 130, 172, 120, 172], reps: 0 },
    { name: 'unfinished final squat', angles: [172, 90, 161, 90], reps: 1 },
    { name: 'consecutive full squats', angles: [90, 170, 95, 165, 98, 180], reps: 3 },
    { name: 'standing jitter after one rep', angles: [90, 161, 159, 162, 160, 170], reps: 1 },
  ])('$name', ({ angles, reps }) => {
    expect(countReps(Object.freeze(angles))).toBe(reps);
  });
});

describe('fixture import', () => {
  it('accepts noisy tracking above 180 degrees', () => {
    expect(Math.max(...noisy.angles)).toBeGreaterThan(180);
    expect(parseFixture(noisy)).toEqual(noisy);
  });
  it('does not use reference counts as input to the algorithm', () => {
    const fixture = parseFixture({ angles: [99, 161], sampleRateHz: 30, expectedReps: 999 });
    expect(countReps(fixture.angles)).toBe(1);
  });
  it.each([
    null,
    [],
    {},
    { angles: ['90'], sampleRateHz: 30 },
    { angles: [Infinity], sampleRateHz: 30 },
    { angles: [NaN], sampleRateHz: 30 },
    { angles: [], sampleRateHz: 0 },
    { angles: [], sampleRateHz: -1 },
    { angles: [], sampleRateHz: Infinity },
    { angles: [], sampleRateHz: 30, expectedReps: -1 },
  ])('rejects invalid fixture %j', (value) => {
    expect(() => parseFixture(value)).toThrow();
  });
  it('accepts empty sessions and optional metadata', () => {
    expect(parseFixture({ angles: [], sampleRateHz: 30 }).angles).toEqual([]);
  });
});
