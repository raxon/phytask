import type { TokenAuthenticator } from '../../application/ports/token-authenticator';

export function createStaticTokenAuthenticator(
  entries: readonly { patientId: string; token: string }[],
): TokenAuthenticator {
  const tokens = new Map(entries.map((entry) => [entry.token, entry.patientId]));
  return { patientForToken: (token) => tokens.get(token) ?? null };
}
