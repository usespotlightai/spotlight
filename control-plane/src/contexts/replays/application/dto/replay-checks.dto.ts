import type {
  EntryResultDto,
  GainReadingDto,
  RateIntervalDto,
  SpendDto,
} from '@replays/application/dto/replays.dto';
import type {
  CheckVerdict,
  UndecidedBecause,
} from '@replays/domain/services/replay-check-verdict';

export interface CheckSideDto {
  readonly state: string | null;
  readonly entries: number;
  readonly scored: number;
  readonly succeeded: number | null;
  readonly successRate: number | null;
  readonly interval: RateIntervalDto | null;
  readonly tasksScored: number;
  readonly spent: SpendDto | null;
}

export interface CheckRegressionDto {
  readonly taskId: string;
  readonly originalRunId: string;
  readonly title: string | null;
  readonly candidate: readonly EntryResultDto[];
  readonly baseline: readonly EntryResultDto[];
  readonly scoreDelta: number | null;
  readonly reasons: readonly {
    readonly code: string;
    readonly detail: string | null;
  }[];
}

export interface ReplayCheckDto {
  readonly id: string;
  readonly teamId: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly stationKey: string;
  readonly setId: string;
  readonly setName: string | null;
  readonly candidateId: string;
  readonly replayId: string;
  readonly baselineReplayId: string | null;
  readonly attempt: number;
  readonly reference: {
    readonly commit: string | null;
    readonly pullRequest: number | null;
  };
  readonly liveFingerprint: string;
  readonly candidateFingerprint: string;
  readonly scoringPinnedToLive: readonly string[];
  readonly threshold: {
    readonly maxRegressions: number;
    readonly minGain: number;
    readonly ceiling: SpendDto;
    readonly unpricedRun: SpendDto | null;
  };
  readonly repeats: number;
  readonly gain: GainReadingDto | null;
  readonly verdict: CheckVerdict;
  readonly undecidedBecause: UndecidedBecause | null;
  readonly tasks: number;
  readonly compared: number;
  readonly candidate: CheckSideDto;
  readonly baseline: CheckSideDto;
  readonly regressions: readonly CheckRegressionDto[];
  readonly replayUrl: string | null;
  readonly createdAt: string;
}

export interface ReplayCheckSummaryDto {
  readonly id: string;
  readonly stationId: string;
  readonly stationKey: string;
  readonly verdict: CheckVerdict;
  readonly undecidedBecause: UndecidedBecause | null;
  readonly regressions: number;
  readonly attempt: number;
  readonly reference: {
    readonly commit: string | null;
    readonly pullRequest: number | null;
  };
  readonly createdAt: string;
  readonly replayUrl: string | null;
}
