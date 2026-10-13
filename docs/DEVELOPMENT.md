# Development

Use Node.js 22.13 or later. The project uses npm workspaces and built-in `node:sqlite`, with React and Redux Toolkit in `apps/web` and Express in `apps/api`.

## Run locally

From the repository root, run `npm start`. The bootstrap checks the Node version, installs locked dependencies when its lockfile fingerprint changes, builds the workspaces and starts Express at `http://localhost:3000` with the frontend served from `apps/web/dist`.

For development, install dependencies first.

```sh
npm ci
npm run dev
```

Vite defaults to `http://127.0.0.1:5173` and may choose the next free port when that address is busy, so use the URL printed at startup while `tsx watch` restarts the API on source changes. Both `/sessions` and `/signal-stream` are proxied to `http://127.0.0.1:3000`.

Open the Vite address. Running `npm start` and `npm run dev` together would put both API processes on port `3000`, so stop the existing process before switching modes.

## Commands and test scope

The root commands come from [package.json](../package.json). `npm run check` runs formatting, typechecking, ESLint, Vitest and the build in that order, stopping at the first failure.

| Command                        | Scope                                                                              |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| `npm run format`               | Rewrite supported project files with Prettier.                                     |
| `npm run format:check`         | Check formatting without editing.                                                  |
| `npm run typecheck`            | Workspace source/tests, plus root tooling and E2E types.                           |
| `npm run lint`                 | Root ESLint rules, React hooks and import boundaries.                              |
| `npm test`                     | Vitest tests under `apps/*/tests` and `packages/*/tests`.                          |
| `npm run build`                | Workspace build scripts: bundled API and Vite frontend.                            |
| `npm run test:e2e`             | Build first, then run Playwright from `tests/e2e`.                                 |
| `node scripts/smoke-start.mjs` | Start a clean temporary copy, check the page and API authorization, then clean up. |

Install Chromium before E2E tests.

```sh
npx playwright install chromium
npm run test:e2e
```

Playwright uses one worker and starts its own API at `http://127.0.0.1:3001` with an in-memory database. Port `3001` must be free. Failed tests retain traces, and the clean-start script uses port `3002` while checking dependency installation from a directory without `node_modules` or built output.

Run narrower tests when editing one layer.

```sh
npm run test --workspace @rep-counter/api
npm run test --workspace @rep-counter/web
npm run test --workspace @rep-counter/domain
```

API tests cover authentication, owner isolation, input validation and concurrent idempotent POSTs. The stream suite checks resume indices and response-disconnect cleanup, while browser tests cover live counting, imports, automatic saves, late responses, reload retries and concurrent tabs.

## Runtime settings and SQLite

Pass settings as environment variables. The runtime reads `process.env` directly, so `.env` files require a separate loader or shell setup.

| Variable           | Default                             | Use                                                  |
| ------------------ | ----------------------------------- | ---------------------------------------------------- |
| `REP_COUNTER_PORT` | `3000`                              | Express port on `127.0.0.1`.                         |
| `REP_COUNTER_DB`   | `<repository>/data/sessions.sqlite` | Database filename, or `:memory:` for temporary data. |

```sh
REP_COUNTER_PORT=3005 REP_COUNTER_DB=:memory: npm start
```

The [runtime config](../apps/api/src/config/runtime.ts) sets the frontend directory to `apps/web/dist`. If you change the API port in development, also change the target in [vite.config.ts](../apps/web/vite.config.ts), which currently points to `3000`.

SQLite creates its directory automatically. The database uses WAL mode and a five-second busy timeout, and stored results survive a restart when `REP_COUNTER_DB` points to a file instead of `:memory:`.

The database and its sidecar files are ignored by Git under `data/`. To reset local results, stop the server and remove `data/sessions.sqlite` plus its `-wal` and `-shm` files if present.

## Corrections found during AI-assisted work

A POST can succeed while its response disappears. Changing patients at that point must preserve the result's original owner, and retrying after a reload must reuse the same `sessionId`, timestamp, count and duration so the API returns the existing row.

The current commands store a frozen result before POST, while reducers and RTK Query keep responses attached to the owner captured when the request started. A successful acknowledgement removes only that session's retry copy.

The regression test in [workspace.spec.ts](../tests/e2e/workspace.spec.ts) lets the server accept the first POST, drops its response, switches from Alex to Jamie and back, reloads, then verifies an identical retry returns `200` with one history row added.

Two tabs exposed another race. Reading localStorage before changing one patient preserved other entries during sequential writes, but simultaneous read/check/write operations could still overwrite a pending result or claim the same patient's retry slot.

The fix uses `navigator.locks.request` at the shared key `rep-counter.pending.v1`, making the storage check and write one critical section across tabs. The network request runs after that lock is released.

See the [storage adapter](../apps/web/src/features/workspace/infrastructure/pending-results-storage.ts) and [browser wiring](../apps/web/src/app/bootstrap.ts). The two-tab E2E tests hold that lock while both sessions finish, then release it and check that different patients keep both results, while the same patient permits one POST and preserves the first retry copy.

The avatar also stayed crouched after standing samples. It now takes the latest received `currentAngle`, keeping the ankle planted while [squat-pose.ts](../apps/web/src/features/workspace/model/squat-pose.ts) calculates the knee geometry and retains that pose after completion.

Clamping affects the drawing only. [Geometry tests](../apps/web/tests/model/squat-pose.test.ts) measure the internal knee angle and check the `0` to `180` display range, while the live E2E test measures the rendered SVG and verifies the final pose stays visible after "Finish session".

## Troubleshooting and current limits

Use a current localhost browser. The save flow needs localStorage, Web Locks and `crypto.randomUUID`, and it blocks POST when a durable retry copy cannot be written.

If "Retry save" remains visible, keep that result until the server confirms it. A competing result from another tab requires reloading to load the durable pending entry before retrying, and API conflicts return `409` without replacing the saved result.

An interrupted stream can resume from the next received sample or finish with its current prefix. Reloading an active session loses its in-memory samples. Only completed results waiting for a POST acknowledgement survive reload, and one pending result is allowed per patient and browser origin.

History navigation keeps the session running. The patient selector remains disabled through active or interrupted playback, while imported recordings replay locally and accelerated playback changes wall time without changing the sample rate used to calculate duration.

The two tokens are public demo credentials, and the server trusts client-calculated counts. Built-in signals come from local fixtures through SSE. A production sensor integration, real authentication, server-side count verification and pagination are outside the current demo.

Node may print an experimental warning for `node:sqlite`. If startup reports `EADDRINUSE`, stop the process using the required port or choose `REP_COUNTER_PORT` and update the dev proxy where needed.
