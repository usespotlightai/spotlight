import { ApiProperty } from '@nestjs/swagger';
import type {
  InsightsRunDto,
  InsightsRunsDto,
  TokenCountsDto,
} from '@outcomes/application/dto/insights.dto';
import { CHECK_VERDICTS } from '@outcomes/domain/value-objects/check-verdict';
import { DELIVERY_STATES } from '@outcomes/domain/value-objects/delivery-state';
import { RUN_ENDINGS } from '@outcomes/domain/value-objects/run-ending';
import {
  InsightsPeriodResponseDto,
  PersonNameResponseDto,
} from '@outcomes/presentation/http/dto/insights-common.response.dto';
import {
  HandedOnResponseDto,
  NextActResponseDto,
  SpendResponseDto,
} from '@outcomes/presentation/http/dto/station-outcomes.response.dto';

export class TokenCountsResponseDto {
  @ApiProperty({ nullable: true, type: Number, example: 1_200 })
  readonly input: number | null;

  @ApiProperty({ nullable: true, type: Number, example: 900 })
  readonly output: number | null;

  @ApiProperty({ nullable: true, type: Number, example: 80_000 })
  readonly cacheRead: number | null;

  @ApiProperty({ nullable: true, type: Number, example: null })
  readonly cacheWrite: number | null;

  constructor(tokens: TokenCountsDto) {
    this.input = tokens.input;
    this.output = tokens.output;
    this.cacheRead = tokens.cacheRead;
    this.cacheWrite = tokens.cacheWrite;
  }
}

export class InsightsRunResponseDto {
  @ApiProperty({ example: '4e1e84a2-0c39-406d-bbbb-559f29e450be' })
  readonly runId: string;

  @ApiProperty({ example: 'a17c4e02-9b3d-4f61-8e5a-0c2d7b9f4a13' })
  readonly taskId: string;

  @ApiProperty({ example: 'b0c7e1f4-1a2b-4c3d-9e8f-7a6b5c4d3e2f' })
  readonly lineId: string;

  @ApiProperty({ example: 'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80' })
  readonly stationId: string;

  @ApiProperty({ nullable: true, type: String, example: 'a3f9…' })
  readonly fingerprint: string | null;

  @ApiProperty({ example: 'claude-code' })
  readonly harness: string;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'claude-sonnet-4',
    description: 'None where the harness chose its own',
  })
  readonly model: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'high' })
  readonly effort: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'careful' })
  readonly profileKey: string | null;

  @ApiProperty({ type: String, isArray: true, example: ['acme/api'] })
  readonly repositories: readonly string[];

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'user_ada',
    description:
      'Who opened the run’s task; none where no person did; their name is in people',
  })
  readonly openedBy: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly queuedAt: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'When a runner first took it; none if none did',
  })
  readonly startedAt: string | null;

  @ApiProperty({ example: '2026-09-30T10:00:00.000Z' })
  readonly endedAt: string;

  @ApiProperty({ nullable: true, type: Number, example: 30_000 })
  readonly queuedMs: number | null;

  @ApiProperty({ nullable: true, type: Number, example: 190_000 })
  readonly runningMs: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 184_000,
    description: 'How long it worked, by its digest',
  })
  readonly ms: number | null;

  @ApiProperty({ type: SpendResponseDto, nullable: true })
  readonly cost: SpendResponseDto | null;

  @ApiProperty({
    type: TokenCountsResponseDto,
    nullable: true,
    description: 'None until its digest is in',
  })
  readonly tokens: TokenCountsResponseDto | null;

  @ApiProperty({ enum: RUN_ENDINGS })
  readonly ending: string;

  @ApiProperty({ nullable: true, type: String, example: 'exited' })
  readonly failure: string | null;

  @ApiProperty({ enum: [...CHECK_VERDICTS, null], nullable: true })
  readonly checks: string | null;

  @ApiProperty({ type: NextActResponseDto, nullable: true })
  readonly next: NextActResponseDto | null;

  @ApiProperty({ type: HandedOnResponseDto, nullable: true })
  readonly handedOn: HandedOnResponseDto | null;

  @ApiProperty({ enum: [...DELIVERY_STATES, null], nullable: true })
  readonly delivery: string | null;

  constructor(run: InsightsRunDto) {
    this.runId = run.runId;
    this.taskId = run.taskId;
    this.lineId = run.lineId;
    this.stationId = run.stationId;
    this.fingerprint = run.fingerprint;
    this.harness = run.harness;
    this.model = run.model;
    this.effort = run.effort;
    this.profileKey = run.profileKey;
    this.repositories = run.repositories;
    this.openedBy = run.openedBy;
    this.queuedAt = run.queuedAt;
    this.startedAt = run.startedAt;
    this.endedAt = run.endedAt;
    this.queuedMs = run.queuedMs;
    this.runningMs = run.runningMs;
    this.ms = run.ms;
    this.cost = run.cost ? new SpendResponseDto(run.cost) : null;
    this.tokens = run.tokens ? new TokenCountsResponseDto(run.tokens) : null;
    this.ending = run.ending;
    this.failure = run.failure;
    this.checks = run.checks;
    this.next = run.next ? new NextActResponseDto(run.next) : null;
    this.handedOn = run.handedOn ? new HandedOnResponseDto(run.handedOn) : null;
    this.delivery = run.delivery;
  }
}

export class InsightsRunsResponseDto {
  @ApiProperty({ type: InsightsPeriodResponseDto })
  readonly period: InsightsPeriodResponseDto;

  @ApiProperty({ example: 64, description: 'Runs matching, on every page' })
  readonly total: number;

  @ApiProperty({ example: 1 })
  readonly page: number;

  @ApiProperty({ example: 50 })
  readonly size: number;

  @ApiProperty({
    type: InsightsRunResponseDto,
    isArray: true,
    description: 'The newest first',
  })
  readonly runs: readonly InsightsRunResponseDto[];

  @ApiProperty({ type: PersonNameResponseDto, isArray: true })
  readonly people: readonly PersonNameResponseDto[];

  constructor(runs: InsightsRunsDto) {
    this.period = new InsightsPeriodResponseDto(runs.period);
    this.total = runs.total;
    this.page = runs.page;
    this.size = runs.size;
    this.runs = runs.runs.map((each) => new InsightsRunResponseDto(each));
    this.people = runs.people.map((each) => new PersonNameResponseDto(each));
  }
}
