# Architecture

Rep Counter separates the counter from transport, storage, and rendering. The same state machine counts a complete fixture in a unit test and advances one sample at a time during a live browser session.

## Workspace layout

```text
apps/
  api/src/
    application/           # Use cases and ports
    infrastructure/        # SQLite, demo auth, fixtures, scheduler
    presentation/http/     # Express routes and middleware
    composition-root.ts    # Concrete API dependencies
  web/src/
    app/                   # Router, providers, store, browser dependencies
    features/
      workspace/
        application/       # Session commands and ports
        model/             # State, selectors, counter input, pose geometry
        infrastructure/    # Streaming, pending storage, RTK writer
        components/        # Simulator controls, result, chart, avatar
      sessions/            # RTK Query, history page and table
      patients/            # Patient picker
    shared/                # Reusable UI and error helpers
packages/
  contracts/               # DTOs and runtime parsers
  domain/                  # Repetition state machine
  demo-data/               # Three local JSON fixtures and demo profiles
  config/                  # Shared TypeScript and ESLint configuration
scripts/                   # Start and clean-directory smoke scripts
tests/e2e/                 # Playwright journeys
```

Each workspace has its own manifest. Root npm scripts coordinate checks and builds, and workspace imports use the `@rep-counter/*` package names.

## Ports and SOLID

The API's [composition root](../apps/api/src/composition-root.ts) opens SQLite and supplies repository, authentication, fixture, and scheduler adapters. HTTP handlers call application services. They never open the database.

On the frontend, [bootstrap](../apps/web/src/app/bootstrap.ts) connects Redux state to the signal source, pending storage, and result writer. The [workspace commands](../apps/web/src/features/workspace/application/commands.ts) receive these dependencies as ports, so unit tests can supply fake streams and controlled promises without mounting React.

| Principle             | Decision in this code                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Single responsibility | The counter handles threshold transitions, the signal adapter delivers samples, and the session repository stores results                        |
| Open/closed           | A new sensor can implement the signal port while leaving the command flow and counter in place                                                   |
| Liskov substitution   | Signal and repository adapters must preserve their port's sequencing, completion, and result behavior, as exercised by service and adapter tests |
| Interface segregation | Ports expose the operations their callers need, such as subscribing to samples or saving one result                                              |
| Dependency inversion  | Application services receive interfaces, and the composition roots choose Express, SQLite, browser APIs, and RTK Query                           |

These are functional modules. Small interfaces describe the dependencies, and composition roots supply concrete implementations.

[ESLint boundary rules](../packages/config/eslint.config.js) reject framework imports in the shared domain and contracts. They also block Express and Node adapters in API use cases and keep React components and browser infrastructure out of workspace model and command modules.

## Live session flow

Selecting a source prepares a recording. It does not count it. **Start session** creates one `sessionId` and `performedAt`, clears the received-angle buffer, and opens a stream owned by that patient and session.

Built-in sources use authenticated streaming `fetch` against `/signal-stream`, with adapters that deliver `{ index, angle }` samples and report completion or interruption. Imports use a browser timer.

The browser accepts the next expected index only. A finite sample advances the counter, enters the received buffer, and changes duration to `buffer.length / sampleRateHz`. The source's future samples never enter the result ahead of delivery.

```text
Local SSE endpoint or imported JSON timer
  -> signal port: ordered samples
  -> workspace command: ownership and index checks
  -> Redux reducer: received buffer and repetition state
  -> selectors: result, current angle, progress
  -> React: chart, numeric result, squat pose
```

The playback multiplier affects delivery cadence. Recorded time stays sample-based. The SVG chart uses the full recording's time axis while drawing only its received prefix, which keeps the viewport stable as a session advances.

An unexpected index, invalid sample, or early stream end interrupts the session. **Resume signal** requests the next sample using the received buffer length, preserving the accumulated counter, original identifier, and start time. **Finish session** saves that prefix.

Natural completion checks the received length before saving. The browser sends the finished result through a separate POST, and the backend's SSE completion event carries no database action.

## Counter and illustration

The [domain state machine](../packages/domain/src/repetitions.ts) sets `awaitingExtension` below 100 degrees, then increments its repetition count and clears the flag when a later sample exceeds 160 degrees.

There is no smoothing. Pauses and repeated readings do not add reps by themselves, and an unfinished movement keeps the count unchanged. [Domain tests](../packages/domain/tests/counter.test.ts) cover exact boundaries and all three supplied fixtures.

The chart and avatar read the latest received angle from the same analysis. [Pose geometry](../apps/web/src/features/workspace/model/squat-pose.ts) fixes the ankle and calculates the knee and hip positions so that the drawn knee angle matches its input. The torso lean is an illustration choice.

Angles outside 0-180 degrees clamp for drawing only. The stored samples and counting input retain their original values, including noisy readings above 180. Before the first sample, the avatar stands at 180 degrees, and it keeps the last pose after a session finishes.

## Save ownership and retries

The frozen result has four fields. It contains no angles. Before POST, the pending storage adapter writes that result under its patient in `rep-counter.pending.v1`.

Web Locks serialize each read/check/write operation across tabs. The adapter reads the current durable queue inside the lock, updates one owner, and refuses a different pending result for the same patient. Removing a confirmed result also checks its session identifier.

```json
{
  "version": 1,
  "pending": {
    "alex": {
      "sessionId": "example-session",
      "reps": 1,
      "durationSec": 2,
      "performedAt": "2026-10-13T12:00:00.000Z"
    }
  }
}
```

Only a confirmed API success clears the matching pending result. If the connection drops after SQLite accepts a POST, reloading restores the retry copy and sends the same payload, which the server accepts with `200`.

Redux keys pending results, save requests, errors, and saved session identifiers by patient. A confirmation appears only in its owner's current workspace, and response handlers carry the request's original owner and identifier. Switching to Jamie while Alex's completed result is saving cannot place Alex's confirmation in Jamie's workspace.

RTK Query also keys history by patient. Its requests receive that patient's token explicitly, and mutations invalidate that patient's history tag. The picker clears imported data and analysis on a patient change while preserving pending records.

## Storage and routes

SQLite owns session uniqueness. Its primary key is `(patient_id, session_id)`, and an insert uses conflict handling before the service compares the stored payload to a retry. History reads filter by the authenticated patient and sort by performance date descending.

The database opens automatically at startup. WAL mode and a busy timeout support concurrent requests, and the API closes its database and signal timers on shutdown. There is no separate database server or migration service in this demo.

[Route modules](../apps/web/src/app/App.tsx) use `React.lazy`, with a loading fallback in the layout, for the simulator at `/` and saved results at `/history`. Navigation can leave playback running because session commands live above these modules.

Express serves both routes from the built frontend during `npm start`, while Vite provides the frontend and proxies API requests during development. All fixture files, styles, icons, and SVG artwork are part of the local repository.
