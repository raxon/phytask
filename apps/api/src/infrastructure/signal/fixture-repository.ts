import type {
  SignalFixture,
  SignalFixtureRepository,
} from '../../application/ports/signal-fixture-repository';

export function createSignalFixtureRepository(
  fixtures: Readonly<Record<string, SignalFixture>>,
): SignalFixtureRepository {
  return {
    getById(fixtureId) {
      return Object.hasOwn(fixtures, fixtureId) ? (fixtures[fixtureId] ?? null) : null;
    },
  };
}
