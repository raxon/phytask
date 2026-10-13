import { fixtures } from '@rep-counter/demo-data/fixtures';
import type { Fixture } from '@rep-counter/contracts/fixture';

export interface ExampleSession {
  id: string;
  title: string;
  detail: string;
  fileName: string;
  fixture: Fixture;
}

export const examples: readonly ExampleSession[] = [
  {
    id: 'clean',
    title: 'Clean signal',
    detail: '10 full squats',
    fileName: 'session-clean.json',
    fixture: fixtures.clean,
  },
  {
    id: 'noisy',
    title: 'Noisy signal',
    detail: '8 squats with pauses',
    fileName: 'session-noisy.json',
    fixture: fixtures.noisy,
  },
  {
    id: 'shallow',
    title: 'Shallow squats',
    detail: '10 attempts, 7 full reps',
    fileName: 'session-shallow.json',
    fixture: fixtures.shallow,
  },
];
