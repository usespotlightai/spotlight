import { ApiProperty } from '@nestjs/swagger';
import type {
  RunCostDto,
  RunOutcomeDto,
} from '@outcomes/application/dto/run-outcome.dto';
import type {
  ConfigInForceDto,
  FingerprintGroupDto,
  StationConfigPullRequestDto,
  StationOutcomesDto,
} from '@outcomes/application/dto/station-outcomes.dto';
import type {
  RunTally,
  TallyShares,
} from '@outcomes/domain/services/run-tally';
import { CHECK_VERDICTS } from '@outcomes/domain/value-objects/check-verdict';
import { DELIVERY_STATES } from '@outcomes/domain/value-objects/delivery-state';
import { NEXT_ACTS } from '@outcomes/domain/value-objects/next-act.vo';
import { RUN_ENDINGS } from '@outcomes/domain/value-objects/run-ending';
import {
  ConfigChangeResponseDto,
  StationConfigResponseDto,
} from '@outcomes/presentation/http/dto/station-config.response.dto';

export class RunCostResponseDto {
  @ApiProperty({ nullable: true, type: Number, example: 184_000 })
  readonly ms: number | null;

  @ApiProperty({ example: 42 })
  readonly steps: number;

  @ApiProperty({ example: 1 })
  readonly faults: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 120_000,
    description: 'Tokens of context used',
  })
  readonly used: number | null;

  @ApiProperty({ nullable: true, type: Number, example: 0.42 })
  readonly cost: number | null;

  @ApiProperty({ nullable: true, type: String, example: 'USD' })
  readonly currency: string | null;

  constructor(cost: RunCostDto) {
    this.ms = cost.ms;
    this.steps = cost.steps;
    this.faults = cost.faults;
    this.used = cost.used;
    this.cost = cost.cost;
    this.currency = cost.currency;
  }
}

export class NextActResponseDto {
  @ApiProperty({ enum: NEXT_ACTS })
  readonly act: string;

  @ApiProperty({ example: '2026-09-30T10:05:00.000Z' })
  readonly at: string;

  constructor(next: { act: string; at: string }) {
    this.act = next.act;
    this.at = next.at;
  }
}

export class StationPassResponseDto {
  @ApiProperty({
    example: 'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80',
    description: 'The station the run passed its task to',
  })
  readonly to: string;

  @ApiProperty({ example: '2026-09-30T10:05:00.000Z' })
  readonly at: string;

  constructor(pass: { to: string; at: string }) {
    this.to = pass.to;
    this.at = pass.at;
  }
}

export class StationRunOutcomeResponseDto {
  @ApiProperty({ example: '4e1e84a2-0c39-406d-bbbb-559f29e450be' })
  readonly runId: string;

  @ApiProperty({ example: 'a17c4e02-9b3d-4f61-8e5a-0c2d7b9f4a13' })
  readonly taskId: string;

  @ApiProperty({ example: '2026-09-30T10:00:00.000Z' })
  readonly endedAt: string;

  @ApiProperty({ enum: RUN_ENDINGS })
  readonly ending: string;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'exited',
    description: 'Why it failed, where it did',
  })
  readonly failure: string | null;

  @ApiProperty({
    example: 2,
    description:
      'How many runs this station has taken on the task, this one included',
  })
  readonly round: number;

  @ApiProperty({ type: RunCostResponseDto, nullable: true })
  readonly cost: RunCostResponseDto | null;

  @ApiProperty({
    enum: [...CHECK_VERDICTS, null],
    nullable: true,
    description: 'How its change fared when checked, if it was',
  })
  readonly checks: string | null;

  @ApiProperty({
    type: NextActResponseDto,
    nullable: true,
    description: 'The first thing a person did with the task after the run',
  })
  readonly next: NextActResponseDto | null;

  @ApiProperty({
    type: StationPassResponseDto,
    nullable: true,
    description: 'The station the run passed its task to, if it did',
  })
  readonly passed: StationPassResponseDto | null;

  @ApiProperty({
    enum: [...DELIVERY_STATES, null],
    nullable: true,
    description: 'The status of the task’s pull request, if it opened one',
  })
  readonly delivery: string | null;

  constructor(outcome: RunOutcomeDto) {
    this.runId = outcome.runId;
    this.taskId = outcome.taskId;
    this.endedAt = outcome.endedAt;
    this.ending = outcome.ending;
    this.failure = outcome.failure;
    this.round = outcome.round;
    this.cost = outcome.cost ? new RunCostResponseDto(outcome.cost) : null;
    this.checks = outcome.checks;
    this.next = outcome.next ? new NextActResponseDto(outcome.next) : null;
    this.passed = outcome.passed
      ? new StationPassResponseDto(outcome.passed)
      : null;
    this.delivery = outcome.delivery;
  }
}

export class SpendResponseDto {
  @ApiProperty({ example: 3.2 })
  readonly amount: number;

  @ApiProperty({ example: 'USD' })
  readonly currency: string;

  constructor(spend: { amount: number; currency: string }) {
    this.amount = spend.amount;
    this.currency = spend.currency;
  }
}

export class RunTallyResponseDto {
  @ApiProperty({
    example: 12,
    description: 'Runs that ran; the rest of the tally counts only these',
  })
  readonly runs: number;

  @ApiProperty({
    example: 1,
    description: 'Runs cancelled before they ran',
  })
  readonly cancelled: number;

  @ApiProperty({ example: 2 })
  readonly failed: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.17,
    description: 'Failed runs as a share of the runs; none where none ran',
  })
  readonly failedShare: number | null;

  @ApiProperty({ example: 1, description: 'Runs a person stopped' })
  readonly stopped: number;

  @ApiProperty({ example: 8 })
  readonly checksPassed: number;

  @ApiProperty({ example: 1 })
  readonly checksFailed: number;

  @ApiProperty({
    example: 6,
    description: 'Runs a person next closed or approved',
  })
  readonly accepted: number;

  @ApiProperty({
    example: 3,
    description: 'Runs a person next sent back or refused',
  })
  readonly sentBack: number;

  @ApiProperty({
    example: 2,
    description: 'Runs that passed their task to another station',
  })
  readonly passed: number;

  @ApiProperty({
    example: 4,
    description: 'Tasks among these runs whose pull request merged',
  })
  readonly merged: number;

  @ApiProperty({
    type: SpendResponseDto,
    nullable: true,
    description: 'What the runs cost together, where they cost one currency',
  })
  readonly cost: SpendResponseDto | null;

  @ApiProperty({
    example: 1,
    description: 'Runs that ran with no price',
  })
  readonly unpriced: number;

  @ApiProperty({
    example: false,
    description:
      'Whether the priced runs came in more than one currency, so nothing was summed',
  })
  readonly mixedCurrencies: boolean;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 184_000,
    description: 'The median time the runs took, from their digests',
  })
  readonly medianMs: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 420_000,
    description: 'The time nine in ten of the runs took no longer than',
  })
  readonly p90Ms: number | null;

  constructor(tally: RunTally) {
    this.runs = tally.runs;
    this.cancelled = tally.cancelled;
    this.failed = tally.failed;
    this.failedShare = tally.failedShare;
    this.stopped = tally.stopped;
    this.checksPassed = tally.checksPassed;
    this.checksFailed = tally.checksFailed;
    this.accepted = tally.accepted;
    this.sentBack = tally.sentBack;
    this.passed = tally.passed;
    this.merged = tally.merged;
    this.cost = tally.cost ? new SpendResponseDto(tally.cost) : null;
    this.unpriced = tally.unpriced;
    this.mixedCurrencies = tally.mixedCurrencies;
    this.medianMs = tally.medianMs;
    this.p90Ms = tally.p90Ms;
  }
}

export class TallySharesResponseDto {
  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.89,
    description:
      'Runs whose checks passed as a share of the runs checked; none where none were',
  })
  readonly checksPassed: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.5,
    description: 'Runs a person accepted as a share of the runs that ran',
  })
  readonly accepted: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.33,
    description: 'Merged tasks as a share of the runs that ran',
  })
  readonly merged: number | null;

  constructor(shares: TallyShares) {
    this.checksPassed = shares.checksPassed;
    this.accepted = shares.accepted;
    this.merged = shares.merged;
  }
}

export class StationConfigPullRequestResponseDto {
  @ApiProperty({
    example: 'https://github.com/acme/platform/pull/42',
    description: 'The pull request’s page on GitHub',
  })
  readonly url: string;

  constructor(pullRequest: StationConfigPullRequestDto) {
    this.url = pullRequest.url;
  }
}

export class FingerprintGroupResponseDto {
  @ApiProperty({
    example: 'run_8f2c',
    description:
      'The group’s oldest listed run: the run that started its config, or for a group carrying on the config of a run from before the listing, a group with no config, or a group of a config that never ran, its oldest run',
  })
  readonly firstRunId: string;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'a3f9…',
    description:
      'The station config in force when these runs started, or for a group that never ran its config, the config its runs were meant to run; none only for runs from before the station first ran a config',
  })
  readonly fingerprint: string | null;

  @ApiProperty({
    description:
      'Whether the group’s config is one the station ran: false for runs meant for a config other than the one in force that never ran it (never started, failed to provision or cancelled), which are kept apart from the group in force',
  })
  readonly ran: boolean;

  @ApiProperty({ type: StationConfigResponseDto, nullable: true })
  readonly config: StationConfigResponseDto | null;

  @ApiProperty({
    type: ConfigChangeResponseDto,
    isArray: true,
    description:
      'How the config differs from the last one the station ran before the group, listed or not, groups that never ran their config passed over; none where either config is not on record, or for a group carrying on the config in force',
  })
  readonly changes: readonly ConfigChangeResponseDto[];

  @ApiProperty({
    type: StationConfigPullRequestResponseDto,
    nullable: true,
    description:
      'The pull request Spotlight opened that proposes the group’s config, the latest opened where it opened more than one; none where Spotlight opened none, or for a group with no config',
  })
  readonly pullRequest: StationConfigPullRequestResponseDto | null;

  @ApiProperty({
    type: StationRunOutcomeResponseDto,
    isArray: true,
    description:
      'Its runs that ended, the latest-started first, so the groups’ runs read in turn are the station’s latest-started runs',
  })
  readonly runs: readonly StationRunOutcomeResponseDto[];

  @ApiProperty({ type: RunTallyResponseDto })
  readonly tally: RunTallyResponseDto;

  @ApiProperty({ type: TallySharesResponseDto })
  readonly shares: TallySharesResponseDto;

  @ApiProperty({
    nullable: true,
    type: String,
    example: '2026-09-28',
    description: 'The day its earliest-ended run ended; none where none ended',
  })
  readonly firstDay: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: '2026-09-30',
    description: 'The day its latest-ended run ended; none where none ended',
  })
  readonly lastDay: string | null;

  constructor(group: FingerprintGroupDto) {
    this.firstRunId = group.firstRunId;
    this.fingerprint = group.fingerprint;
    this.ran = group.ran;
    this.config = group.config
      ? new StationConfigResponseDto(group.config)
      : null;
    this.changes = group.changes.map(
      (each) => new ConfigChangeResponseDto(each),
    );
    this.pullRequest = group.pullRequest
      ? new StationConfigPullRequestResponseDto(group.pullRequest)
      : null;
    this.runs = group.runs.map(
      (each) => new StationRunOutcomeResponseDto(each),
    );
    this.tally = new RunTallyResponseDto(group.tally);
    this.shares = new TallySharesResponseDto(group.shares);
    this.firstDay = group.firstDay;
    this.lastDay = group.lastDay;
  }
}

export class ConfigInForceResponseDto {
  @ApiProperty({
    type: RunTallyResponseDto,
    description:
      'One tally over the listed runs of the config the station last ran, as of the listed runs, back to its last change to another config it ran; runs meant for a config that never ran them, between, leave the stretch whole and are not counted',
  })
  readonly tally: RunTallyResponseDto;

  constructor(inForce: ConfigInForceDto) {
    this.tally = new RunTallyResponseDto(inForce.tally);
  }
}

export class StationOutcomesResponseDto {
  @ApiProperty({ example: 'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80' })
  readonly stationId: string;

  @ApiProperty({
    type: FingerprintGroupResponseDto,
    isArray: true,
    description:
      'The station’s latest-started runs in groups, the newest first, in the order the runs started: a new group starts at every run that ran a config other than the station’s run before it that ran one, listed or not; a run meant for another config than the one in force that never ran it (never started, failed to provision or cancelled) starts or joins a group of that config that never ran, and the group in force starts again after it; a run with no config joins the group in force',
  })
  readonly groups: readonly FingerprintGroupResponseDto[];

  @ApiProperty({
    type: ConfigInForceResponseDto,
    nullable: true,
    description:
      'The config the station last ran, as of the listed runs, with its tally; there under a config carried on from before the listing even when no listed run ran a config, and none when the station had run no config by the newest listed run',
  })
  readonly inForce: ConfigInForceResponseDto | null;

  constructor(outcomes: StationOutcomesDto) {
    this.stationId = outcomes.stationId;
    this.groups = outcomes.groups.map(
      (each) => new FingerprintGroupResponseDto(each),
    );
    this.inForce = outcomes.inForce
      ? new ConfigInForceResponseDto(outcomes.inForce)
      : null;
  }
}
