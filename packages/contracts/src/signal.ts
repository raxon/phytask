export type PlaybackSpeed = 1 | 4 | 8;

export interface SignalMetadata {
  sampleRateHz: number;
  totalSamples: number;
}

export interface SignalSample {
  index: number;
  angle: number;
}
