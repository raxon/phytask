import type { Response } from 'express';
import type { ApiError } from '@rep-counter/contracts/errors';

export function sendError(response: Response, status: number, code: string, message: string): void {
  response.status(status).json({ error: { code, message } } satisfies ApiError);
}
