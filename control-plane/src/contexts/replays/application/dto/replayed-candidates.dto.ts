import type { CandidatePullRequestDto } from '@replays/application/dto/config-pull-requests.dto';
import type {
  GainReadingDto,
  RateIntervalDto,
  SetHealthDto,
  StationChangeDto,
} from '@replays/application/dto/replays.dto';
import type { ShownAgainstLive } from '@replays/domain/services/against-live';
import type { ChartedAs } from '@replays/domain/services/replayed-chart';
import type { ReplayedPeriodName } from '@replays/domain/value-objects/replayed-period.vo';

type ReplayedCandidateKind = 'searched' | 'proposed';

export interface ReplayedPeriodDto {
  readonly name: ReplayedPeriodName;
  readonly from: string;
  readonly to: string;
}

export interface ReplaySetHealthDto extends SetHealthDto {
  readonly tasks: number;
  readonly runs: number;
  readonly oldestRunEndedAt: string | null;
  readonly newestRunEndedAt: string | null;
  readonly lastAddedAt: string | null;
  readonly minGain: number;
}

export interface ReplayedBaselineDto {
  readonly replayId: string;
  readonly state: string;
  readonly fingerprint: string | null;
  readonly scored: number;
  readonly successRate: number | null;
  readonly interval: RateIntervalDto | null;
  readonly costPerRun: number | null;
  readonly currency: string;
  readonly endedAt: string | null;
  readonly charted: ChartedAs;
}

export interface ReplayedHeldOutDto {
  readonly replayId: string;
  readonly state: string | null;
  readonly score: number | null;
  readonly interval: RateIntervalDto | null;
  readonly tasks: number;
  readonly runs: number;
}

export interface ReplayedLiveDto {
  readonly successRate: number | null;
  readonly interval: RateIntervalDto | null;
  readonly costPerRun: number | null;
  readonly currency: string;
}

export interface ReplayedSeedDto {
  readonly successRate: number | null;
  readonly interval: RateIntervalDto | null;
  readonly costPerRun: number | null;
  readonly scored: number;
  readonly charted: ChartedAs;
}

export interface ReplayedSearchDto {
  readonly searchId: string;
  readonly state: string;
  readonly objective: 'success' | 'cost';
  readonly startedAt: string;
  readonly seed: ReplayedSeedDto;
}

export interface ReplayedCandidateDto {
  readonly candidateId: string;
  readonly name: string;
  readonly kind: ReplayedCandidateKind;
  readonly hypothesis: string | null;
  readonly fingerprint: string | null;
  readonly changes: readonly StationChangeDto[];
  readonly replayId: string;
  readonly replayState: string | null;
  readonly replayedAt: string | null;
  readonly tasks: number;
  readonly runs: number;
  readonly successRate: number | null;
  readonly interval: RateIntervalDto | null;
  readonly scored: number;
  readonly heldOut: ReplayedHeldOutDto | null;
  readonly costPerRun: number | null;
  readonly currency: string;
  readonly live: ReplayedLiveDto | null;
  readonly successRateOnCompared: number | null;
  readonly intervalOnCompared: RateIntervalDto | null;
  readonly costPerRunOnCompared: number | null;
  readonly regressions: number | null;
  readonly compared: number;
  readonly againstLive: GainReadingDto | null;
  readonly onFrontier: boolean | null;
  readonly search: ReplayedSearchDto | null;
  readonly pullRequest: CandidatePullRequestDto | null;
  readonly charted: ChartedAs;
  readonly shown: ReplayedShownDto;
}

export type ReplayedShownDto = ShownAgainstLive<RateIntervalDto>;

export interface ReplayedSetDto {
  readonly setId: string;
  readonly name: string;
  readonly stationGone: boolean;
  readonly guardsChanges: boolean;
  readonly health: ReplaySetHealthDto;
  readonly baseline: ReplayedBaselineDto | null;
  readonly chartCurrency: string | null;
  readonly candidates: readonly ReplayedCandidateDto[];
}

export interface ReplayedStationDto {
  readonly lineId: string;
  readonly stationId: string;
  readonly sets: readonly ReplayedSetDto[];
}

export interface ReplayedCandidatesDto {
  readonly period: ReplayedPeriodDto;
  readonly truncated: boolean;
  readonly stations: readonly ReplayedStationDto[];
}
