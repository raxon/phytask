import clean from '../fixtures/session-clean.json';
import noisy from '../fixtures/session-noisy.json';
import shallow from '../fixtures/session-shallow.json';
import type { Fixture } from '@rep-counter/contracts/fixture';

export const fixtures: Readonly<Record<'clean' | 'noisy' | 'shallow', Fixture>> = {
  clean,
  noisy,
  shallow,
};
