import type { RequestHandler } from 'express';
import type { TokenAuthenticator } from '../../../application/ports/token-authenticator';
import { sendError } from '../errors';

export function authenticate(authenticator: TokenAuthenticator): RequestHandler {
  return (req, res, next) => {
    const token = req.header('authorization')?.match(/^Bearer ([^\s]+)$/)?.[1];
    const patientId = token ? authenticator.patientForToken(token) : null;
    if (!patientId) {
      sendError(res, 401, 'UNAUTHORIZED', 'A valid patient token is required.');
      return;
    }
    res.locals.patientId = patientId;
    res.set('Cache-Control', 'no-store');
    next();
  };
}
