import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSignalStreamService } from '../../src/application/signal-stream-service';
import type { SignalFixtureRepository } from '../../src/application/ports/signal-fixture-repository';
import type { SignalScheduler } from '../../src/application/ports/signal-scheduler';

const fixture = { angles: [170, 90, 181.6, 170], sampleRateHz: 4 };
const repository: SignalFixtureRepository = {
  getById: (fixtureId) => (fixtureId === 'clean' ? fixture : null),
};
const scheduler: SignalScheduler = {
  repeat(callback, intervalMs) {
    const timer = setInterval(callback, intervalMs);
    return () => clearInterval(timer);
  },
};

function observer() {
  return { metadata: vi.fn(), sample: vi.fn(), complete: vi.fn() };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('signal playback use cases', () => {
  it('emits metadata before the first timed sample and preserves angles above 180 degrees', () => {
    const signals = createSignalStreamService(repository, scheduler);
    const stream = signals.prepare({ fixtureId: 'clean', speed: 1, from: 0 });
    expect(stream.status).toBe('ready');
    if (stream.status !== 'ready') throw new Error('Expected a prepared signal');
    const events = observer();
    stream.start(events);
    expect(events.metadata).toHaveBeenCalledWith({ sampleRateHz: 4, totalSamples: 4 });
    expect(events.sample).not.toHaveBeenCalled();
    vi.advanceTimersByTime(249);
    expect(events.sample).not.toHaveBeenCalled();
    vi.advanceTimersByTime(751);
    expect(events.sample.mock.calls.map(([sample]) => sample)).toEqual([
      { index: 0, angle: 170 },
      { index: 1, angle: 90 },
      { index: 2, angle: 181.6 },
      { index: 3, angle: 170 },
    ]);
    expect(events.complete).toHaveBeenCalledExactlyOnceWith({ totalSamples: 4 });
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(2000);
    expect(events.sample).toHaveBeenCalledTimes(4);
  });

  it.each([1, 4, 8] as const)('replays at %sx speed without changing sample metadata', (speed) => {
    const repeat = vi.fn(scheduler.repeat);
    const stream = createSignalStreamService(repository, { repeat }).prepare({
      fixtureId: 'clean',
      speed,
      from: 0,
    });
    if (stream.status !== 'ready') throw new Error('Expected a prepared signal');
    const events = observer();
    stream.start(events);
    expect(repeat).toHaveBeenCalledWith(expect.any(Function), 1000 / (4 * speed));
    vi.advanceTimersByTime(1000 / speed);
    expect(events.sample).toHaveBeenCalledTimes(4);
    expect(events.metadata).toHaveBeenCalledWith({ sampleRateHz: 4, totalSamples: 4 });
    expect(events.complete).toHaveBeenCalledOnce();
  });

  it('resumes at an absolute sample index and sends only the remaining samples', () => {
    const stream = createSignalStreamService(repository, scheduler).prepare({
      fixtureId: 'clean',
      speed: 1,
      from: 2,
    });
    if (stream.status !== 'ready') throw new Error('Expected a prepared signal');
    const events = observer();
    stream.start(events);
    vi.advanceTimersByTime(500);
    expect(events.sample.mock.calls.map(([sample]) => sample)).toEqual([
      { index: 2, angle: 181.6 },
      { index: 3, angle: 170 },
    ]);
    expect(events.complete).toHaveBeenCalledExactlyOnceWith({ totalSamples: 4 });
  });

  it('completes immediately when resumed at the end, without allocating a timer', () => {
    const stream = createSignalStreamService(repository, scheduler).prepare({
      fixtureId: 'clean',
      speed: 1,
      from: 4,
    });
    if (stream.status !== 'ready') throw new Error('Expected a prepared signal');
    const events = observer();
    stream.start(events);
    expect(events.metadata).toHaveBeenCalledOnce();
    expect(events.sample).not.toHaveBeenCalled();
    expect(events.complete).toHaveBeenCalledExactlyOnceWith({ totalSamples: 4 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels ticks on disconnect without reporting natural completion', () => {
    const stream = createSignalStreamService(repository, scheduler).prepare({
      fixtureId: 'clean',
      speed: 1,
      from: 0,
    });
    if (stream.status !== 'ready') throw new Error('Expected a prepared signal');
    const events = observer();
    const cancel = stream.start(events);
    vi.advanceTimersByTime(250);
    cancel();
    cancel();
    vi.advanceTimersByTime(2000);
    expect(events.sample).toHaveBeenCalledExactlyOnceWith({ index: 0, angle: 170 });
    expect(events.complete).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('releases every active stream when the application closes', () => {
    const signals = createSignalStreamService(repository, scheduler);
    const stream = signals.prepare({ fixtureId: 'clean', speed: 1, from: 0 });
    if (stream.status !== 'ready') throw new Error('Expected a prepared signal');
    const first = observer();
    const second = observer();
    stream.start(first);
    stream.start(second);
    expect(vi.getTimerCount()).toBe(2);
    signals.close();
    signals.close();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(2000);
    expect(first.sample).not.toHaveBeenCalled();
    expect(second.complete).not.toHaveBeenCalled();
  });

  it.each([-1, 1.5, 5, Number.POSITIVE_INFINITY, Number.NaN])(
    'rejects invalid resume index %s before playback',
    (from) => {
      expect(
        createSignalStreamService(repository, scheduler).prepare({
          fixtureId: 'clean',
          speed: 1,
          from,
        }),
      ).toEqual({ status: 'invalid' });
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('returns not-found for an unknown signal', () => {
    expect(
      createSignalStreamService(repository, scheduler).prepare({
        fixtureId: 'unknown',
        speed: 1,
        from: 0,
      }),
    ).toEqual({ status: 'not-found' });
  });
});
