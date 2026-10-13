import type { ApiError } from '@rep-counter/contracts/errors';

export function errorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data = error.data as ApiError | undefined;
    if (typeof data?.error?.message === 'string') return data.error.message;
  }
  return 'The server did not confirm the save. Your result is kept on this device. Retry when the connection is back.';
}
