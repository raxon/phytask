import type { ErrorRequestHandler } from 'express';
import { sendError } from '../errors';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = typeof err.status === 'number' ? err.status : 500;
  if (status === 400) sendError(res, 400, 'INVALID_JSON', 'The request body must be valid JSON.');
  else if (status === 413) sendError(res, 413, 'BODY_TOO_LARGE', 'Send only the session result.');
  else {
    console.error(err);
    sendError(res, 500, 'INTERNAL_ERROR', 'The session could not be processed. Try again.');
  }
};
