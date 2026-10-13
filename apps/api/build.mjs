import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
await build({
  absWorkingDir: root,
  entryPoints: ['apps/api/src/main.ts'],
  outfile: 'apps/api/dist/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  external: ['express'],
  sourcemap: true,
});
