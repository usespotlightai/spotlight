import type {
  GainEstimateDto,
  MoneyDto,
  RateIntervalDto,
} from '@replays/application/dto/replays.dto';
import type { TaskRow } from '@replays/application/dto/task-rows.dto';
import type {
  CheckResult,
  UndecidedBecause,
} from '@replays/domain/services/replay-check-result';

export interface CheckSideDto {
  readonly state: string | null;
  readonly entries: number;
  readonly scored: number;
  readonly succeeded: number | null;
  readonly successRate: number | null;
  readonly interval: RateIntervalDto | null;
  readonly tasksScored: number;
  readonly spent: MoneyDto | null;
}

export interface ReplayCheckDto {
  readonly id: string;
  readonly teamId: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly stationKey: string;
  readonly setId: string;
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
    readonly ceiling: MoneyDto;
    readonly unpricedRun: MoneyDto | null;
  };
  readonly repeats: number;
  readonly gain: GainEstimateDto | null;
  readonly result: CheckResult;
  readonly undecidedBecause: UndecidedBecause | null;
  readonly taskCount: number;
  readonly compared: number;
  readonly candidate: CheckSideDto;
  readonly baseline: CheckSideDto;
  readonly tasks: readonly TaskRow[];
  readonly createdAt: string;
}
