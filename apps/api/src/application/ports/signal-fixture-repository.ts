export interface SignalFixture {
  readonly angles: readonly number[];
  readonly sampleRateHz: number;
}

export interface SignalFixtureRepository {
  getById(fixtureId: string): SignalFixture | null;
}
