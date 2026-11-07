export interface ReplayThreshold {
  readonly maxRegressions: number;
  readonly ceiling: number;
  readonly currency: string;
  readonly minGain: number;
}
