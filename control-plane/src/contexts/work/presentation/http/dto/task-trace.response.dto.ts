import { ApiProperty } from '@nestjs/swagger';
import type { TraceConnectionDto } from '@work/application/dto/task-trace.dto';
import {
  CONNECTION_OUTCOMES,
  CONNECTION_REASONS,
  CONNECTION_TROUBLES,
} from '@work/domain/value-objects/run-connection.vo';
import {
  JournalStepResponseDto,
  RunSpanResponseDto,
} from '@work/presentation/http/dto/run-journal.response.dto';

const KINDS = ['run', 'phase', 'step', 'span', 'connection'];
const TONES = ['agent', 'overhead', 'failed'];

export class TraceConnectionResponseDto {
  @ApiProperty({ example: 'paste.example.net' })
  readonly host: string;

  @ApiProperty({ example: 443 })
  readonly port: number;

  @ApiProperty({
    enum: CONNECTION_OUTCOMES,
    description:
      'blocked: egress stopped it. failed: egress could not open it. forwarded: the host refused or failed a request egress added a secret to',
  })
  readonly outcome: string;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 401,
    description: 'The status the host answered a forwarded request with',
  })
  readonly status: number | null;

  @ApiProperty({
    enum: [...CONNECTION_REASONS, null],
    nullable: true,
    description: 'Why egress blocked the connection or could not open it',
  })
  readonly reason: string | null;

  @ApiProperty({
    enum: [...CONNECTION_TROUBLES, null],
    nullable: true,
    description:
      'What went wrong. blocked: egress stopped it. failed: egress could not open it. refused: the host answered a forwarded request with 401 or 403. server-error: the host answered it with 500 or more. null: nothing went wrong',
  })
  readonly trouble: string | null;

  @ApiProperty({
    example: 3,
    description:
      'How many times the same thing went wrong in this row. The row starts at the first time',
  })
  readonly times: number;

  constructor(connection: TraceConnectionDto) {
    this.host = connection.host;
    this.port = connection.port;
    this.outcome = connection.outcome;
    this.status = connection.status;
    this.reason = connection.reason;
    this.trouble = connection.trouble;
    this.times = connection.times;
  }
}

export class TraceNodeResponseDto {
  @ApiProperty({ example: 'run:run_1' })
  readonly id: string;

  @ApiProperty({ enum: KINDS, example: 'run' })
  readonly kind: string;

  @ApiProperty({ example: 'Implementation' })
  readonly name: string;

  @ApiProperty({ example: '2026-09-01T13:25:04.000Z' })
  readonly startedAt: string;

  @ApiProperty({ example: 143_000, description: 'How long it took, in ms' })
  readonly ms: number;

  @ApiProperty({
    enum: TONES,
    example: 'agent',
    description: 'The agent working, the overhead around it, or a fault',
  })
  readonly tone: string;

  @ApiProperty({ nullable: true, type: Number, example: 4.97 })
  readonly cost: number | null;

  @ApiProperty({ nullable: true, type: String, example: 'USD' })
  readonly currency: string | null;

  @ApiProperty({ nullable: true, type: () => JournalStepResponseDto })
  readonly step: JournalStepResponseDto | null;

  @ApiProperty({ nullable: true, type: () => RunSpanResponseDto })
  readonly span: RunSpanResponseDto | null;

  @ApiProperty({
    nullable: true,
    type: () => TraceConnectionResponseDto,
    description:
      'On a connection row: a connection of the run that went wrong, as a shared egress recorded it',
  })
  readonly connection: TraceConnectionResponseDto | null;

  @ApiProperty({
    enum: ['enforced', 'not-enforced', null],
    nullable: true,
    description:
      'On a run row: what the runner in the sandbox reported before the harness started. enforced: a direct connection around egress failed. not-enforced: it operated. null: the runner did not check',
  })
  readonly egress: 'enforced' | 'not-enforced' | null;

  @ApiProperty({ type: () => [TraceNodeResponseDto] })
  readonly children: TraceNodeResponseDto[];

  constructor(
    id: string,
    kind: string,
    name: string,
    startedAt: string,
    ms: number,
    tone: string,
    cost: number | null,
    currency: string | null,
    step: JournalStepResponseDto | null,
    span: RunSpanResponseDto | null,
    connection: TraceConnectionResponseDto | null,
    egress: 'enforced' | 'not-enforced' | null,
    children: TraceNodeResponseDto[],
  ) {
    this.id = id;
    this.kind = kind;
    this.name = name;
    this.startedAt = startedAt;
    this.ms = ms;
    this.tone = tone;
    this.cost = cost;
    this.currency = currency;
    this.step = step;
    this.span = span;
    this.connection = connection;
    this.egress = egress;
    this.children = children;
  }
}

export class TaskTraceResponseDto {
  @ApiProperty({ nullable: true, type: String })
  readonly startedAt: string | null;

  @ApiProperty({ example: 2_423_000, description: 'First run to last, in ms' })
  readonly ms: number;

  @ApiProperty({ example: 454, description: 'How many rows it draws' })
  readonly rows: number;

  @ApiProperty({ example: 21 })
  readonly faults: number;

  @ApiProperty({ type: () => [TraceNodeResponseDto] })
  readonly roots: TraceNodeResponseDto[];

  constructor(
    startedAt: string | null,
    ms: number,
    rows: number,
    faults: number,
    roots: TraceNodeResponseDto[],
  ) {
    this.startedAt = startedAt;
    this.ms = ms;
    this.rows = rows;
    this.faults = faults;
    this.roots = roots;
  }
}
