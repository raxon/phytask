import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApiApplication } from '../../src/composition-root';

const alex = 'Bearer demo-alex-token';
const jamie = 'Bearer demo-jamie-token';
const result = {
  sessionId: 'test-session',
  reps: 10,
  durationSec: 36.266666666666666,
  performedAt: '2026-10-13T10:00:00.000Z',
};
let application: ReturnType<typeof createApiApplication>;
let app: ReturnType<typeof createApiApplication>['app'];

beforeEach(() => {
  application = createApiApplication({ databasePath: ':memory:' });
  app = application.app;
});
afterEach(() => application.close());

describe('patient session API', () => {
  it.each([
    undefined,
    'Bearer wrong-token',
    'Basic demo-alex-token',
    'Bearer demo-alex-token extra',
  ])('rejects invalid authorization %s', async (authorization) => {
    for (const method of ['get', 'post'] as const) {
      const req = request(app)[method]('/sessions');
      if (authorization) req.set('Authorization', authorization);
      const response = await req.send(result);
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    }
  });
  it('creates a session and returns it for identical retries', async () => {
    const created = await request(app).post('/sessions').set('Authorization', alex).send(result);
    const retry = await request(app).post('/sessions').set('Authorization', alex).send(result);
    expect(created.status).toBe(201);
    expect(retry.status).toBe(200);
    expect(retry.body).toEqual(result);
    const history = await request(app).get('/sessions').set('Authorization', alex);
    expect(history.body).toEqual([result]);
    expect(history.headers['cache-control']).toBe('no-store');
  });
  it('saves exactly once under concurrent retries', async () => {
    const responses = await Promise.all(
      Array.from({ length: 20 }, () =>
        request(app).post('/sessions').set('Authorization', alex).send(result),
      ),
    );
    expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 200)).toHaveLength(19);
    expect((await request(app).get('/sessions').set('Authorization', alex)).body).toHaveLength(1);
  });
  it('isolates patients and scopes duplicate IDs to their owner', async () => {
    await request(app).post('/sessions').set('Authorization', alex).send(result).expect(201);
    expect((await request(app).get('/sessions').set('Authorization', jamie)).body).toEqual([]);
    const other = { ...result, reps: 8 };
    await request(app).post('/sessions').set('Authorization', jamie).send(other).expect(201);
    expect((await request(app).get('/sessions').set('Authorization', alex)).body).toEqual([result]);
    expect((await request(app).get('/sessions').set('Authorization', jamie)).body).toEqual([other]);
  });
  it.each([{ reps: 11 }, { durationSec: 37 }, { performedAt: '2026-10-13T11:00:00.000Z' }])(
    'rejects a conflicting retry %j without replacing the original',
    async (changes) => {
      await request(app).post('/sessions').set('Authorization', alex).send(result).expect(201);
      const conflict = await request(app)
        .post('/sessions')
        .set('Authorization', alex)
        .send({ ...result, ...changes });
      expect(conflict.status).toBe(409);
      expect(conflict.body.error.code).toBe('SESSION_CONFLICT');
      expect((await request(app).get('/sessions').set('Authorization', alex)).body).toEqual([
        result,
      ]);
    },
  );
  it('normalizes equivalent dates with explicit timezones', async () => {
    await request(app)
      .post('/sessions')
      .set('Authorization', alex)
      .send({ ...result, performedAt: '2026-10-13T12:00:00+02:00' })
      .expect(201);
    await request(app).post('/sessions').set('Authorization', alex).send(result).expect(200);
  });
  it('lists newest performed sessions first', async () => {
    const older = { ...result, sessionId: 'older', performedAt: '2026-10-12T10:00:00.000Z' };
    await request(app).post('/sessions').set('Authorization', alex).send(result);
    await request(app).post('/sessions').set('Authorization', alex).send(older);
    expect((await request(app).get('/sessions').set('Authorization', alex)).body).toEqual([
      result,
      older,
    ]);
  });
  it.each([
    { ...result, sessionId: '' },
    { ...result, reps: -1 },
    { ...result, reps: 1.5 },
    { ...result, reps: '10' },
    { ...result, durationSec: -1 },
    { ...result, durationSec: null },
    { ...result, performedAt: '2026-10-13T10:00:00' },
    { ...result, performedAt: '2026-02-30T10:00:00Z' },
    { ...result, performedAt: 'invalid' },
    { ...result, angles: [90, 172] },
    { ...result, patientId: 'jamie' },
    { sessionId: 'missing' },
  ])('rejects invalid or additional result fields %j', async (input) => {
    const response = await request(app).post('/sessions').set('Authorization', alex).send(input);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_SESSION');
    expect((await request(app).get('/sessions').set('Authorization', alex)).body).toEqual([]);
  });
  it('returns JSON errors for malformed and oversized bodies', async () => {
    const malformed = await request(app)
      .post('/sessions')
      .set('Authorization', alex)
      .set('Content-Type', 'application/json')
      .send('{broken');
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe('INVALID_JSON');
    const oversized = await request(app)
      .post('/sessions')
      .set('Authorization', alex)
      .send({ ...result, angles: 'x'.repeat(20000) });
    expect(oversized.status).toBe(413);
    expect(oversized.body.error.code).toBe('BODY_TOO_LARGE');
  });
  it('preserves results when the database is closed and reopened', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'rep-counter-db-'));
    const path = join(directory, 'sessions.sqlite');
    let persistent = createApiApplication({ databasePath: path });
    try {
      await request(persistent.app)
        .post('/sessions')
        .set('Authorization', alex)
        .send(result)
        .expect(201);
      persistent.close();
      persistent = createApiApplication({ databasePath: path });
      const restarted = persistent.app;
      expect((await request(restarted).get('/sessions').set('Authorization', alex)).body).toEqual([
        result,
      ]);
      await request(restarted)
        .post('/sessions')
        .set('Authorization', alex)
        .send(result)
        .expect(200);
    } finally {
      persistent.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
