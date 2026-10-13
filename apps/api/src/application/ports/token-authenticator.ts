export interface TokenAuthenticator {
  patientForToken(token: string): string | null;
}
