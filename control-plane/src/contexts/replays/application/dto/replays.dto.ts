export interface RateIntervalDto {
  readonly rate: number;
  readonly low: number;
  readonly high: number;
}

export interface GainEstimateDto {
  readonly gain: number;
  readonly low: number;
  readonly high: number;
  readonly significance: 'better' | 'worse' | 'within-noise';
  readonly minGain: number;
  readonly tasks: number;
}

export interface SetNoiseDto {
  readonly replayId: string;
  readonly fingerprint: string;
  readonly repeats: number;
  readonly perRepeat: readonly number[];
  readonly spread: number;
  readonly flippedTasks: readonly string[];
  readonly measuredAt: string;
  readonly noisyInOneRepeat: boolean;
}

export interface SetSaturationDto {
  readonly replayId: string;
  readonly rate: number;
  readonly interval: RateIntervalDto | null;
  readonly saturated: boolean;
  readonly measuredAt: string;
}

export interface JudgeConsistencyDto {
  readonly replayId: string;
  readonly compared: number;
  readonly agreed: number;
  readonly pending: number;
  readonly agreement: number | null;
  readonly unstable: boolean;
}

export interface FlakyCheckDto {
  readonly taskId: string;
  readonly originalRunId: string;
  readonly runId: string;
  readonly first: string;
  readonly recheck: string;
}

export interface CheckConsistencyDto {
  readonly replayId: string;
  readonly rechecked: number;
  readonly pending: number;
  readonly flaky: readonly FlakyCheckDto[];
}

export interface OracleReadingDto {
  readonly replayId: string;
  readonly candidateId: string;
  readonly repeats: number;
  readonly state: string;
  readonly referenceReplayId: string | null;
  readonly referenceState: string | null;
  readonly answered: number;
  readonly live: number | null;
  readonly withAnswer: number | null;
  readonly gain: GainEstimateDto | null;
  readonly roomToImprove: boolean | null;
}

export interface SetHealthDto {
  readonly noise: SetNoiseDto | null;
  readonly saturation: SetSaturationDto | null;
  readonly judge: JudgeConsistencyDto | null;
  readonly checks: CheckConsistencyDto | null;
  readonly oracle: OracleReadingDto | null;
}

export interface MoneyDto {
  readonly amount: number;
  readonly currency: string;
}

export interface StationChangeDto {
  readonly part: string;
  readonly name: string | null;
  readonly kind: 'added' | 'removed' | 'changed';
  readonly was: string | null;
  readonly now: string | null;
}
