import { fileURLToPath } from 'node:url';
import { createApiApplication } from './composition-root';
import { readRuntimeConfig } from './config/runtime';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const config = readRuntimeConfig(root, process.env);
const application = createApiApplication(config);
const server = application.app.listen(config.port, '127.0.0.1', () => {
  console.log(`Rep Counter is ready at http://localhost:${config.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () =>
    server.close(() => {
      application.close();
      process.exit(0);
    }),
  );
}
