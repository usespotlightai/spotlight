import { ApiProperty } from '@nestjs/swagger';
import type {
  ReplayedBaselineDto,
  ReplayedCandidateDto,
  ReplayedCandidatesDto,
  ReplayedHeldOutDto,
  ReplayedLiveDto,
  ReplayedPeriodDto,
  ReplayedSearchDto,
  ReplayedSeedDto,
  ReplayedSetDto,
  ReplayedShownDto,
  ReplayedStationDto,
  ReplaySetHealthDto,
} from '@replays/application/dto/replayed-candidates.dto';
import {
  CHART_STATUSES,
  type ChartStatus,
} from '@replays/domain/services/replayed-chart';
import { REPLAY_STATES } from '@replays/domain/value-objects/replay-state';
import { REPLAYED_PERIODS } from '@replays/domain/value-objects/replayed-period.vo';
import { SEARCH_OBJECTIVES } from '@replays/domain/value-objects/search-objective';
import { SEARCH_STATES } from '@replays/domain/value-objects/search-state';
import { CandidatePullRequestResponseDto } from '@replays/presentation/http/dto/config-pull-requests.response.dto';
import {
  GainEstimateResponseDto,
  gainResponse,
  intervalResponse,
  RateIntervalResponseDto,
  SetHealthResponseDto,
} from '@replays/presentation/http/dto/replays.response.dto';
import { StationChangeResponseDto } from '@replays/presentation/http/dto/station-changes.response.dto';

const RATE =
  'A success rate, 0 to 1, of the past runs it was scored on, each a replay of one past run; a task worked twice counts twice';

const PER_RUN =
  'What it spent per scored run; unknown while any of it went unpriced or was in another currency';

const CHART_STATUS =
  'Where it goes on the set’s cost and success chart: priced when finished, scored and costed in the chart currency; unfinished, unscored, unpriced or other-currency say why it is left off';

export class ReplayedPeriodResponseDto {
  @ApiProperty({ enum: REPLAYED_PERIODS, example: '30d' })
  readonly name: string;

  @ApiProperty({
    example: '2026-09-02T00:00:00.000Z',
    description: 'The first UTC day it looks at, from its start',
  })
  readonly from: string;

  @ApiProperty({
    example: '2026-10-02T00:00:00.000Z',
    description:
      'The start of the UTC day after today, which it stops short of',
  })
  readonly to: string;

  constructor(period: ReplayedPeriodDto) {
    this.name = period.name;
    this.from = period.from;
    this.to = period.to;
  }
}

export class ReplaySetHealthResponseDto extends SetHealthResponseDto {
  @ApiProperty({
    description:
      'How many distinct tasks its runs worked; fewer than its runs when a task was worked more than once',
  })
  readonly tasks: number;

  @ApiProperty({ description: 'How many past runs the set contains now' })
  readonly runs: number;

  @ApiProperty({
    nullable: true,
    type: String,
    example: '2026-07-14T10:00:00.000Z',
    description:
      'When the oldest of its runs ended; null while none of them has an end',
  })
  readonly oldestRunEndedAt: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: '2026-09-28T16:20:00.000Z',
    description:
      'When the newest of its runs ended; null while none of them has an end',
  })
  readonly newestRunEndedAt: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: '2026-09-29T09:00:00.000Z',
    description:
      'When a task was last added to it; null while it contains none',
  })
  readonly lastAddedAt: string | null;

  @ApiProperty({
    example: 0.05,
    description: 'The smallest gain in success its line counts as real',
  })
  readonly minGain: number;

  constructor(health: ReplaySetHealthDto) {
    super(health);
    this.tasks = health.tasks;
    this.runs = health.runs;
    this.oldestRunEndedAt = health.oldestRunEndedAt;
    this.newestRunEndedAt = health.newestRunEndedAt;
    this.lastAddedAt = health.lastAddedAt;
    this.minGain = health.minGain;
  }
}

export class ReplayedBaselineResponseDto {
  @ApiProperty()
  readonly replayId: string;

  @ApiProperty({ enum: REPLAY_STATES })
  readonly state: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'The fingerprint of the live config it replayed',
  })
  readonly fingerprint: string | null;

  @ApiProperty({ description: 'How many of its runs it was scored on' })
  readonly scored: number;

  @ApiProperty({ nullable: true, type: Number, description: RATE })
  readonly successRate: number | null;

  @ApiProperty({
    nullable: true,
    type: RateIntervalResponseDto,
    description: 'The success rate with its 95% interval over the tasks',
  })
  readonly interval: RateIntervalResponseDto | null;

  @ApiProperty({ nullable: true, type: Number, description: PER_RUN })
  readonly costPerRun: number | null;

  @ApiProperty({ example: 'USD' })
  readonly currency: string;

  @ApiProperty({ nullable: true, type: String })
  readonly endedAt: string | null;

  @ApiProperty({ enum: CHART_STATUSES, description: CHART_STATUS })
  readonly chartStatus: ChartStatus;

  constructor(baseline: ReplayedBaselineDto) {
    this.replayId = baseline.replayId;
    this.state = baseline.state;
    this.fingerprint = baseline.fingerprint;
    this.scored = baseline.scored;
    this.successRate = baseline.successRate;
    this.interval = intervalResponse(baseline.interval);
    this.costPerRun = baseline.costPerRun;
    this.currency = baseline.currency;
    this.endedAt = baseline.endedAt;
    this.chartStatus = baseline.chartStatus;
  }
}

export class ReplayedHeldOutResponseDto {
  @ApiProperty()
  readonly replayId: string;

  @ApiProperty({ nullable: true, enum: [...REPLAY_STATES, null], type: String })
  readonly state: string | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description:
      'Its success rate on the held-out tasks, 0 to 1, once its held-out replay finished',
  })
  readonly score: number | null;

  @ApiProperty({
    nullable: true,
    type: RateIntervalResponseDto,
    description: 'The success rate with its 95% interval over the tasks',
  })
  readonly interval: RateIntervalResponseDto | null;

  @ApiProperty({ description: 'How many distinct tasks the search held out' })
  readonly tasks: number;

  @ApiProperty({
    description:
      'How many held-out runs its held-out replay was scored on: the runs its held-out score covers',
  })
  readonly runs: number;

  constructor(heldOut: ReplayedHeldOutDto) {
    this.replayId = heldOut.replayId;
    this.state = heldOut.state;
    this.score = heldOut.score;
    this.interval = intervalResponse(heldOut.interval);
    this.tasks = heldOut.tasks;
    this.runs = heldOut.runs;
  }
}

export class ReplayedLiveResponseDto {
  @ApiProperty({ nullable: true, type: Number, description: RATE })
  readonly successRate: number | null;

  @ApiProperty({
    type: RateIntervalResponseDto,
    nullable: true,
    description: 'The success rate with its 95% interval over the tasks',
  })
  readonly interval: RateIntervalResponseDto | null;

  @ApiProperty({ nullable: true, type: Number, description: PER_RUN })
  readonly costPerRun: number | null;

  @ApiProperty({
    example: 'USD',
    description:
      'The baseline’s currency, which its cost per run is in; it may differ from the candidate’s',
  })
  readonly currency: string;

  constructor(live: ReplayedLiveDto) {
    this.successRate = live.successRate;
    this.interval = intervalResponse(live.interval);
    this.costPerRun = live.costPerRun;
    this.currency = live.currency;
  }
}

export class ReplayedSeedResponseDto {
  @ApiProperty({
    nullable: true,
    type: Number,
    description:
      'The live config’s success rate on the searched runs, 0 to 1: the search score of the seed',
  })
  readonly successRate: number | null;

  @ApiProperty({
    nullable: true,
    type: RateIntervalResponseDto,
    description: 'The success rate with its 95% interval over the tasks',
  })
  readonly interval: RateIntervalResponseDto | null;

  @ApiProperty({ nullable: true, type: Number, description: PER_RUN })
  readonly costPerRun: number | null;

  @ApiProperty({ description: 'How many searched runs it was scored on' })
  readonly scored: number;

  @ApiProperty({ enum: CHART_STATUSES, description: CHART_STATUS })
  readonly chartStatus: ChartStatus;

  constructor(seed: ReplayedSeedDto) {
    this.successRate = seed.successRate;
    this.interval = intervalResponse(seed.interval);
    this.costPerRun = seed.costPerRun;
    this.scored = seed.scored;
    this.chartStatus = seed.chartStatus;
  }
}

export class ReplayedShownResponseDto {
  @ApiProperty({
    enum: ['compared', 'overall'],
    description:
      'compared when the baseline replayed some of its runs too, so it is set beside live on those runs only; overall otherwise, with nothing from live',
  })
  readonly basis: 'compared' | 'overall';

  @ApiProperty({
    enum: ['compared', 'overall'],
    description:
      'compared when the cost per run covers the compared runs; overall when it covers all its scored runs, because live is in another currency or there is no compared basis',
  })
  readonly costBasis: 'compared' | 'overall';

  @ApiProperty({ nullable: true, type: Number, description: RATE })
  readonly successRate: number | null;

  @ApiProperty({
    nullable: true,
    type: RateIntervalResponseDto,
    description: 'The success rate with its 95% interval over the tasks',
  })
  readonly interval: RateIntervalResponseDto | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description:
      'The live config’s success rate on the same runs; null on the overall basis',
  })
  readonly liveSuccessRate: number | null;

  @ApiProperty({ description: 'How many runs the success rates cover' })
  readonly runs: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    description:
      'What it spent per run, in its own currency: on the compared runs when live is in the same currency, else over all its scored runs',
  })
  readonly costPerRun: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description:
      'What the live config spent per run on the compared runs, in the candidate’s currency; null on the overall basis or when live is in another currency',
  })
  readonly liveCostPerRun: number | null;

  constructor(shown: ReplayedShownDto) {
    this.basis = shown.basis;
    this.costBasis = shown.costBasis;
    this.successRate = shown.successRate;
    this.interval = intervalResponse(shown.interval);
    this.liveSuccessRate = shown.liveSuccessRate;
    this.runs = shown.runs;
    this.costPerRun = shown.costPerRun;
    this.liveCostPerRun = shown.liveCostPerRun;
  }
}

export class ReplayedSearchResponseDto {
  @ApiProperty()
  readonly searchId: string;

  @ApiProperty({ enum: SEARCH_STATES })
  readonly state: string;

  @ApiProperty({
    enum: SEARCH_OBJECTIVES,
    description:
      'What the search looks for, which decides whether this candidate is on its frontier',
  })
  readonly objective: 'success' | 'cost';

  @ApiProperty({ example: '2026-09-30T08:00:00.000Z' })
  readonly startedAt: string;

  @ApiProperty({
    type: ReplayedSeedResponseDto,
    description:
      'The live config the search started from, scored on the same searched runs as its candidates, in the candidate’s currency',
  })
  readonly seed: ReplayedSeedResponseDto;

  constructor(search: ReplayedSearchDto) {
    this.searchId = search.searchId;
    this.state = search.state;
    this.objective = search.objective;
    this.startedAt = search.startedAt;
    this.seed = new ReplayedSeedResponseDto(search.seed);
  }
}

export class ReplayedCandidateResponseDto {
  @ApiProperty()
  readonly candidateId: string;

  @ApiProperty({ example: 'terse-prompt' })
  readonly name: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'What the search agent expected it to improve, and why; null unless searched',
  })
  readonly hypothesis: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly fingerprint: string | null;

  @ApiProperty({
    type: StationChangeResponseDto,
    isArray: true,
    description: 'How its station config differs from the live config',
  })
  readonly changes: StationChangeResponseDto[];

  @ApiProperty({
    description: 'Its replay on the searched tasks',
  })
  readonly replayId: string;

  @ApiProperty({ nullable: true, enum: [...REPLAY_STATES, null], type: String })
  readonly replayState: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: '2026-09-30T08:05:00.000Z',
    description:
      'When the replay shown started; null while the replay cannot be found',
  })
  readonly replayedAt: string | null;

  @ApiProperty({
    description:
      'How many distinct tasks its replay covers: the searched ones when searched',
  })
  readonly tasks: number;

  @ApiProperty({
    description:
      'How many past runs its replay covers; more than its tasks when a task was worked more than once',
  })
  readonly runs: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    description:
      'Its search score: the replay success rate, 0 to 1, over the searched runs it was scored on, scored by its own checks and judge; not how live runs went',
  })
  readonly successRate: number | null;

  @ApiProperty({
    nullable: true,
    type: RateIntervalResponseDto,
    description: 'The success rate with its 95% interval over the tasks',
  })
  readonly interval: RateIntervalResponseDto | null;

  @ApiProperty({ description: 'How many of its runs it was scored on' })
  readonly scored: number;

  @ApiProperty({
    type: ReplayedHeldOutResponseDto,
    nullable: true,
    description:
      'Its replay on the tasks the search held out, when it was on the frontier as the search stopped; apart from its search score',
  })
  readonly heldOut: ReplayedHeldOutResponseDto | null;

  @ApiProperty({ nullable: true, type: Number, description: PER_RUN })
  readonly costPerRun: number | null;

  @ApiProperty({ example: 'USD' })
  readonly currency: string;

  @ApiProperty({
    type: ReplayedLiveResponseDto,
    nullable: true,
    description:
      'How the set’s baseline, the live config replayed, did on the compared runs only: those of the candidate’s runs it replayed too; null without a baseline',
  })
  readonly live: ReplayedLiveResponseDto | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description:
      'The candidate’s own success rate on the compared runs only, 0 to 1, to set beside live; null without a baseline',
  })
  readonly successRateOnCompared: number | null;

  @ApiProperty({
    type: RateIntervalResponseDto,
    nullable: true,
    description:
      'The candidate’s success rate on the compared runs with its 95% interval over their tasks; null without a baseline',
  })
  readonly intervalOnCompared: RateIntervalResponseDto | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description:
      'What the candidate spent per run on the compared runs only, in its own currency, to set beside live; unknown while any of it went unpriced, and null without a baseline',
  })
  readonly costPerRunOnCompared: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description:
      'Compared runs it did worse on than the baseline; null without a baseline',
  })
  readonly regressions: number | null;

  @ApiProperty({
    description:
      'How many of its runs the baseline replayed too: the runs live and successRateOnCompared cover',
  })
  readonly compared: number;

  @ApiProperty({
    nullable: true,
    type: GainEstimateResponseDto,
    description:
      'Its gain in success over the baseline on the compared runs, paired task by task, and whether it is within noise; null without a baseline',
  })
  readonly gainOverLive: GainEstimateResponseDto | null;

  @ApiProperty({
    nullable: true,
    type: Boolean,
    description:
      'Whether no other candidate of its search, nor the seed, succeeds as often for less; null unless searched',
  })
  readonly onFrontier: boolean | null;

  @ApiProperty({
    type: ReplayedSearchResponseDto,
    nullable: true,
    description: 'The search that found it; null unless searched',
  })
  readonly search: ReplayedSearchResponseDto | null;

  @ApiProperty({
    type: CandidatePullRequestResponseDto,
    nullable: true,
    description:
      'The pull request Spotlight opens once a person picks it from its search; null until then',
  })
  readonly pullRequest: CandidatePullRequestResponseDto | null;

  @ApiProperty({ enum: CHART_STATUSES, description: CHART_STATUS })
  readonly chartStatus: ChartStatus;

  @ApiProperty({
    type: ReplayedShownResponseDto,
    description:
      'The success and cost to set beside live: on the compared runs when there are any, else overall',
  })
  readonly shown: ReplayedShownResponseDto;

  constructor(candidate: ReplayedCandidateDto) {
    this.candidateId = candidate.candidateId;
    this.name = candidate.name;
    this.hypothesis = candidate.hypothesis;
    this.fingerprint = candidate.fingerprint;
    this.changes = candidate.changes.map(
      (each) => new StationChangeResponseDto(each),
    );
    this.replayId = candidate.replayId;
    this.replayState = candidate.replayState;
    this.replayedAt = candidate.replayedAt;
    this.tasks = candidate.tasks;
    this.runs = candidate.runs;
    this.successRate = candidate.successRate;
    this.interval = intervalResponse(candidate.interval);
    this.scored = candidate.scored;
    this.heldOut = candidate.heldOut
      ? new ReplayedHeldOutResponseDto(candidate.heldOut)
      : null;
    this.costPerRun = candidate.costPerRun;
    this.currency = candidate.currency;
    this.live = candidate.live
      ? new ReplayedLiveResponseDto(candidate.live)
      : null;
    this.regressions = candidate.regressions;
    this.compared = candidate.compared;
    this.gainOverLive = gainResponse(candidate.gainOverLive);
    this.successRateOnCompared = candidate.successRateOnCompared;
    this.intervalOnCompared = intervalResponse(candidate.intervalOnCompared);
    this.costPerRunOnCompared = candidate.costPerRunOnCompared;
    this.onFrontier = candidate.onFrontier;
    this.search = candidate.search
      ? new ReplayedSearchResponseDto(candidate.search)
      : null;
    this.pullRequest = candidate.pullRequest
      ? new CandidatePullRequestResponseDto(candidate.pullRequest)
      : null;
    this.chartStatus = candidate.chartStatus;
    this.shown = new ReplayedShownResponseDto(candidate.shown);
  }
}

export class ReplayedSetResponseDto {
  @ApiProperty()
  readonly setId: string;

  @ApiProperty({ description: 'Whether its station has left its line' })
  readonly stationGone: boolean;

  @ApiProperty({
    type: ReplaySetHealthResponseDto,
    description: 'The current health of the set, whatever the period',
  })
  readonly health: ReplaySetHealthResponseDto;

  @ApiProperty({
    type: ReplayedBaselineResponseDto,
    nullable: true,
    description:
      'The live config replayed over the set, its newest valid baseline whatever the period; null while it has none',
  })
  readonly baseline: ReplayedBaselineResponseDto | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'USD',
    description:
      'The currency its chart is drawn in: the baseline’s, else the newest candidate’s',
  })
  readonly chartCurrency: string | null;

  @ApiProperty({
    type: ReplayedCandidateResponseDto,
    isArray: true,
    description:
      'Candidates that searches which started in the period replayed over it, the largest gain against live first and those without one last, newest first among equals',
  })
  readonly candidates: ReplayedCandidateResponseDto[];

  constructor(set: ReplayedSetDto) {
    this.setId = set.setId;
    this.stationGone = set.stationGone;
    this.health = new ReplaySetHealthResponseDto(set.health);
    this.baseline = set.baseline
      ? new ReplayedBaselineResponseDto(set.baseline)
      : null;
    this.chartCurrency = set.chartCurrency;
    this.candidates = set.candidates.map(
      (each) => new ReplayedCandidateResponseDto(each),
    );
  }
}

export class ReplayedStationResponseDto {
  @ApiProperty()
  readonly lineId: string;

  @ApiProperty()
  readonly stationId: string;

  @ApiProperty({ type: ReplayedSetResponseDto, isArray: true })
  readonly sets: ReplayedSetResponseDto[];

  constructor(station: ReplayedStationDto) {
    this.lineId = station.lineId;
    this.stationId = station.stationId;
    this.sets = station.sets.map((each) => new ReplayedSetResponseDto(each));
  }
}

export class ReplayedCandidatesResponseDto {
  @ApiProperty({ type: ReplayedPeriodResponseDto })
  readonly period: ReplayedPeriodResponseDto;

  @ApiProperty({
    description:
      'Whether the team replayed more in the period than one answer covers, so the oldest are left out',
  })
  readonly truncated: boolean;

  @ApiProperty({
    type: ReplayedStationResponseDto,
    isArray: true,
    description:
      'Stations with a candidate replayed in the period, newest first',
  })
  readonly stations: ReplayedStationResponseDto[];

  constructor(candidates: ReplayedCandidatesDto) {
    this.period = new ReplayedPeriodResponseDto(candidates.period);
    this.truncated = candidates.truncated;
    this.stations = candidates.stations.map(
      (each) => new ReplayedStationResponseDto(each),
    );
  }
}
