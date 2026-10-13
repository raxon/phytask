export interface RepCounterState {
  reps: number;
  awaitingExtension: boolean;
}

export function createRepCounter(): RepCounterState {
  return { reps: 0, awaitingExtension: false };
}

/** The same state machine handles individual live samples and complete recordings. */
export function advanceRepCounter(state: RepCounterState, angle: number): RepCounterState {
  if (angle < 100) return { ...state, awaitingExtension: true };
  if (angle > 160 && state.awaitingExtension)
    return { reps: state.reps + 1, awaitingExtension: false };
  return state;
}

/** Strict thresholds preserve pauses and jitter without double-counting a rep. */
export function* completedRepIndices(angles: readonly number[]): Generator<number> {
  let state = createRepCounter();
  for (let index = 0; index < angles.length; index += 1) {
    const next = advanceRepCounter(state, angles[index]!);
    if (next.reps > state.reps) yield index;
    state = next;
  }
}

export function countReps(angles: readonly number[]): number {
  let reps = 0;
  const completions = completedRepIndices(angles);
  while (!completions.next().done) reps += 1;
  return reps;
}
