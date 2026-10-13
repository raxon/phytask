import { describe, expect, it, vi } from 'vitest';
import type { SignalStream } from '../../src/features/workspace/application/ports';
import { createBrowserSignalStream } from '../../src/features/workspace/infrastructure/browser-signal-stream';

function options(): Parameters<SignalStream['subscribe']>[0] {
  return {
    patientId: 'alex',
    source: {
      name: 'signal.json',
      fixtureId: 'clean',
      fixture: { angles: [99, 160, 181.6], sampleRateHz: 30 },
    },
    speed: 8,
    fromIndex: 0,
    onSample: vi.fn(),
    onComplete: vi.fn(),
    onError: vi.fn(),
  };
}

const metadata = 'event: meta\r\ndata: {"sampleRateHz":30,"totalSamples":3}\r\n\r\n';
const sample = (index: number, angle: number) =>
  'event: sample\r\ndata: ' + JSON.stringify({ index, angle }) + '\r\n\r\n';
const complete = 'event: complete\r\ndata: {"totalSamples":3}\r\n\r\n';

function streamedResponse(text: string) {
  const bytes = new TextEncoder().encode(text);
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        // Split every byte to exercise UTF-8 decoding and SSE delimiters across network chunks.
        for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
        controller.close();
      },
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  );
}

describe('browser signal adapters', () => {
  it('parses fragmented SSE events and sends the token only as a header', async () => {
    const request = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () =>
      streamedResponse(
        ': heartbeat č\r\n\r\n' +
          metadata +
          sample(0, 99) +
          sample(1, 160) +
          sample(2, 181.6) +
          complete,
      ),
    );
    const adapter = createBrowserSignalStream({
      request,
      schedule: vi.fn(),
      tokenFor: () => 'demo-alex-token',
    });
    const listener = options();
    adapter.subscribe(listener);
    await vi.waitFor(() => expect(listener.onComplete).toHaveBeenCalledOnce());
    expect(listener.onSample).toHaveBeenCalledTimes(3);
    expect(listener.onSample).toHaveBeenLastCalledWith({ index: 2, angle: 181.6 });
    expect(listener.onError).not.toHaveBeenCalled();
    expect(request.mock.calls[0]).toEqual([
      '/signal-stream?fixture=clean&speed=8&from=0',
      expect.objectContaining({ headers: { authorization: 'Bearer demo-alex-token' } }),
    ]);
  });

  it('opens a resumed stream at the next received index without replaying earlier samples', async () => {
    const request = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () =>
      streamedResponse(metadata + sample(2, 181.6) + complete),
    );
    const adapter = createBrowserSignalStream({
      request,
      schedule: vi.fn(),
      tokenFor: () => 'demo-alex-token',
    });
    const listener = { ...options(), fromIndex: 2 };
    adapter.subscribe(listener);
    await vi.waitFor(() => expect(listener.onComplete).toHaveBeenCalledOnce());
    expect(listener.onSample).toHaveBeenCalledOnce();
    expect(request.mock.calls[0]![0]).toContain('from=2');
  });

  it.each([
    [metadata + sample(0, 99), 'connection ended'],
    ['event: meta\ndata: null\n\n', 'metadata'],
    [metadata + 'event: sample\ndata: null\n\n', 'invalid sample'],
  ])('interrupts an incomplete or malformed stream', async (body, message) => {
    const adapter = createBrowserSignalStream({
      request: async () => streamedResponse(body),
      schedule: vi.fn(),
      tokenFor: () => 'demo-alex-token',
    });
    const listener = options();
    adapter.subscribe(listener);
    await vi.waitFor(() =>
      expect(listener.onError).toHaveBeenCalledWith(expect.stringContaining(message)),
    );
    expect(listener.onComplete).not.toHaveBeenCalled();
  });

  it('aborts an HTTP connection without reporting a canceled session as an error', async () => {
    let signal: AbortSignal | null | undefined;
    const adapter = createBrowserSignalStream({
      request: (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          signal = init.signal;
          signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
      schedule: vi.fn(),
      tokenFor: () => 'demo-alex-token',
    });
    const listener = options();
    const stop = adapter.subscribe(listener);
    stop();
    await Promise.resolve();
    expect(signal?.aborted).toBe(true);
    expect(listener.onError).not.toHaveBeenCalled();
  });

  it('plays imported angles locally at the selected cadence and cancels on completion', () => {
    const request = vi.fn();
    const cancel = vi.fn();
    let tick!: () => void;
    const schedule = vi.fn((callback: () => void, _interval: number) => {
      tick = callback;
      return cancel;
    });
    const adapter = createBrowserSignalStream({
      request,
      schedule,
      tokenFor: () => 'demo-alex-token',
    });
    const listener = options();
    listener.source.fixtureId = null;
    const stop = adapter.subscribe(listener);
    expect(schedule.mock.calls[0]![1]).toBe(1000 / (30 * 8));
    tick();
    tick();
    tick();
    tick();
    expect(listener.onSample).toHaveBeenCalledTimes(3);
    expect(listener.onComplete).toHaveBeenCalledOnce();
    expect(cancel).toHaveBeenCalledOnce();
    expect(request).not.toHaveBeenCalled();
    stop();
    expect(cancel).toHaveBeenCalledOnce();
  });
});
