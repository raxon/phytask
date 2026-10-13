import type { PlaybackSpeed, SignalMetadata, SignalSample } from '@rep-counter/contracts/signal';
import type { SignalFixtureRepository } from './ports/signal-fixture-repository';
import type { SignalScheduler } from './ports/signal-scheduler';

interface SignalObserver {
  metadata(value: SignalMetadata): void;
  sample(value: SignalSample): void;
  complete(value: { totalSamples: number }): void;
}

interface SignalRequest {
  fixtureId: string;
  speed: PlaybackSpeed;
  from: number;
}

type PreparedSignal =
  | { status: 'not-found' }
  | { status: 'invalid' }
  | { status: 'ready'; start(observer: SignalObserver): () => void };

export interface SignalStreamUseCases {
  prepare(request: SignalRequest): PreparedSignal;
  close(): void;
}

export function createSignalStreamService(
  fixtures: SignalFixtureRepository,
  scheduler: SignalScheduler,
): SignalStreamUseCases {
  const activeStreams = new Set<() => void>();

  return {
    prepare({ fixtureId, speed, from }) {
      const fixture = fixtures.getById(fixtureId);
      if (!fixture) return { status: 'not-found' };
      if (
        ![1, 4, 8].includes(speed) ||
        !Number.isSafeInteger(from) ||
        from < 0 ||
        from > fixture.angles.length
      ) {
        return { status: 'invalid' };
      }

      return {
        status: 'ready',
        start(observer) {
          const totalSamples = fixture.angles.length;
          let index = from;
          let stopped = false;
          let cancelTimer = () => {};
          const cancel = () => {
            if (stopped) return;
            stopped = true;
            cancelTimer();
            activeStreams.delete(cancel);
          };

          observer.metadata({ sampleRateHz: fixture.sampleRateHz, totalSamples });
          if (index === totalSamples) {
            observer.complete({ totalSamples });
            return cancel;
          }

          activeStreams.add(cancel);
          cancelTimer = scheduler.repeat(
            () => {
              if (stopped) return;
              const angle = fixture.angles[index];
              if (angle === undefined) return;
              observer.sample({ index, angle });
              index += 1;
              if (index === totalSamples) {
                cancel();
                observer.complete({ totalSamples });
              }
            },
            1000 / (fixture.sampleRateHz * speed),
          );

          return cancel;
        },
      };
    },
    close() {
      for (const cancel of activeStreams) cancel();
    },
  };
}
