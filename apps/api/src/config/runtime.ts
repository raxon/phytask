import { resolve } from 'node:path';

export function readRuntimeConfig(root: string, environment: NodeJS.ProcessEnv) {
  return {
    databasePath: environment.REP_COUNTER_DB ?? resolve(root, 'data/sessions.sqlite'),
    port: Number(environment.REP_COUNTER_PORT ?? 3000),
    staticDirectory: resolve(root, 'apps/web/dist'),
  };
}
