import type { PatientId } from '@rep-counter/demo-data/patients';
import type { SignalMetadata, SignalSample } from '@rep-counter/contracts/signal';
import type { SignalStream } from '../application/ports';

interface BrowserSignalDependencies {
  request(url: string, options: RequestInit): Promise<Response>;
  schedule(callback: () => void, intervalMs: number): () => void;
  tokenFor(patientId: PatientId): string;
}

function readEvent(block: string) {
  const lines = block.split(/\r?\n/);
  const event = lines
    .find((line) => line.startsWith('event:'))
    ?.slice(6)
    .trim();
  const data = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n');
  return { event, data };
}

/** Built-in signals use authenticated SSE; imported recordings replay entirely on the device. */
export function createBrowserSignalStream(dependencies: BrowserSignalDependencies): SignalStream {
  return {
    subscribe(options) {
      if (!options.source.fixtureId) {
        let index = options.fromIndex;
        let closed = false;
        let cancel = () => {};
        const stop = () => {
          if (closed) return;
          closed = true;
          cancel();
        };
        cancel = dependencies.schedule(
          () => {
            if (closed) return;
            if (index < options.source.fixture.angles.length) {
              options.onSample({ index, angle: options.source.fixture.angles[index]! });
              index += 1;
            }
            if (!closed && index === options.source.fixture.angles.length) {
              stop();
              options.onComplete();
            }
          },
          Math.min(
            2147483647,
            Math.max(1, 1000 / (options.source.fixture.sampleRateHz * options.speed)),
          ),
        );
        if (closed) cancel();
        return stop;
      }
      const abort = new AbortController();
      let closed = false;
      const stop = () => {
        closed = true;
        abort.abort();
      };
      void (async () => {
        let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
        try {
          const query = new URLSearchParams({
            fixture: options.source.fixtureId!,
            speed: String(options.speed),
            from: String(options.fromIndex),
          });
          const response = await dependencies.request('/signal-stream?' + query.toString(), {
            headers: { authorization: 'Bearer ' + dependencies.tokenFor(options.patientId) },
            signal: abort.signal,
            cache: 'no-store',
          });
          if (
            !response.ok ||
            !response.body ||
            !response.headers.get('content-type')?.includes('text/event-stream')
          )
            throw new Error('The signal could not be opened. Resume or finish this session.');
          reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let metadata: SignalMetadata | null = null;
          let completed = false;
          while (!closed && !completed) {
            const chunk = await reader.read();
            if (chunk.done) break;
            buffer += decoder.decode(chunk.value, { stream: true });
            let boundary = /\r?\n\r?\n/.exec(buffer);
            while (boundary && !closed && !completed) {
              const block = buffer.slice(0, boundary.index);
              buffer = buffer.slice(boundary.index + boundary[0].length);
              const event = readEvent(block);
              if (event.event === 'meta') {
                const value = JSON.parse(event.data) as SignalMetadata;
                if (
                  !value ||
                  typeof value !== 'object' ||
                  metadata ||
                  value.sampleRateHz !== options.source.fixture.sampleRateHz ||
                  value.totalSamples !== options.source.fixture.angles.length
                )
                  throw new Error('The signal metadata does not match the selected session.');
                metadata = value;
              } else if (event.event === 'sample') {
                const sample = JSON.parse(event.data) as SignalSample;
                if (
                  !sample ||
                  typeof sample !== 'object' ||
                  !metadata ||
                  !Number.isSafeInteger(sample.index) ||
                  !Number.isFinite(sample.angle)
                )
                  throw new Error('The signal returned an invalid sample.');
                options.onSample(sample);
              } else if (event.event === 'complete') {
                const value = JSON.parse(event.data) as { totalSamples: number };
                if (
                  !value ||
                  typeof value !== 'object' ||
                  !metadata ||
                  value.totalSamples !== metadata.totalSamples
                )
                  throw new Error('The signal returned an invalid completion event.');
                completed = true;
                options.onComplete();
              }
              boundary = /\r?\n\r?\n/.exec(buffer);
            }
            if (buffer.length > 65536) throw new Error('The signal returned an invalid event.');
          }
          if (!closed && !completed)
            throw new Error('The signal connection ended. Resume or finish this session.');
        } catch (error) {
          if (!closed)
            options.onError(error instanceof Error ? error.message : 'The signal was interrupted.');
        } finally {
          if (reader) await reader.cancel().catch(() => {});
        }
      })();
      return stop;
    },
  };
}
