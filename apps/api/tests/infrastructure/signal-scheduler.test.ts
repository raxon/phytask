import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createIntervalScheduler } from '../../src/infrastructure/signal/interval-scheduler';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('runtime signal scheduler', () => {
  it('keeps fractional sample intervals aligned with elapsed playback time', () => {
    const sample = vi.fn();
    const cancel = createIntervalScheduler().repeat(sample, 1000 / 30);
    vi.advanceTimersByTime(999);
    expect(sample).toHaveBeenCalledTimes(29);
    vi.advanceTimersByTime(2);
    expect(sample).toHaveBeenCalledTimes(30);
    cancel();
    vi.advanceTimersByTime(1000);
    expect(sample).toHaveBeenCalledTimes(30);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not allocate another timer when a callback cancels its own replay', () => {
    let cancel = () => {};
    const sample = vi.fn(() => cancel());
    cancel = createIntervalScheduler().repeat(sample, 10);
    vi.advanceTimersByTime(100);
    expect(sample).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
