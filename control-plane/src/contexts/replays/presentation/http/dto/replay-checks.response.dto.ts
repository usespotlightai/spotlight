import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  CheckRegressionDto,
  CheckSideDto,
  ReplayCheckDto,
  ReplayCheckSummaryDto,
} from '@replays/application/dto/replay-checks.dto';
import { SCORING_FIELDS } from '@replays/domain/services/live-scoring';
import {
  CHECK_RESULTS,
  UNDECIDED_BECAUSE,
} from '@replays/domain/services/replay-check-result';
import { MAX_REPEATS } from '@replays/domain/value-objects/replay-repeats';
import { REPLAY_STATES } from '@replays/domain/value-objects/replay-state';
import {
  GainEstimateResponseDto,
  gainResponse,
  intervalResponse,
  MoneyResponseDto,
  RateIntervalResponseDto,
} from '@replays/presentation/http/dto/replays.response.dto';

const ENTRY_RESULTS = ['pending', 'succeeded', 'failed', 'unscored'];

export class PlannedReferenceRequestDto {
  @ApiProperty({
    required: false,
    nullable: true,
    type: String,
    example: '4f7c2a9e1b3d5f8a0c6e2b4d7f9a1c3e5b8d0f2a',
    description: 'The commit that plans the change',
  })
  readonly commit?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    type: Number,
    example: 42,
    description: 'The pull request that plans the change',
  })
  readonly pullRequest?: number | null;
}

export class StartReplayCheckRequestDto {
  @ApiProperty({ example: '3f7a2c9e-5d18-4b6a-8e2f-1c9d7b4a6e03' })
  readonly lineId!: string;

  @ApiProperty({ example: 'build' })
  readonly stationKey!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'The station block as the plan would apply it, as the line resource stores a station; its check, judge, diffs and runners are replaced by the live station’s, since a planned change is scored as, and runs where, the live station does',
    example: {
      key: 'build',
      name: 'Build',
      kind: 'work',
      harness: 'claude-code',
      prompt: 'Build it, then drain the queue.',
      passesTo: ['ship'],
    },
  })
  readonly station!: Record<string, unknown>;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description:
      'The line’s settings that change how its stations run, as the plan would apply them: its repositories, each with its image and setup, as the line resource stores them',
    example: { repositories: [{ name: 'acme/api', setup: 'npm ci' }] },
  })
  readonly line?: Record<string, unknown>;

  @ApiProperty({ type: PlannedReferenceRequestDto, required: false })
  readonly reference?: PlannedReferenceRequestDto;

  @ApiProperty({
    required: false,
    example: 1,
    minimum: 1,
    maximum: MAX_REPEATS,
    description:
      'How many times the check replays each run of the set, 1 when left out; the line’s ceiling covers all of them',
  })
  readonly repeats?: number;
}

export class ReplayCheckThresholdResponseDto {
  @ApiProperty({
    example: 0,
    description:
      'How many tasks the change may regress on and still pass, taken from the live line’s replay_check when the check started',
  })
  readonly maxRegressions: number;

  @ApiProperty({
    example: 0.05,
    description:
      'The smallest gain in success the live line’s replay_check counts as real, when the check started',
  })
  readonly minGain: number;

  @ApiProperty({
    type: MoneyResponseDto,
    description:
      'The most each replay of the check may spend: the replay of the planned change and, when the set has no baseline of the live config yet, the baseline replay the check starts, each up to this ceiling on its own; a baseline already there costs the check nothing. A replay at its ceiling starts no more runs, though runs already going finish, so it may end a little over it',
  })
  readonly ceiling: MoneyResponseDto;

  @ApiProperty({
    type: MoneyResponseDto,
    nullable: true,
    description:
      'What a run that reports no price, or a price in another currency, counts against the ceiling: the ceiling shared out over the set’s runs; null once the replay is gone',
  })
  readonly unpricedRun: MoneyResponseDto | null;

  constructor(threshold: ReplayCheckDto['threshold']) {
    this.maxRegressions = threshold.maxRegressions;
    this.minGain = threshold.minGain;
    this.ceiling = new MoneyResponseDto(threshold.ceiling);
    this.unpricedRun =
      threshold.unpricedRun && new MoneyResponseDto(threshold.unpricedRun);
  }
}

export class ReplayCheckReferenceResponseDto {
  @ApiProperty({ nullable: true, type: String })
  readonly commit: string | null;

  @ApiProperty({ nullable: true, type: Number })
  readonly pullRequest: number | null;

  constructor(reference: ReplayCheckDto['reference']) {
    this.commit = reference.commit;
    this.pullRequest = reference.pullRequest;
  }
}

export class ReplayCheckSideResponseDto {
  @ApiProperty({
    enum: [...REPLAY_STATES, null],
    nullable: true,
    type: String,
    description: 'The replay’s state; null once it is gone',
  })
  readonly state: string | null;

  @ApiProperty()
  readonly entries: number;

  @ApiProperty()
  readonly scored: number;

  @ApiProperty({ nullable: true, type: Number })
  readonly succeeded: number | null;

  @ApiProperty({ nullable: true, type: Number })
  readonly successRate: number | null;

  @ApiProperty({
    nullable: true,
    type: RateIntervalResponseDto,
    description: 'The success rate with its 95% interval over the tasks',
  })
  readonly interval: RateIntervalResponseDto | null;

  @ApiProperty({ description: 'Tasks with at least one scored repeat' })
  readonly tasksScored: number;

  @ApiProperty({ type: MoneyResponseDto, nullable: true })
  readonly spent: MoneyResponseDto | null;

  constructor(side: CheckSideDto) {
    this.state = side.state;
    this.entries = side.entries;
    this.scored = side.scored;
    this.succeeded = side.succeeded;
    this.successRate = side.successRate;
    this.interval = intervalResponse(side.interval);
    this.tasksScored = side.tasksScored;
    this.spent = side.spent && new MoneyResponseDto(side.spent);
  }
}

export class ReplayCheckReasonResponseDto {
  @ApiProperty({ example: 'check-failed' })
  readonly code: string;

  @ApiProperty({ nullable: true, type: String })
  readonly detail: string | null;

  constructor(reason: CheckRegressionDto['reasons'][number]) {
    this.code = reason.code;
    this.detail = reason.detail;
  }
}

export class ReplayCheckRegressionResponseDto {
  @ApiProperty()
  readonly taskId: string;

  @ApiProperty()
  readonly originalRunId: string;

  @ApiProperty({ nullable: true, type: String })
  readonly title: string | null;

  @ApiProperty({
    enum: ENTRY_RESULTS,
    isArray: true,
    description: 'The result of each repeat the candidate replayed',
  })
  readonly candidate: string[];

  @ApiProperty({
    enum: ENTRY_RESULTS,
    isArray: true,
    description: 'The result of each repeat the baseline replayed',
  })
  readonly baseline: string[];

  @ApiProperty({ nullable: true, type: Number })
  readonly scoreDelta: number | null;

  @ApiProperty({ type: ReplayCheckReasonResponseDto, isArray: true })
  readonly reasons: ReplayCheckReasonResponseDto[];

  constructor(regression: CheckRegressionDto) {
    this.taskId = regression.taskId;
    this.originalRunId = regression.originalRunId;
    this.title = regression.title;
    this.candidate = [...regression.candidate];
    this.baseline = [...regression.baseline];
    this.scoreDelta = regression.scoreDelta;
    this.reasons = regression.reasons.map(
      (each) => new ReplayCheckReasonResponseDto(each),
    );
  }
}

export class ReplayCheckResponseDto {
  @ApiProperty({ example: '6a2d9f4c-1e83-4b7a-9c5d-2f8e0b3a7d61' })
  readonly id: string;

  @ApiProperty()
  readonly teamId: string;

  @ApiProperty()
  readonly lineId: string;

  @ApiProperty()
  readonly stationId: string;

  @ApiProperty({ example: 'build' })
  readonly stationKey: string;

  @ApiProperty({
    description: 'The replay set Spotlight keeps for the station',
  })
  readonly setId: string;

  @ApiProperty({ description: 'The planned candidate the check replays' })
  readonly candidateId: string;

  @ApiProperty()
  readonly replayId: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'The replay of the live config it is compared with: the newest baseline of the set replaying the live config the check was started against; null while that baseline is still being started',
  })
  readonly baselineReplayId: string | null;

  @ApiProperty({
    description:
      'Counts the checks of the same change against the same live config, from 1; a new attempt starts when an earlier one cannot be reused',
  })
  readonly attempt: number;

  @ApiProperty({ type: ReplayCheckReferenceResponseDto })
  readonly reference: ReplayCheckReferenceResponseDto;

  @ApiProperty()
  readonly liveFingerprint: string;

  @ApiProperty()
  readonly candidateFingerprint: string;

  @ApiProperty({
    enum: SCORING_FIELDS,
    isArray: true,
    description:
      'What the plan changed of how runs are scored, which the check pinned to the live station’s values',
  })
  readonly scoringPinnedToLive: string[];

  @ApiProperty({ type: ReplayCheckThresholdResponseDto })
  readonly threshold: ReplayCheckThresholdResponseDto;

  @ApiProperty({
    example: 1,
    description: 'How many times the check replays each run of the set',
  })
  readonly repeats: number;

  @ApiProperty({
    nullable: true,
    type: GainEstimateResponseDto,
    description:
      'The candidate’s gain in success over the baseline and whether it is within noise; it does not decide the result',
  })
  readonly gain: GainEstimateResponseDto | null;

  @ApiProperty({
    enum: CHECK_RESULTS,
    description:
      'failed as soon as more tasks regressed than the threshold allows; running while either replay runs; undecided when the replay stopped or reached its ceiling, the baseline did not finish, or fewer than half the tasks were scored on both sides; passed otherwise',
  })
  readonly result: string;

  @ApiProperty({
    enum: [...UNDECIDED_BECAUSE, null],
    nullable: true,
    type: String,
  })
  readonly undecidedBecause: string | null;

  @ApiProperty({
    description: 'How many tasks the station’s replay set replays',
  })
  readonly tasks: number;

  @ApiProperty({ description: 'How many tasks were scored on both sides' })
  readonly compared: number;

  @ApiProperty({ type: ReplayCheckSideResponseDto })
  readonly candidate: ReplayCheckSideResponseDto;

  @ApiProperty({ type: ReplayCheckSideResponseDto })
  readonly baseline: ReplayCheckSideResponseDto;

  @ApiProperty({ type: ReplayCheckRegressionResponseDto, isArray: true })
  readonly regressions: ReplayCheckRegressionResponseDto[];

  @ApiProperty({
    nullable: true,
    type: String,
    example:
      'https://app.usespotlight.ai/w/acme/team/9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84/lines/3f7a2c9e-5d18-4b6a-8e2f-1c9d7b4a6e03/stations/7b1d/replays/2e9c',
    description: 'Where the web app shows the check’s replay',
  })
  readonly replayUrl: string | null;

  @ApiProperty({
    description:
      'True when starting a check answered one this change already had against the same live config, set runs and threshold, rather than starting another; always false on a read',
  })
  readonly reused: boolean;

  @ApiProperty({ example: '2026-10-02T09:00:00.000Z' })
  readonly createdAt: string;

  constructor(check: ReplayCheckDto, reused = false) {
    this.id = check.id;
    this.teamId = check.teamId;
    this.lineId = check.lineId;
    this.stationId = check.stationId;
    this.stationKey = check.stationKey;
    this.setId = check.setId;
    this.candidateId = check.candidateId;
    this.replayId = check.replayId;
    this.baselineReplayId = check.baselineReplayId;
    this.attempt = check.attempt;
    this.reference = new ReplayCheckReferenceResponseDto(check.reference);
    this.liveFingerprint = check.liveFingerprint;
    this.candidateFingerprint = check.candidateFingerprint;
    this.scoringPinnedToLive = [...check.scoringPinnedToLive];
    this.threshold = new ReplayCheckThresholdResponseDto(check.threshold);
    this.repeats = check.repeats;
    this.gain = gainResponse(check.gain);
    this.result = check.result;
    this.undecidedBecause = check.undecidedBecause;
    this.tasks = check.tasks;
    this.compared = check.compared;
    this.candidate = new ReplayCheckSideResponseDto(check.candidate);
    this.baseline = new ReplayCheckSideResponseDto(check.baseline);
    this.regressions = check.regressions.map(
      (each) => new ReplayCheckRegressionResponseDto(each),
    );
    this.replayUrl = check.replayUrl;
    this.reused = reused;
    this.createdAt = check.createdAt;
  }
}

export class ReplayCheckSummaryResponseDto {
  @ApiProperty({ example: '6a2d9f4c-1e83-4b7a-9c5d-2f8e0b3a7d61' })
  readonly id: string;

  @ApiProperty()
  readonly stationId: string;

  @ApiProperty({ example: 'build' })
  readonly stationKey: string;

  @ApiProperty({ enum: CHECK_RESULTS })
  readonly result: string;

  @ApiProperty({
    enum: [...UNDECIDED_BECAUSE, null],
    nullable: true,
    type: String,
  })
  readonly undecidedBecause: string | null;

  @ApiProperty({ description: 'How many tasks the change regressed on' })
  readonly regressions: number;

  @ApiProperty({
    description:
      'Counts the checks of the same change against the same live config, from 1',
  })
  readonly attempt: number;

  @ApiProperty({ type: ReplayCheckReferenceResponseDto })
  readonly reference: ReplayCheckReferenceResponseDto;

  @ApiProperty({ example: '2026-10-02T09:00:00.000Z' })
  readonly createdAt: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Where the web app shows the check’s replay',
  })
  readonly replayUrl: string | null;

  constructor(check: ReplayCheckSummaryDto) {
    this.id = check.id;
    this.stationId = check.stationId;
    this.stationKey = check.stationKey;
    this.result = check.result;
    this.undecidedBecause = check.undecidedBecause;
    this.regressions = check.regressions;
    this.attempt = check.attempt;
    this.reference = new ReplayCheckReferenceResponseDto(check.reference);
    this.createdAt = check.createdAt;
    this.replayUrl = check.replayUrl;
  }
}
