import { describe, expect, it, vi } from 'vitest';
import type { SessionResult } from '@rep-counter/contracts/session';
import { createSessionService } from '../../src/application/session-service';
import type { SessionRepository } from '../../src/application/ports/session-repository';

const result: SessionResult = {
  sessionId: 'session-1',
  reps: 10,
  durationSec: 36,
  performedAt: '2026-10-13T10:00:00.000Z',
};

function repository(created: boolean): SessionRepository {
  return {
    createOrGet: vi.fn(() => ({ created, result })),
    listByPatient: vi.fn(() => [result]),
  };
}

describe('session use cases with an injected repository', () => {
  it('creates a result without depending on a database or HTTP server', () => {
    const adapter = repository(true);
    expect(createSessionService(adapter).save('patient-a', result)).toEqual({
      status: 'created',
      result,
    });
    expect(adapter.createOrGet).toHaveBeenCalledWith('patient-a', result);
  });

  it('returns the original result when a retry is identical', () => {
    expect(createSessionService(repository(false)).save('patient-a', { ...result })).toEqual({
      status: 'existing',
      result,
    });
  });

  it.each([{ reps: 11 }, { durationSec: 37 }, { performedAt: '2026-10-14T10:00:00.000Z' }])(
    'does not replace an existing result for a conflict %j',
    (changes) => {
      expect(
        createSessionService(repository(false)).save('patient-a', { ...result, ...changes }),
      ).toEqual({ status: 'conflict' });
    },
  );

  it('always delegates listing with the authenticated owner', () => {
    const adapter = repository(false);
    expect(createSessionService(adapter).list('patient-b')).toEqual([result]);
    expect(adapter.listByPatient).toHaveBeenCalledWith('patient-b');
  });

  it('lets the HTTP boundary handle infrastructure errors', () => {
    const failure = new Error('Storage unavailable');
    const adapter: SessionRepository = {
      createOrGet: () => {
        throw failure;
      },
      listByPatient: () => [],
    };
    expect(() => createSessionService(adapter).save('patient-a', result)).toThrow(failure);
  });
});
