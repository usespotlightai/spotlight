import { ApiProperty } from '@nestjs/swagger';
import {
  JournalStepResponseDto,
  RunSpanResponseDto,
} from '@presentation/http/dto/run-journal.response.dto';

const KINDS = ['run', 'phase', 'step', 'span'];
const TONES = ['agent', 'overhead', 'failed'];

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
