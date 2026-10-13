import { Router } from 'express';
import { parseSession } from '@rep-counter/contracts/session';
import type { SessionUseCases } from '../../../application/session-service';
import { sendError } from '../errors';

export function createSessionRoutes(sessions: SessionUseCases): Router {
  const router = Router();
  router.get('/', (_req, res) => res.json(sessions.list(res.locals.patientId)));
  router.post('/', (req, res) => {
    const result = parseSession(req.body);
    if (!result) {
      sendError(
        res,
        400,
        'INVALID_SESSION',
        'Send sessionId, non-negative reps and durationSec, and a valid performedAt date with a timezone.',
      );
      return;
    }
    const saved = sessions.save(res.locals.patientId, result);
    if (saved.status === 'conflict') {
      sendError(res, 409, 'SESSION_CONFLICT', 'This session ID already has a different result.');
      return;
    }
    res.status(saved.status === 'created' ? 201 : 200).json(saved.result);
  });
  return router;
}
