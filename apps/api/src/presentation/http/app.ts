import express from 'express';
import { resolve } from 'node:path';
import type { SessionUseCases } from '../../application/session-service';
import type { TokenAuthenticator } from '../../application/ports/token-authenticator';
import { authenticate } from './middleware/authenticate';
import { errorHandler } from './middleware/error-handler';
import { createSessionRoutes } from './routes/session-routes';
import { sendError } from './errors';

interface HttpDependencies {
  sessions: SessionUseCases;
  authenticator: TokenAuthenticator;
  staticDirectory?: string;
}

export function createHttpApp({ sessions, authenticator, staticDirectory }: HttpDependencies) {
  const app = express();
  app.disable('x-powered-by');
  app.use('/sessions', authenticate(authenticator));
  app.use(express.json({ limit: '16kb' }));
  app.use('/sessions', createSessionRoutes(sessions));
  if (staticDirectory) {
    app.use(express.static(staticDirectory));
    app.get('/history', (_req, res) => res.sendFile(resolve(staticDirectory, 'index.html')));
  }
  app.use((_req, res) => sendError(res, 404, 'NOT_FOUND', 'This endpoint does not exist.'));
  app.use(errorHandler);
  return app;
}
