import express from 'express';
import { resolve } from 'node:path';
import type { SessionUseCases } from '../../application/session-service';
import type { TokenAuthenticator } from '../../application/ports/token-authenticator';
import type { SignalStreamUseCases } from '../../application/signal-stream-service';
import { authenticate } from './middleware/authenticate';
import { errorHandler } from './middleware/error-handler';
import { createSessionRoutes } from './routes/session-routes';
import { createSignalStreamRoutes } from './routes/signal-stream-routes';
import { sendError } from './errors';

interface HttpDependencies {
  sessions: SessionUseCases;
  authenticator: TokenAuthenticator;
  signals: SignalStreamUseCases;
  staticDirectory?: string;
}

export function createHttpApp({
  sessions,
  authenticator,
  signals,
  staticDirectory,
}: HttpDependencies) {
  const app = express();
  app.disable('x-powered-by');
  app.use('/sessions', authenticate(authenticator));
  app.use('/signal-stream', authenticate(authenticator));
  app.use(express.json({ limit: '16kb' }));
  app.use('/sessions', createSessionRoutes(sessions));
  app.use('/signal-stream', createSignalStreamRoutes(signals));
  if (staticDirectory) {
    app.use(express.static(staticDirectory));
    app.get('/history', (_req, res) => res.sendFile(resolve(staticDirectory, 'index.html')));
  }
  app.use((_req, res) => sendError(res, 404, 'NOT_FOUND', 'This endpoint does not exist.'));
  app.use(errorHandler);
  return app;
}
