/** Strict thresholds preserve pauses and jitter without double-counting a rep. */
export function* completedRepIndices(angles: readonly number[]): Generator<number> {
  let awaitingExtension = false;
  for (let index = 0; index < angles.length; index += 1) {
    const angle = angles[index]!;
    if (angle < 100) awaitingExtension = true;
    else if (angle > 160 && awaitingExtension) {
      yield index;
      awaitingExtension = false;
    }
  }
}

export function countReps(angles: readonly number[]): number {
  let reps = 0;
  const completions = completedRepIndices(angles);
  while (!completions.next().done) reps += 1;
  return reps;
}
