import { ApiProperty } from '@nestjs/swagger';
import { STEP_KIND_NAMES } from '@work/application/dto/run-journal.dto';

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

  @ApiProperty({ description: 'The file before the agent changed it' })
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
    description: 'The input of the call, as it was sent',
  })
  readonly input: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'The output of the call, unread',
  })
  readonly output: string | null;

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
    input: string | null,
    output: string | null,
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
    this.input = input;
    this.output = output;
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
  readonly firstAgentUpdateAt: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly lastAgentUpdateAt: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly endedAt: string | null;

  constructor(
    startedAt: string | null,
    readyAt: string | null,
    firstAgentUpdateAt: string | null,
    lastAgentUpdateAt: string | null,
    endedAt: string | null,
  ) {
    this.startedAt = startedAt;
    this.readyAt = readyAt;
    this.firstAgentUpdateAt = firstAgentUpdateAt;
    this.lastAgentUpdateAt = lastAgentUpdateAt;
    this.endedAt = endedAt;
  }
}

export class RunSpentResponseDto {
  @ApiProperty({ example: 12173, description: 'Tokens in context' })
  readonly used: number;

  @ApiProperty({ example: 200000, description: 'How large the context is' })
  readonly size: number;

  @ApiProperty({ example: 0.0664917, nullable: true, type: Number })
  readonly cost: number | null;

  @ApiProperty({ example: 'USD', nullable: true, type: String })
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

  @ApiProperty({
    example: 56000,
    nullable: true,
    type: Number,
    description: 'How long the agent was active, in ms',
  })
  readonly ms: number | null;

  @ApiProperty({ type: RunMarksResponseDto })
  readonly marks: RunMarksResponseDto;

  @ApiProperty({ type: RunSpentResponseDto, nullable: true })
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
