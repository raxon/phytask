import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { AddressInfo } from 'node:net';
import { fixtures } from '@rep-counter/demo-data/fixtures';
import { createApiApplication } from '../../src/composition-root';
import { createSignalStreamService } from '../../src/application/signal-stream-service';
import { createHttpApp } from '../../src/presentation/http/app';

const authorization = 'Bearer demo-alex-token';
let application: ReturnType<typeof createApiApplication>;

beforeEach(() => {
  application = createApiApplication({ databasePath: ':memory:' });
});
afterEach(() => application.close());

function decodeEvents(text: string): { event: string; data: unknown }[] {
  return text
    .trim()
    .split('\n\n')
    .map((message) => {
      const [event, data] = message.split('\n');
      if (!event || !data) throw new Error('Expected an SSE event with JSON data');
      return {
        event: event.slice('event: '.length),
        data: JSON.parse(data.slice('data: '.length)),
      };
    });
}

describe('authenticated signal stream API', () => {
  it.each([undefined, 'Bearer wrong-token', 'Basic demo-alex-token'])(
    'requires valid Bearer authorization %s',
    async (token) => {
      const req = request(application.app).get('/signal-stream?fixture=clean');
      if (token) req.set('Authorization', token);
      const response = await req;
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    },
  );

  it('does not accept a bearer token in the URL', async () => {
    const response = await request(application.app).get(
      '/signal-stream?fixture=clean&token=demo-alex-token',
    );
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it.each([
    '',
    '?fixture=clean&speed=2',
    '?fixture=clean&speed=0',
    '?fixture=clean&speed=4&speed=8',
    '?fixture=clean&from=-1',
    '?fixture=clean&from=1.5',
    '?fixture=clean&from=NaN',
    '?fixture=clean&from=999999999999999999999',
    `?fixture=clean&from=${fixtures.clean.angles.length + 1}`,
    '?fixture=clean&from=1&from=2',
    '?fixture=clean&other=1',
  ])('rejects invalid playback parameters %s as JSON before opening SSE', async (query) => {
    const response = await request(application.app)
      .get(`/signal-stream${query}`)
      .set('Authorization', authorization);
    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body.error.code).toBe('INVALID_SIGNAL');
  });

  it.each(['missing', 'toString', '__proto__'])(
    'returns 404 for unknown fixture %s',
    async (fixture) => {
      const response = await request(application.app)
        .get('/signal-stream')
        .query({ fixture })
        .set('Authorization', authorization);
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('SIGNAL_NOT_FOUND');
    },
  );

  it.each(['clean', 'noisy', 'shallow'] as const)(
    'streams the final samples of %s without saving a session',
    async (fixtureId) => {
      const fixture = fixtures[fixtureId];
      const from = fixture.angles.length - 2;
      const response = await request(application.app)
        .get('/signal-stream')
        .query({ fixture: fixtureId, speed: 8, from })
        .set('Authorization', authorization);
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/text\/event-stream/);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(decodeEvents(response.text)).toEqual([
        {
          event: 'meta',
          data: { sampleRateHz: fixture.sampleRateHz, totalSamples: fixture.angles.length },
        },
        { event: 'sample', data: { index: from, angle: fixture.angles[from] } },
        { event: 'sample', data: { index: from + 1, angle: fixture.angles[from + 1] } },
        { event: 'complete', data: { totalSamples: fixture.angles.length } },
      ]);
      expect(
        (await request(application.app).get('/sessions').set('Authorization', authorization)).body,
      ).toEqual([]);
    },
  );

  it('defaults to normal speed and completes an already consumed fixture', async () => {
    const response = await request(application.app)
      .get('/signal-stream')
      .query({ fixture: 'clean', from: fixtures.clean.angles.length })
      .set('Authorization', authorization);
    expect(decodeEvents(response.text)).toEqual([
      {
        event: 'meta',
        data: {
          sampleRateHz: fixtures.clean.sampleRateHz,
          totalSamples: fixtures.clean.angles.length,
        },
      },
      { event: 'complete', data: { totalSamples: fixtures.clean.angles.length } },
    ]);
  });

  it('cancels playback when the client closes the response connection', async () => {
    const releaseTimer = vi.fn();
    const schedule = vi.fn(() => releaseTimer);
    const signals = createSignalStreamService(
      { getById: () => ({ angles: [90, 170], sampleRateHz: 30 }) },
      { repeat: schedule },
    );
    const app = createHttpApp({
      signals,
      sessions: { list: () => [], save: () => ({ status: 'conflict' }) },
      authenticator: { patientForToken: (token) => (token === 'demo-alex-token' ? 'alex' : null) },
    });
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const controller = new AbortController();
    try {
      const { port } = server.address() as AddressInfo;
      const response = await fetch(`http://127.0.0.1:${port}/signal-stream?fixture=clean`, {
        headers: { Authorization: authorization },
        signal: controller.signal,
      });
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Expected an SSE response body');
      expect(new TextDecoder().decode((await reader.read()).value)).toContain('event: meta');
      expect(schedule).toHaveBeenCalledOnce();
      expect(releaseTimer).not.toHaveBeenCalled();
      controller.abort();
      await vi.waitFor(() => expect(releaseTimer).toHaveBeenCalledOnce());
    } finally {
      controller.abort();
      signals.close();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
