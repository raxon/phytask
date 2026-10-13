import { patients } from '@rep-counter/demo-data/patients';
import { fixtures } from '@rep-counter/demo-data/fixtures';
import { createSessionService } from './application/session-service';
import { createSignalStreamService } from './application/signal-stream-service';
import { openDatabase } from './infrastructure/sqlite/database';
import { createSqliteSessionRepository } from './infrastructure/sqlite/session-repository';
import { createStaticTokenAuthenticator } from './infrastructure/auth/static-token-authenticator';
import { createSignalFixtureRepository } from './infrastructure/signal/fixture-repository';
import { createIntervalScheduler } from './infrastructure/signal/interval-scheduler';
import { createHttpApp } from './presentation/http/app';

/** Concrete adapters are wired here; HTTP handlers and use cases depend on ports. */
export function createApiApplication(options: { databasePath: string; staticDirectory?: string }) {
  const database = openDatabase(options.databasePath);
  const repository = createSqliteSessionRepository(database);
  const sessions = createSessionService(repository);
  const signals = createSignalStreamService(
    createSignalFixtureRepository(fixtures),
    createIntervalScheduler(),
  );
  const authenticator = createStaticTokenAuthenticator(
    Object.entries(patients).map(([patientId, patient]) => ({ patientId, token: patient.token })),
  );
  const app = createHttpApp({
    sessions,
    authenticator,
    signals,
    staticDirectory: options.staticDirectory,
  });
  return {
    app,
    close: () => {
      signals.close();
      database.close();
    },
  };
}
