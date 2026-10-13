import { patients } from '@rep-counter/demo-data/patients';
import { createSessionService } from './application/session-service';
import { openDatabase } from './infrastructure/sqlite/database';
import { createSqliteSessionRepository } from './infrastructure/sqlite/session-repository';
import { createStaticTokenAuthenticator } from './infrastructure/auth/static-token-authenticator';
import { createHttpApp } from './presentation/http/app';

/** Concrete adapters are wired here; HTTP handlers and use cases depend on ports. */
export function createApiApplication(options: { databasePath: string; staticDirectory?: string }) {
  const database = openDatabase(options.databasePath);
  const repository = createSqliteSessionRepository(database);
  const sessions = createSessionService(repository);
  const authenticator = createStaticTokenAuthenticator(
    Object.entries(patients).map(([patientId, patient]) => ({ patientId, token: patient.token })),
  );
  const app = createHttpApp({ sessions, authenticator, staticDirectory: options.staticDirectory });
  return { app, close: () => database.close() };
}
