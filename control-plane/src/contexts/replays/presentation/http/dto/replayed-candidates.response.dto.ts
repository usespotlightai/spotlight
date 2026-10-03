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
  ReplayedStationDto,
  ReplaySetHealthDto,
} from '@replays/application/dto/replayed-candidates.dto';
import { REPLAY_STATES } from '@replays/domain/value-objects/replay-state';
import { REPLAYED_PERIODS } from '@replays/domain/value-objects/replayed-period.vo';
import { SEARCH_STATES } from '@replays/domain/value-objects/search-state';
import { CandidatePullRequestResponseDto } from '@replays/presentation/http/dto/config-pull-requests.response.dto';
import { StationChangeResponseDto } from '@replays/presentation/http/dto/replay-candidate-resource.response.dto';
import {
  GainReadingResponseDto,
  gainResponse,
  intervalResponse,
  RateIntervalResponseDto,
  SetNoiseResponseDto,
} from '@replays/presentation/http/dto/replays.response.dto';

const RATE =
  'A success rate, 0 to 1, of the past runs it was scored on, each a replay of one past run; a task worked twice counts twice';

const PER_RUN =
  'What it spent per scored run; unknown while any of it went unpriced or was in another currency';

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

export class ReplaySetHealthResponseDto {
  @ApiProperty({
    description:
      'How many distinct tasks its runs worked; fewer than its runs when a task was worked more than once',
  })
  readonly tasks: number;

  @ApiProperty({ description: 'How many past runs the set holds now' })
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
    description: 'When a task was last added to it; null while it holds none',
  })
  readonly lastAddedAt: string | null;

  @ApiProperty({
    nullable: true,
    type: SetNoiseResponseDto,
    description:
      'How much its success moves between copies of the same runs under the live config; null until a finished live replay ran it more than once',
  })
  readonly noise: SetNoiseResponseDto | null;

  @ApiProperty({
    example: 0.05,
    description: 'The smallest gain in success its line counts as real',
  })
  readonly minGain: number;

  constructor(health: ReplaySetHealthDto) {
    this.tasks = health.tasks;
    this.runs = health.runs;
    this.oldestRunEndedAt = health.oldestRunEndedAt;
    this.newestRunEndedAt = health.newestRunEndedAt;
    this.lastAddedAt = health.lastAddedAt;
    this.noise = health.noise ? new SetNoiseResponseDto(health.noise) : null;
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
      'The live config’s success rate on the searched runs, 0 to 1, as the search page shows the seed’s search score',
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

  constructor(seed: ReplayedSeedDto) {
    this.successRate = seed.successRate;
    this.interval = intervalResponse(seed.interval);
    this.costPerRun = seed.costPerRun;
    this.scored = seed.scored;
  }
}

export class ReplayedSearchResponseDto {
  @ApiProperty()
  readonly searchId: string;

  @ApiProperty({ enum: SEARCH_STATES })
  readonly state: string;

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
    enum: ['searched', 'proposed'],
    description:
      'Found by a search, or proposed by a person or Terraform; pull-request checks are left out',
  })
  readonly kind: 'searched' | 'proposed';

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
    description:
      'Its replay: on the searched tasks when searched, of the whole set when proposed',
  })
  readonly replayId: string;

  @ApiProperty({ nullable: true, enum: [...REPLAY_STATES, null], type: String })
  readonly replayState: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: '2026-09-30T08:05:00.000Z',
    description:
      'When the replay shown started: for a proposed candidate, its newest finished replay in the period, else its newest; null while a searched candidate’s replay cannot be found',
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
      'Its replay success rate, 0 to 1, over all the runs it was scored on, scored by its own checks and judge; not how live runs went. The search score when searched, as its search page shows it; as its replay page totals it when proposed',
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
      'Compared runs it did worse on than the baseline, as the replay page counts them; null without a baseline',
  })
  readonly regressions: number | null;

  @ApiProperty({
    description:
      'How many of its runs the baseline replayed too: the runs live and successRateOnCompared cover',
  })
  readonly compared: number;

  @ApiProperty({
    nullable: true,
    type: GainReadingResponseDto,
    description:
      'Its gain in success over the baseline on the compared runs, paired task by task, and whether it is within noise; null without a baseline',
  })
  readonly againstLive: GainReadingResponseDto | null;

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

  constructor(candidate: ReplayedCandidateDto) {
    this.candidateId = candidate.candidateId;
    this.name = candidate.name;
    this.kind = candidate.kind;
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
    this.againstLive = gainResponse(candidate.againstLive);
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
  }
}

export class ReplayedSetResponseDto {
  @ApiProperty()
  readonly setId: string;

  @ApiProperty({ example: 'Queue fixes' })
  readonly name: string;

  @ApiProperty({ description: 'Whether its station has left its line' })
  readonly stationGone: boolean;

  @ApiProperty({
    description:
      'Whether it checks every pull request that changes its station',
  })
  readonly guardsChanges: boolean;

  @ApiProperty({
    type: ReplaySetHealthResponseDto,
    description: 'How the set stands now, whatever the period',
  })
  readonly health: ReplaySetHealthResponseDto;

  @ApiProperty({
    type: ReplayedBaselineResponseDto,
    nullable: true,
    description:
      'The live config replayed over the set, its newest standing baseline whatever the period; null while it has none',
  })
  readonly baseline: ReplayedBaselineResponseDto | null;

  @ApiProperty({
    type: ReplayedCandidateResponseDto,
    isArray: true,
    description:
      'Candidates replayed over it in the period, newest first: searched ones whose search started in it, proposed ones whose replay did',
  })
  readonly candidates: ReplayedCandidateResponseDto[];

  constructor(set: ReplayedSetDto) {
    this.setId = set.setId;
    this.name = set.name;
    this.stationGone = set.stationGone;
    this.guardsChanges = set.guardsChanges;
    this.health = new ReplaySetHealthResponseDto(set.health);
    this.baseline = set.baseline
      ? new ReplayedBaselineResponseDto(set.baseline)
      : null;
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
