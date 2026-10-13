import type { SignalScheduler } from '../../application/ports/signal-scheduler';

export function createIntervalScheduler(): SignalScheduler {
  return {
    repeat(callback, intervalMs) {
      let stopped = false;
      let deadline = performance.now() + intervalMs;
      let timer: ReturnType<typeof setTimeout>;
      const tick = () => {
        if (stopped) return;
        callback();
        if (stopped) return;
        // Accumulate fractional intervals instead of rounding every sample's delay.
        deadline += intervalMs;
        timer = setTimeout(tick, Math.max(1, Math.ceil(deadline - performance.now())));
      };
      timer = setTimeout(tick, Math.max(1, Math.ceil(intervalMs)));
      return () => {
        stopped = true;
        clearTimeout(timer);
      };
    },
  };
}
