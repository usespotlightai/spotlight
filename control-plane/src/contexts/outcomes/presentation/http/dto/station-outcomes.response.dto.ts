import { ApiProperty } from '@nestjs/swagger';
import type {
  RunCostDto,
  RunOutcomeDto,
} from '@outcomes/application/dto/run-outcome.dto';
import type {
  FingerprintGroupDto,
  StationOutcomesDto,
} from '@outcomes/application/dto/station-outcomes.dto';
import type { RunTally } from '@outcomes/domain/services/run-tally';
import { CHECK_VERDICTS } from '@outcomes/domain/value-objects/check-verdict';
import { DELIVERY_STATES } from '@outcomes/domain/value-objects/delivery-state';
import { PERSON_ACTS } from '@outcomes/domain/value-objects/next-act.vo';
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
  @ApiProperty({ enum: PERSON_ACTS })
  readonly act: string;

  @ApiProperty({ example: '2026-09-30T10:05:00.000Z' })
  readonly at: string;

  constructor(next: { act: string; at: string }) {
    this.act = next.act;
    this.at = next.at;
  }
}

export class HandedOnResponseDto {
  @ApiProperty({
    example: 'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80',
    description: 'The station the run moved its task on to',
  })
  readonly to: string;

  @ApiProperty({ example: '2026-09-30T10:05:00.000Z' })
  readonly at: string;

  constructor(handedOn: { to: string; at: string }) {
    this.to = handedOn.to;
    this.at = handedOn.at;
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
    type: HandedOnResponseDto,
    nullable: true,
    description: 'Where the run moved its task on to, if it did',
  })
  readonly handedOn: HandedOnResponseDto | null;

  @ApiProperty({
    enum: [...DELIVERY_STATES, null],
    nullable: true,
    description: 'Where the task’s pull request stands, if it opened one',
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
    this.handedOn = outcome.handedOn
      ? new HandedOnResponseDto(outcome.handedOn)
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
    description: 'Runs withdrawn from the queue before they ran',
  })
  readonly withdrawn: number;

  @ApiProperty({ example: 2 })
  readonly failed: number;

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
    description: 'Runs that moved their task on to another station',
  })
  readonly handedOn: number;

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
    this.withdrawn = tally.withdrawn;
    this.failed = tally.failed;
    this.stopped = tally.stopped;
    this.checksPassed = tally.checksPassed;
    this.checksFailed = tally.checksFailed;
    this.accepted = tally.accepted;
    this.sentBack = tally.sentBack;
    this.handedOn = tally.handedOn;
    this.merged = tally.merged;
    this.cost = tally.cost ? new SpendResponseDto(tally.cost) : null;
    this.unpriced = tally.unpriced;
    this.mixedCurrencies = tally.mixedCurrencies;
    this.medianMs = tally.medianMs;
    this.p90Ms = tally.p90Ms;
  }
}

export class FingerprintGroupResponseDto {
  @ApiProperty({
    nullable: true,
    type: String,
    example: 'a3f9…',
    description:
      'The station config these runs ran with; none for runs from before configs were fingerprinted',
  })
  readonly fingerprint: string | null;

  @ApiProperty({ type: StationConfigResponseDto, nullable: true })
  readonly config: StationConfigResponseDto | null;

  @ApiProperty({
    type: ConfigChangeResponseDto,
    isArray: true,
    description: 'How the config differs from the one before it',
  })
  readonly changes: readonly ConfigChangeResponseDto[];

  @ApiProperty({
    type: StationRunOutcomeResponseDto,
    isArray: true,
    description: 'Its runs, the newest first',
  })
  readonly runs: readonly StationRunOutcomeResponseDto[];

  @ApiProperty({ type: RunTallyResponseDto })
  readonly tally: RunTallyResponseDto;

  constructor(group: FingerprintGroupDto) {
    this.fingerprint = group.fingerprint;
    this.config = group.config
      ? new StationConfigResponseDto(group.config)
      : null;
    this.changes = group.changes.map(
      (each) => new ConfigChangeResponseDto(each),
    );
    this.runs = group.runs.map(
      (each) => new StationRunOutcomeResponseDto(each),
    );
    this.tally = new RunTallyResponseDto(group.tally);
  }
}

export class StationOutcomesResponseDto {
  @ApiProperty({ example: 'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80' })
  readonly stationId: string;

  @ApiProperty({
    type: FingerprintGroupResponseDto,
    isArray: true,
    description:
      'The station’s latest runs, in runs of the same config, the newest first',
  })
  readonly groups: readonly FingerprintGroupResponseDto[];

  constructor(outcomes: StationOutcomesDto) {
    this.stationId = outcomes.stationId;
    this.groups = outcomes.groups.map(
      (each) => new FingerprintGroupResponseDto(each),
    );
  }
}
