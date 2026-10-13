# Rep Counter

Choose a knee-angle recording, start a simulated live session, and watch the repetition count grow as samples arrive. The browser counts the movement. At the end of the signal, or when you click **Finish session**, it saves the result to the local Express API.

The demo includes two patients, three recordings, JSON import, a live SVG chart, and a squat illustration driven by the latest knee angle. Saved sessions have their own page at `/history`.

## Run locally

Use Node.js **22.13 or later** with npm, then run the startup script from the repository root:

```sh
npm start
```

Open [http://localhost:3000](http://localhost:3000). The startup script installs locked dependencies when needed, builds both apps, and starts Express, which serves the API and frontend together. Initial installation needs registry access.

Stop it with `Ctrl+C`. The SQLite file remains in `data/sessions.sqlite`, so saved history survives a restart.

For development:

```sh
npm ci
npm run dev
```

Express listens on port 3000. Vite prints its frontend URL, normally [http://localhost:5173](http://localhost:5173), and proxies `/sessions` and `/signal-stream` to Express. Vite refreshes frontend edits. API edits restart automatically through `tsx watch`.

## Try a session

Select **Clean signal**, **Noisy signal**, or **Shallow squats**, choose a playback speed, and click **Start session**. Counting starts at zero.

Built-in recordings arrive from the local `/signal-stream` endpoint as Server-Sent Events. A JSON import replays inside the browser. Both sources feed the same counter, and only received samples appear on the chart or affect the result.

An interrupted stream exposes **Resume signal**. The session keeps its identifier and resumes from the next missing sample. You can also finish early, which saves the received portion and leaves an unfinished squat uncounted.

Saving is automatic. If a save fails, use **Retry save**, including after a page reload. The browser keeps one pending result per patient before sending the request, and an identical retry uses the original identifier, timestamp, repetition count, and duration.

Patient and source changes stay disabled during a running or interrupted session, then switching patients clears the workspace while keeping each patient's pending save and history separate.

## Data and counting rules

A repetition requires an angle **below 100 degrees**, followed later by an angle **above 160 degrees**, after which repeated samples at the standing position leave the count unchanged until another complete cycle.

The thresholds are strict. Exactly 100 or 160 degrees does not cross a threshold. The counter applies no smoothing, and `expectedReps` only checks the result against a fixture's expected value.

| Recording                                                          | Samples | Sample rate | Complete reps | Duration |
| ------------------------------------------------------------------ | ------: | ----------: | ------------: | -------: |
| [Clean signal](packages/demo-data/fixtures/session-clean.json)     |   1,088 |       30 Hz |            10 |  36.27 s |
| [Noisy signal](packages/demo-data/fixtures/session-noisy.json)     |     828 |       30 Hz |             8 |  27.60 s |
| [Shallow squats](packages/demo-data/fixtures/session-shallow.json) |   1,080 |       30 Hz |             7 |  36.00 s |

Duration is `receivedSamples / sampleRateHz`. Playback at 4x or 8x shortens the wait without changing the recorded duration.

Import a JSON file with finite numeric angles and a positive, finite sample rate:

```json
{
  "angles": [175, 99, 160, 161],
  "sampleRateHz": 30,
  "description": "One completed squat",
  "expectedReps": 1
}
```

`description` and `expectedReps` are optional. Angles above 180 degrees are accepted because the supplied noisy recording contains them. The illustration alone clamps its display to 0-180 degrees.

## API and demo patients

Every API request requires `Authorization: Bearer <token>`. The server maps the token to a patient, so a session request never accepts a client-supplied patient identifier.

| Patient      | ID      | Demo token         |
| ------------ | ------- | ------------------ |
| Alex Morgan  | `alex`  | `demo-alex-token`  |
| Jamie Taylor | `jamie` | `demo-jamie-token` |

| Endpoint                                          | Purpose                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------ |
| `GET /signal-stream?fixture=clean&speed=1&from=0` | Replay a built-in recording with `meta`, `sample`, and `complete` events |
| `POST /sessions`                                  | Store `{ sessionId, reps, durationSec, performedAt }`                    |
| `GET /sessions`                                   | Return the authenticated patient's results, newest first                 |

The first save returns `201`. An identical retry returns `200`, and changing the result under an existing session identifier returns `409`. SQLite enforces `(patientId, sessionId)` uniqueness.

See [the API reference](docs/API.md) for validation, errors, and runnable examples.

## Repository and checks

The project uses npm workspaces. `apps/api` contains Express and SQLite adapters, `apps/web` contains React, Redux Toolkit, RTK Query, and Tailwind CSS, and `packages` contains shared contracts, counting logic, demo data, and configuration.

```sh
npm run check
npx playwright install chromium
npm run test:e2e
```

`check` runs formatting checks, TypeScript, ESLint, Vitest, and the build. Browser tests have a separate command that builds the apps first and starts them on port 3001 with an isolated in-memory database.

Run `npm run format` to apply Prettier. For installation and startup in a fresh temporary directory, run `node scripts/smoke-start.mjs`.

## Scope and limitations

This is a local recruitment demo. The fixed tokens are public examples, and the server trusts the repetition count submitted by the browser. Production use would need real authentication and a separate decision about validating measurements.

The signal endpoint replays supplied recordings. Connecting a real sensor requires another signal adapter with the same sample order and completion rules. The avatar is a stylized view of one knee angle, with fixed segment lengths and an estimated torso position.

Only finished pending results survive a page reload. Pending storage holds the result and its owner, with no angles or tokens, while an active session lives in memory and is lost if you reload during playback.

Use a browser with streaming `fetch`, Web Locks, `crypto.randomUUID`, and writable `localStorage`, served from the default localhost address or another secure context. History has no pagination. Large imports stay in memory.

## Documentation

| Document                             | Contents                                                                                  |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| [Architecture](docs/ARCHITECTURE.md) | Workspace boundaries, SOLID decisions, live data flow, save ownership, and pose rendering |
| [API](docs/API.md)                   | Endpoint contracts, validation, SSE events, errors, and examples                          |
| [Development](docs/DEVELOPMENT.md)   | Commands, configuration, tests, troubleshooting, and verified AI-assisted corrections     |
| [Skills and MCP](docs/TOOLS.md)      | Assistant tools used for this project and the available environment catalog               |
