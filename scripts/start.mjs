import { createHash } from 'node:crypto';
import { readFile, writeFile, access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error('Rep Counter requires Node.js 22.13 or later.');
  process.exit(1);
}

let activeChild;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => activeChild?.kill(signal));
}

function run(command, args) {
  return new Promise((resolveRun, reject) => {
    activeChild = spawn(command, args, { cwd: root, stdio: 'inherit' });
    activeChild.on('error', reject);
    activeChild.on('exit', (code, signal) => {
      if (code === 0) resolveRun();
      else reject(new Error(`${command} stopped (${signal ?? code}).`));
    });
  });
}

try {
  const lock = await readFile(resolve(root, 'package-lock.json'));
  const fingerprint = createHash('sha256').update(lock).digest('hex');
  const marker = resolve(root, 'node_modules/.rep-counter-lock');
  let installed = false;
  try {
    installed = (await readFile(marker, 'utf8')) === fingerprint;
    await access(resolve(root, 'node_modules/.bin/vite'));
    await access(resolve(root, 'node_modules/.bin/esbuild'));
  } catch {
    installed = false;
  }
  if (!installed) {
    console.log('Installing locked dependencies...');
    await run('npm', ['ci', '--include=dev', '--no-audit', '--no-fund']);
    await writeFile(marker, fingerprint);
  }
  await run('npm', ['run', 'build']);
  await run(process.execPath, ['apps/api/dist/index.js']);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
