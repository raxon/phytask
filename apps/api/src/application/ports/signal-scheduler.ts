export interface SignalScheduler {
  /** Schedule recurring asynchronous ticks; cancelling must release the timer. */
  repeat(callback: () => void, intervalMs: number): () => void;
}
