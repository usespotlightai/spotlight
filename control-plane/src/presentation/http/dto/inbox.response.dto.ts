import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InboxAuthorResponseDto {
  @ApiProperty({ example: 'b7f3c1d9-2a48-4e6b-9c05-7d1e3f8a2b64' })
  readonly id: string;

  @ApiProperty({ example: 'Leon' })
  readonly name: string;

  @ApiProperty({ nullable: true, type: String })
  readonly image: string | null;

  constructor(id: string, name: string, image: string | null) {
    this.id = id;
    this.name = name;
    this.image = image;
  }
}

export class InboxMessageResponseDto {
  @ApiProperty({ example: 0 })
  readonly position: number;

  @ApiProperty({ example: 'asked', enum: ['asked', 'passed', 'answered'] })
  readonly kind: string;

  @ApiProperty({ example: 'Implementation' })
  readonly station: string;

  @ApiProperty({ example: '#edc12b' })
  readonly stationColor: string;

  @ApiProperty({ example: 2, description: 'Its place in the line, from zero' })
  readonly stationPosition: number;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'The run that wrote it, whose journal it came from',
  })
  readonly runId: string | null;

  @ApiProperty({ example: 'Reproduced on restart. Needs a spec.' })
  readonly body: string;

  @ApiProperty({ example: '2026-08-28T21:15:00.000Z' })
  readonly at: string;

  @ApiProperty({
    type: InboxAuthorResponseDto,
    nullable: true,
    description: 'Absent where the station said it rather than a person',
  })
  readonly author: InboxAuthorResponseDto | null;

  constructor(
    position: number,
    kind: string,
    station: string,
    stationColor: string,
    stationPosition: number,
    runId: string | null,
    body: string,
    at: string,
    author: InboxAuthorResponseDto | null,
  ) {
    this.position = position;
    this.kind = kind;
    this.station = station;
    this.stationColor = stationColor;
    this.stationPosition = stationPosition;
    this.runId = runId;
    this.body = body;
    this.at = at;
    this.author = author;
  }
}

export class InboxStationResponseDto {
  @ApiProperty({ example: 'Triage' })
  readonly name: string;

  @ApiProperty({ example: '#edc12b' })
  readonly color: string;

  @ApiProperty({ example: 0 })
  readonly position: number;

  constructor(name: string, color: string, position: number) {
    this.name = name;
    this.color = color;
    this.position = position;
  }
}

export class InboxItemResponseDto {
  @ApiProperty({
    example: 'a17c4e02-9b3d-4f61-8e5a-0c2d7b9f4a13:2',
    description: 'One conversation a person was asked to own',
  })
  readonly id: string;

  @ApiProperty({ example: 'a17c4e02-9b3d-4f61-8e5a-0c2d7b9f4a13' })
  readonly taskId: string;

  @ApiProperty({ example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84' })
  readonly teamId: string;

  @ApiProperty({ example: 'Fix the queue' })
  readonly title: string;

  @ApiProperty({ nullable: true, type: String })
  readonly description: string | null;

  @ApiProperty({ example: 'Implementation' })
  readonly station: string;

  @ApiProperty({ example: '#edc12b' })
  readonly stationColor: string;

  @ApiProperty({ example: 2, description: 'Its place in the line, from zero' })
  readonly stationPosition: number;

  @ApiProperty({ example: 4, description: 'How many stations the line holds' })
  readonly stationCount: number;

  @ApiProperty({
    type: InboxStationResponseDto,
    description: 'Where it was raised, which it keeps as it moves',
  })
  readonly raisedAt: InboxStationResponseDto;

  @ApiProperty({
    type: InboxStationResponseDto,
    description: 'Where the task stands now, which is where it ended up',
  })
  readonly standsAt: InboxStationResponseDto;

  @ApiProperty({ example: '2026-08-28T09:02:00.000Z' })
  readonly createdAt: string;

  @ApiProperty({ example: '2026-08-28T21:15:00.000Z' })
  readonly askedAt: string;

  @ApiProperty({
    example: false,
    description: 'True once it has moved on, and is no longer yours to answer',
  })
  readonly resolved: boolean;

  @ApiProperty({
    example: false,
    description: 'True while a run is working it, so an answer is coming',
  })
  readonly working: boolean;

  @ApiProperty({
    example: true,
    description: 'Something was asked here that they have not seen yet',
  })
  readonly unread: boolean;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'What the station that opened this conversation was given',
  })
  readonly briefing: string | null;

  @ApiProperty({ type: InboxMessageResponseDto, isArray: true })
  readonly notes: readonly InboxMessageResponseDto[];

  constructor(
    id: string,
    taskId: string,
    teamId: string,
    title: string,
    description: string | null,
    station: string,
    stationColor: string,
    stationPosition: number,
    stationCount: number,
    raisedAt: InboxStationResponseDto,
    standsAt: InboxStationResponseDto,
    createdAt: string,
    askedAt: string,
    resolved: boolean,
    working: boolean,
    unread: boolean,
    briefing: string | null,
    notes: readonly InboxMessageResponseDto[],
  ) {
    this.id = id;
    this.taskId = taskId;
    this.teamId = teamId;
    this.title = title;
    this.description = description;
    this.station = station;
    this.stationColor = stationColor;
    this.stationPosition = stationPosition;
    this.stationCount = stationCount;
    this.raisedAt = raisedAt;
    this.standsAt = standsAt;
    this.createdAt = createdAt;
    this.askedAt = askedAt;
    this.resolved = resolved;
    this.working = working;
    this.unread = unread;
    this.briefing = briefing;
    this.notes = notes;
  }
}

export class AnswerInboxItemRequestDto {
  @ApiProperty({
    example: 'Drain the queue before retrying, and cap it at 500.',
    description: 'What the person says back. It joins the task’s trail.',
  })
  readonly body!: string;
}

export class JournalStepResponseDto {
  @ApiProperty({ example: 'tool', enum: ['said', 'thought', 'tool'] })
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

  constructor(
    kind: string,
    text: string,
    status: string | null,
    tool: string | null,
    detail: string | null,
    ms: number,
  ) {
    this.kind = kind;
    this.text = text;
    this.status = status;
    this.tool = tool;
    this.detail = detail;
    this.ms = ms;
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

  @ApiPropertyOptional({
    example: 56000,
    nullable: true,
    type: Number,
    description: 'How long the run spoke for, in ms',
  })
  readonly ms: number | null;

  @ApiPropertyOptional({ type: RunSpentResponseDto, nullable: true })
  readonly spent: RunSpentResponseDto | null;

  @ApiProperty({
    example: true,
    description: 'False for a run from before the agents spoke a protocol',
  })
  readonly readable: boolean;

  constructor(
    runId: string,
    attempt: number,
    steps: readonly JournalStepResponseDto[],
    ms: number | null,
    spent: RunSpentResponseDto | null,
    readable: boolean,
  ) {
    this.runId = runId;
    this.attempt = attempt;
    this.steps = steps;
    this.ms = ms;
    this.spent = spent;
    this.readable = readable;
  }
}
