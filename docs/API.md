# API and signal format

Start with `npm start`. The examples below use `http://localhost:3000`, where Express serves the frontend alongside the result API and the timed fixture stream, so curl and the browser reach the same local process.

## Authentication

The token selects the patient. Send `Authorization: Bearer <token>` on every request to `/sessions` and `/signal-stream`, because the server uses that header to choose whose history to return and who owns a submitted result.

| Patient      | Demo token         |
| ------------ | ------------------ |
| Alex Morgan  | `demo-alex-token`  |
| Jamie Taylor | `demo-jamie-token` |

Both values are public and have no expiry or login flow, as defined in [patients.ts](../packages/demo-data/src/patients.ts). Use the request header. Query strings and session payloads must omit credentials.

## Session results

`GET /sessions` returns a JSON array belonging to the authenticated patient. Results are sorted by `performedAt` descending, with `sessionId` ascending when timestamps match, so an identical retry leaves the original entry in its existing position.

```sh
curl -i http://localhost:3000/sessions \
  -H 'Authorization: Bearer demo-alex-token'
```

An empty history is `[]`. Use `POST /sessions` to submit the four fields below, with no angles or patient identifier, and send the JSON content type so the server can parse the request body.

```sh
curl -i http://localhost:3000/sessions \
  -H 'Authorization: Bearer demo-alex-token' \
  -H 'Content-Type: application/json' \
  --data '{"sessionId":"curl-demo-1","reps":1,"durationSec":0.1,"performedAt":"2026-10-13T10:00:00.000Z"}'
```

| Field         | Validation                                                                                                                                            |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sessionId`   | A string with at least one non-whitespace character, at most 128 characters. The original value is preserved.                                         |
| `reps`        | A non-negative safe integer.                                                                                                                          |
| `durationSec` | A non-negative finite number.                                                                                                                         |
| `performedAt` | A valid calendar date and time with seconds, optional 1-3 fractional digits, and `Z` or an explicit `+HH:MM`/`-HH:MM` offset. Stored as UTC ISO text. |

Keep this payload for retries. SQLite uses `(patient_id, session_id)` as its primary key, and an atomic insert handles simultaneous requests without allowing two rows for the same patient's session.

| Situation                                          | Status | Response                                               |
| -------------------------------------------------- | ------ | ------------------------------------------------------ |
| First accepted result                              | `201`  | The normalized result object.                          |
| Same ID and equivalent result                      | `200`  | The existing result object.                            |
| Same ID with different reps, duration or timestamp | `409`  | `SESSION_CONFLICT`. The stored result stays unchanged. |

Equivalent timezone timestamps compare equally. Alex and Jamie can each use the same `sessionId`, since the duplicate check is scoped to the patient determined by the token, as covered by the [HTTP tests](../apps/api/tests/http/sessions.test.ts).

The field checks live in [session validation](../packages/contracts/src/session.ts). The [repository](../apps/api/src/infrastructure/sqlite/session-repository.ts) performs the insert and returns the stored row for comparison.

Results survive server restarts with the default `data/sessions.sqlite` database file, and `REP_COUNTER_DB` changes the database location or selects in-memory storage, as described in [DEVELOPMENT.md](DEVELOPMENT.md#runtime-settings-and-sqlite).

## Live fixture stream

`GET /signal-stream` returns `text/event-stream` over an authenticated request, so use the same Bearer header as the result API. The response stays open during playback.

| Query     | Accepted values                                                                              |
| --------- | -------------------------------------------------------------------------------------------- |
| `fixture` | Required: `clean`, `noisy` or `shallow`. Unknown names return `404`.                         |
| `speed`   | `1`, `4` or `8`. Defaults to `1`.                                                            |
| `from`    | A non-negative safe integer from `0` through the fixture length, inclusive. Defaults to `0`. |

`from` selects the next sample. Repeated query keys and extra keys return JSON `400` before SSE headers are sent, and the route applies the same response to unsupported speeds or indices outside the chosen recording.

```sh
curl -N 'http://localhost:3000/signal-stream?fixture=clean&speed=8&from=0' \
  -H 'Authorization: Bearer demo-alex-token'
```

The clean recording contains 1,088 samples at 30 Hz. Each response begins with `meta`, streams individual `sample` events whose indices refer to the original recording, then emits `complete` after the last remaining sample.

```text
event: meta
data: {"sampleRateHz":30,"totalSamples":1088}

event: sample
data: {"index":0,"angle":171.2}

...

event: complete
data: {"totalSamples":1088}
```

Speed changes playback time. The interval is `1000 / (sampleRateHz * speed)` milliseconds, and the first sample waits one interval while metadata continues to report the original recording's sample rate and total length.

Resume with the next absolute index. For example, after receiving indices `0` through `199`, reconnect with `from=200` while retaining the counter state, and the new response will send metadata followed by sample `200` onward.

Resuming at the fixture length sends metadata and completion immediately, with no sample timer allocated for that request. Closing the response cancels playback.

The stream saves nothing. Natural completion or "Finish session" makes the frontend freeze its result and call `POST /sessions`, using only the received prefix when the user stops a recording before its final sample.

Imported files replay locally. For built-in recordings, the [route](../apps/api/src/presentation/http/routes/signal-stream-routes.ts) formats events from the [playback service](../apps/api/src/application/signal-stream-service.ts), and the [stream tests](../apps/api/tests/http/signal-stream.test.ts) cover validation, resume positions and disconnect cleanup.

## Imported recordings and counting

Import a JSON object containing `angles` and `sampleRateHz` in the workspace. Each angle must be finite, the sample rate must be finite and positive, and optional metadata can include a text description or non-negative safe integer reference count.

```json
{
  "angles": [172, 99, 161],
  "sampleRateHz": 30,
  "description": "One completed squat",
  "expectedReps": 1
}
```

Received samples advance the counter. An angle strictly below `100` arms it, and a later angle strictly above `160` adds one rep and resets the state, with no smoothing or angle clamping.

Empty arrays are valid. A value exactly at `100` or `160` leaves the threshold state unchanged, and pauses, shallow attempts or an unfinished final squat add no extra reps to the result.

The noisy fixture exceeds `180` degrees. Those values remain valid, and the counter applies its strict thresholds without clamping the samples back into a nominal range, as checked by the [counter tests](../packages/domain/tests/counter.test.ts).

Duration uses the received sample count. Divide that count by the original `sampleRateHz` even during accelerated playback or after a disconnect, because the saved duration describes the recording prefix rather than the time spent watching it.

`expectedReps` is a comparison reference. The [import validator](../packages/contracts/src/fixture.ts) accepts it as optional metadata, while the counter calculates `10`, `8` and `7` reps from the complete clean, noisy and shallow recordings independently of that field. Unknown import fields are discarded.

The import parser ignores extra properties and retains the supported recording fields, while result POSTs accept exactly the four session fields defined above.

## Errors

Errors use one JSON shape.

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "A valid patient token is required."
  }
}
```

| Status | Code               | Trigger                                            |
| ------ | ------------------ | -------------------------------------------------- |
| `401`  | `UNAUTHORIZED`     | Missing, malformed or unknown Bearer token.        |
| `400`  | `INVALID_SESSION`  | Invalid result fields or additional fields.        |
| `400`  | `INVALID_SIGNAL`   | Invalid stream query or out-of-range resume index. |
| `400`  | `INVALID_JSON`     | Malformed JSON body.                               |
| `413`  | `BODY_TOO_LARGE`   | JSON body over the 16 KB parser limit.             |
| `404`  | `SIGNAL_NOT_FOUND` | Unknown fixture.                                   |
| `404`  | `NOT_FOUND`        | Unknown route or unsupported method.               |
| `409`  | `SESSION_CONFLICT` | A stored ID has a different result.                |
| `500`  | `INTERNAL_ERROR`   | An unexpected server error.                        |

Session and signal responses include `Cache-Control: no-store`, and the [error handler](../apps/api/src/presentation/http/middleware/error-handler.ts) turns malformed JSON, oversized bodies and unexpected server failures into the JSON shape shown above.
