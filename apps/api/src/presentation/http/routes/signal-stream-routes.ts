import { Router } from 'express';
import type { PlaybackSpeed } from '@rep-counter/contracts/signal';
import type { SignalStreamUseCases } from '../../../application/signal-stream-service';
import { sendError } from '../errors';

export function createSignalStreamRoutes(signals: SignalStreamUseCases): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const fixtureId = req.query.fixture;
    const speedValue = req.query.speed ?? '1';
    const fromValue = req.query.from ?? '0';
    if (
      typeof fixtureId !== 'string' ||
      typeof speedValue !== 'string' ||
      !['1', '4', '8'].includes(speedValue) ||
      typeof fromValue !== 'string' ||
      !/^\d+$/.test(fromValue) ||
      Object.keys(req.query).some((key) => !['fixture', 'speed', 'from'].includes(key))
    ) {
      sendError(
        res,
        400,
        'INVALID_SIGNAL',
        'Send a fixture, speed of 1, 4 or 8, and a non-negative integer from index.',
      );
      return;
    }

    const signal = signals.prepare({
      fixtureId,
      speed: Number(speedValue) as PlaybackSpeed,
      from: Number(fromValue),
    });
    if (signal.status === 'not-found') {
      sendError(res, 404, 'SIGNAL_NOT_FOUND', 'This signal fixture does not exist.');
      return;
    }
    if (signal.status === 'invalid') {
      sendError(res, 400, 'INVALID_SIGNAL', 'The from index must be within this fixture.');
      return;
    }

    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    let cancel = () => {};
    let disconnected = false;
    const stop = () => {
      disconnected = true;
      cancel();
    };
    // IncomingMessage can close after its request body ends while SSE is still active.
    res.once('close', stop);
    cancel = signal.start({
      metadata: (value) => res.write(`event: meta\ndata: ${JSON.stringify(value)}\n\n`),
      sample: (value) => res.write(`event: sample\ndata: ${JSON.stringify(value)}\n\n`),
      complete: (value) => {
        res.write(`event: complete\ndata: ${JSON.stringify(value)}\n\n`);
        res.end();
      },
    });
    if (disconnected) cancel();
  });

  return router;
}
