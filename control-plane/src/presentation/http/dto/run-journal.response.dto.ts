import { STEP_KIND_NAMES } from '@application/dto/run-journal.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StepLocationResponseDto {
  @ApiProperty({ example: 'control-plane/src/app.module.ts' })
  readonly path: string;

  @ApiProperty({ example: 126, nullable: true, type: Number })
  readonly line: number | null;

  constructor(path: string, line: number | null) {
    this.path = path;
    this.line = line;
  }
}

export class StepChangeResponseDto {
  @ApiProperty({ nullable: true, type: String })
  readonly path: string | null;

  @ApiProperty({ description: 'The file as it stood' })
  readonly before: string;

  @ApiProperty({ description: 'The file as the agent left it' })
  readonly after: string;

  constructor(path: string | null, before: string, after: string) {
    this.path = path;
    this.before = before;
    this.after = after;
  }
}

export class JournalStepResponseDto {
  @ApiProperty({ example: 'tool', enum: STEP_KIND_NAMES })
  readonly kind: string;

  @ApiProperty({ example: 'ToolSearch' })
  readonly text: string;

  @ApiProperty({ nullable: true, type: String, example: 'completed' })
  readonly status: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'execute',
    description: 'What sort of tool it was: execute, read, edit, …',
  })
  readonly tool: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'What the tool answered with, as much of it as is worth reading',
  })
  readonly detail: string | null;

  @ApiProperty({ example: 1200, description: 'How long it took, in ms' })
  readonly ms: number;

  @ApiProperty({
    example: '2026-08-29T12:00:03.000Z',
    description: 'When it began, for laying the run out against a clock',
  })
  readonly startedAt: string;

  @ApiProperty({ type: StepLocationResponseDto, isArray: true })
  readonly locations: readonly StepLocationResponseDto[];

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'What the tool was asked for, as it was asked',
  })
  readonly given: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'What it handed back, unread',
  })
  readonly returned: string | null;

  @ApiProperty({ type: StepChangeResponseDto, nullable: true })
  readonly change: StepChangeResponseDto | null;

  constructor(
    kind: string,
    text: string,
    status: string | null,
    tool: string | null,
    detail: string | null,
    ms: number,
    startedAt: string,
    locations: readonly StepLocationResponseDto[],
    given: string | null,
    returned: string | null,
    change: StepChangeResponseDto | null,
  ) {
    this.kind = kind;
    this.text = text;
    this.status = status;
    this.tool = tool;
    this.detail = detail;
    this.ms = ms;
    this.startedAt = startedAt;
    this.locations = locations;
    this.given = given;
    this.returned = returned;
    this.change = change;
  }
}

export class SpanAttributeResponseDto {
  @ApiProperty({ example: 'gen_ai.request.model' })
  readonly name: string;

  @ApiProperty({ example: 'claude-opus-5' })
  readonly value: string;

  constructor(name: string, value: string) {
    this.name = name;
    this.value = value;
  }
}

export class RunSpanResponseDto {
  @ApiProperty({ example: '8889c15027e46e76' })
  readonly id: string;

  @ApiProperty({ nullable: true, type: String })
  readonly parentId: string | null;

  @ApiProperty({ example: 'claude_code.llm_request' })
  readonly name: string;

  @ApiProperty({ example: '2026-08-29T12:00:03.000Z' })
  readonly startedAt: string;

  @ApiProperty({ example: 4350 })
  readonly ms: number;

  @ApiProperty({ example: false })
  readonly failed: boolean;

  @ApiProperty({ type: SpanAttributeResponseDto, isArray: true })
  readonly attributes: readonly SpanAttributeResponseDto[];

  constructor(
    id: string,
    parentId: string | null,
    name: string,
    startedAt: string,
    ms: number,
    failed: boolean,
    attributes: readonly SpanAttributeResponseDto[],
  ) {
    this.id = id;
    this.parentId = parentId;
    this.name = name;
    this.startedAt = startedAt;
    this.ms = ms;
    this.failed = failed;
    this.attributes = attributes;
  }
}

export class RunMarksResponseDto {
  @ApiProperty({ nullable: true, type: String })
  readonly startedAt: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'When the workspace was handed to the agent',
  })
  readonly readyAt: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly spokeFrom: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly spokeTo: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly endedAt: string | null;

  constructor(
    startedAt: string | null,
    readyAt: string | null,
    spokeFrom: string | null,
    spokeTo: string | null,
    endedAt: string | null,
  ) {
    this.startedAt = startedAt;
    this.readyAt = readyAt;
    this.spokeFrom = spokeFrom;
    this.spokeTo = spokeTo;
    this.endedAt = endedAt;
  }
}

export class RunSpentResponseDto {
  @ApiProperty({ example: 12173, description: 'Tokens held in context' })
  readonly used: number;

  @ApiProperty({ example: 200000, description: 'How large the context is' })
  readonly size: number;

  @ApiPropertyOptional({ example: 0.0664917, nullable: true, type: Number })
  readonly cost: number | null;

  @ApiPropertyOptional({ example: 'USD', nullable: true, type: String })
  readonly currency: string | null;

  constructor(
    used: number,
    size: number,
    cost: number | null,
    currency: string | null,
  ) {
    this.used = used;
    this.size = size;
    this.cost = cost;
    this.currency = currency;
  }
}

export class RunJournalResponseDto {
  @ApiProperty({ example: 'd71ef228-a533-49ab-9e92-7c0d0af80e25' })
  readonly runId: string;

  @ApiProperty({ example: 1 })
  readonly attempt: number;

  @ApiProperty({ type: JournalStepResponseDto, isArray: true })
  readonly steps: readonly JournalStepResponseDto[];

  @ApiProperty({
    type: RunSpanResponseDto,
    isArray: true,
    description: 'Empty for a harness that reports nothing of itself',
  })
  readonly spans: readonly RunSpanResponseDto[];

  @ApiPropertyOptional({
    example: 56000,
    nullable: true,
    type: Number,
    description: 'How long the run spoke for, in ms',
  })
  readonly ms: number | null;

  @ApiProperty({ type: RunMarksResponseDto })
  readonly marks: RunMarksResponseDto;

  @ApiPropertyOptional({ type: RunSpentResponseDto, nullable: true })
  readonly spent: RunSpentResponseDto | null;

  constructor(
    runId: string,
    attempt: number,
    steps: readonly JournalStepResponseDto[],
    spans: readonly RunSpanResponseDto[],
    ms: number | null,
    marks: RunMarksResponseDto,
    spent: RunSpentResponseDto | null,
  ) {
    this.runId = runId;
    this.attempt = attempt;
    this.steps = steps;
    this.spans = spans;
    this.ms = ms;
    this.marks = marks;
    this.spent = spent;
  }
}
