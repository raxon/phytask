export interface SessionResult {
  sessionId: string;
  reps: number;
  durationSec: number;
  performedAt: string;
}

export function parseSession(input: unknown): SessionResult | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  const fields = ['sessionId', 'reps', 'durationSec', 'performedAt'];
  if (
    Object.keys(value).length !== fields.length ||
    !fields.every((field) => Object.hasOwn(value, field))
  )
    return null;
  if (
    typeof value.sessionId !== 'string' ||
    value.sessionId.trim().length === 0 ||
    value.sessionId.length > 128
  )
    return null;
  if (typeof value.reps !== 'number' || !Number.isSafeInteger(value.reps) || value.reps < 0)
    return null;
  if (
    typeof value.durationSec !== 'number' ||
    !Number.isFinite(value.durationSec) ||
    value.durationSec < 0
  )
    return null;
  if (
    typeof value.performedAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value.performedAt,
    )
  )
    return null;
  const timestamp = Date.parse(value.performedAt);
  if (!Number.isFinite(timestamp)) return null;
  const [year, month, day] = value.performedAt.slice(0, 10).split('-').map(Number);
  if (
    !year ||
    !month ||
    !day ||
    month > 12 ||
    day > new Date(Date.UTC(year, month, 0)).getUTCDate()
  )
    return null;
  return {
    sessionId: value.sessionId,
    reps: value.reps,
    durationSec: value.durationSec,
    performedAt: new Date(timestamp).toISOString(),
  };
}
