import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const clean = await mkdtemp(join(tmpdir(), 'rep-counter-start-'));
let child;
let output = '';
try {
  for (const entry of ['package.json', 'package-lock.json', 'scripts', 'apps', 'packages']) {
    await cp(resolve(root, entry), join(clean, entry), {
      recursive: true,
      filter: (source) =>
        !source.split(sep).includes('dist') && !source.split(sep).includes('node_modules'),
    });
  }
  child = spawn('npm', ['start'], {
    cwd: clean,
    detached: true,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      REP_COUNTER_PORT: '3002',
      REP_COUNTER_DB: join(clean, 'data/sessions.sqlite'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => {
    output += chunk;
    process.stdout.write(chunk);
  });
  child.stderr.on('data', (chunk) => {
    output += chunk;
    process.stderr.write(chunk);
  });
  const deadline = Date.now() + 120000;
  let ready = false;
  while (Date.now() < deadline && child.exitCode === null) {
    try {
      const response = await fetch('http://127.0.0.1:3002');
      if (response.ok && (await response.text()).includes('Rep Counter')) {
        ready = true;
        break;
      }
    } catch {
      /* Wait until dependency installation and the build are complete. */
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  if (!ready) throw new Error(`Clean startup failed.\n${output}`);
  const auth = await fetch('http://127.0.0.1:3002/sessions');
  if (auth.status !== 401) throw new Error('The clean server did not require authentication.');
  const history = await fetch('http://127.0.0.1:3002/sessions', {
    headers: { authorization: 'Bearer demo-alex-token' },
  });
  if (!history.ok || JSON.stringify(await history.json()) !== '[]')
    throw new Error('The clean database is not empty.');
  console.log('Clean-copy npm start: PASS');
} finally {
  if (child?.pid && child.exitCode === null) {
    process.kill(-child.pid, 'SIGTERM');
    await new Promise((resolveExit) => child.on('exit', resolveExit));
  }
  await rm(clean, { recursive: true, force: true });
}
