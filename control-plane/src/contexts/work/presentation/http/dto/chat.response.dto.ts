import { ApiProperty } from '@nestjs/swagger';
import {
  CHAT_MESSAGE_KIND_NAMES,
  PROPOSAL_STATE_NAMES,
} from '@work/application/dto/chat.dto';
import { PROGRESS_NAMES } from '@work/application/dto/task.dto';
import { AttachmentResponseDto } from '@work/presentation/http/dto/attachment.response.dto';
import { InboxAuthorResponseDto } from '@work/presentation/http/dto/inbox.response.dto';

export class ChatSetupResponseDto {
  @ApiProperty({ example: 'acme/infra' })
  readonly repository: string;

  @ApiProperty({ example: 'spotlight' })
  readonly folder: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'https://github.com/acme/infra/pull/12',
    description: 'The pull request the chat opened with the configuration',
  })
  readonly pullRequest: string | null;

  constructor(from: {
    repository: string;
    folder: string;
    pullRequest: string | null;
  }) {
    this.repository = from.repository;
    this.folder = from.folder;
    this.pullRequest = from.pullRequest;
  }
}

export class ChatTargetStationResponseDto {
  @ApiProperty()
  readonly lineId: string;

  @ApiProperty({ example: 'delivery' })
  readonly lineKey: string;

  @ApiProperty({ example: 'Delivery' })
  readonly lineName: string;

  @ApiProperty()
  readonly stationId: string;

  @ApiProperty({ example: 'implementation' })
  readonly stationKey: string;

  @ApiProperty({ example: 'Implementation' })
  readonly stationName: string;

  constructor(from: {
    lineId: string;
    lineKey: string;
    lineName: string;
    stationId: string;
    stationKey: string;
    stationName: string;
  }) {
    this.lineId = from.lineId;
    this.lineKey = from.lineKey;
    this.lineName = from.lineName;
    this.stationId = from.stationId;
    this.stationKey = from.stationKey;
    this.stationName = from.stationName;
  }
}

export class ChatSummaryResponseDto {
  @ApiProperty({ example: '0b8f5e2c-4d1a-4b7e-9c3f-6a2d8e1f5b90' })
  readonly id: string;

  @ApiProperty({ example: 'Let’s plan how retries should back off.' })
  readonly title: string;

  @ApiProperty({ example: 'claude-code' })
  readonly harness: string;

  @ApiProperty({ type: String, nullable: true, example: 'claude-opus-5' })
  readonly model: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'high' })
  readonly effort: string | null;

  @ApiProperty({ type: String, isArray: true, example: ['acme/api'] })
  readonly repositories: readonly string[];

  @ApiProperty({
    type: () => ChatTargetStationResponseDto,
    nullable: true,
    description: 'The station that the chat must improve, if any',
  })
  readonly targetStation: ChatTargetStationResponseDto | null;

  @ApiProperty({
    type: () => ChatSetupResponseDto,
    nullable: true,
    description:
      'Where the chat sets up the team’s configuration as code, for a setup chat',
  })
  readonly setup: ChatSetupResponseDto | null;

  @ApiProperty({ example: '2026-09-14T09:00:00.000Z' })
  readonly createdAt: string;

  @ApiProperty({ example: '2026-09-14T09:05:00.000Z' })
  readonly updatedAt: string;

  @ApiProperty({
    enum: [...PROGRESS_NAMES, null],
    nullable: true,
    type: String,
    example: 'in-progress',
    description:
      'What the run answering it is doing: queued until a runner takes it, then in progress. Null while nothing answers.',
  })
  readonly progress: string | null;

  constructor(
    id: string,
    title: string,
    harness: string,
    model: string | null,
    effort: string | null,
    repositories: readonly string[],
    targetStation: ChatTargetStationResponseDto | null,
    setup: ChatSetupResponseDto | null,
    createdAt: string,
    updatedAt: string,
    progress: string | null,
  ) {
    this.id = id;
    this.title = title;
    this.harness = harness;
    this.model = model;
    this.effort = effort;
    this.repositories = repositories;
    this.targetStation = targetStation;
    this.setup = setup;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.progress = progress;
  }
}

export class ChatProposalResponseDto {
  @ApiProperty({ example: '7b2c9e14-3a5d-4c8f-b6e1-9d0a2f7c5b43' })
  readonly lineId: string;

  @ApiProperty({ type: String, nullable: true, example: 'Default' })
  readonly lineName: string | null;

  @ApiProperty({ example: 'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80' })
  readonly stationId: string;

  @ApiProperty({ type: String, nullable: true, example: 'Implementation' })
  readonly stationName: string | null;

  @ApiProperty({ type: String, nullable: true, example: '#edc12b' })
  readonly stationColor: string | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 2,
    description: 'The position of the station on its line, from 0',
  })
  readonly stationPosition: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 5,
    description: 'How many stations its line has',
  })
  readonly stationCount: number | null;

  @ApiProperty({ example: 'Back off retries exponentially' })
  readonly title: string;

  @ApiProperty({ type: String, nullable: true })
  readonly description: string | null;

  @ApiProperty({ enum: PROPOSAL_STATE_NAMES, example: 'open' })
  readonly state: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The task it became, once created',
  })
  readonly taskId: string | null;

  constructor(
    lineId: string,
    lineName: string | null,
    stationId: string,
    stationName: string | null,
    stationColor: string | null,
    stationPosition: number | null,
    stationCount: number | null,
    title: string,
    description: string | null,
    state: string,
    taskId: string | null,
  ) {
    this.lineId = lineId;
    this.lineName = lineName;
    this.stationId = stationId;
    this.stationName = stationName;
    this.stationColor = stationColor;
    this.stationPosition = stationPosition;
    this.stationCount = stationCount;
    this.title = title;
    this.description = description;
    this.state = state;
    this.taskId = taskId;
  }
}

export class ChatTraceResponseDto {
  @ApiProperty({ example: 'a17c4e02-9b3d-4f61-8e5a-0c2d7b9f4a13' })
  readonly taskId: string;

  @ApiProperty({ example: 'Retries back off exponentially' })
  readonly title: string;

  constructor(taskId: string, title: string) {
    this.taskId = taskId;
    this.title = title;
  }
}

export class ChatMessageResponseDto {
  @ApiProperty({ example: 0 })
  readonly position: number;

  @ApiProperty({ enum: CHAT_MESSAGE_KIND_NAMES, example: 'message' })
  readonly kind: string;

  @ApiProperty({ example: 'Let’s plan how retries should back off.' })
  readonly body: string;

  @ApiProperty({ example: '2026-09-14T09:00:00.000Z' })
  readonly at: string;

  @ApiProperty({ type: InboxAuthorResponseDto, nullable: true })
  readonly author: InboxAuthorResponseDto | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The run that proposed it',
  })
  readonly runId: string | null;

  @ApiProperty({ type: AttachmentResponseDto, isArray: true })
  readonly attachments: readonly AttachmentResponseDto[];

  @ApiProperty({
    type: ChatTraceResponseDto,
    isArray: true,
    description: 'Traces shared with the agent',
  })
  readonly traces: readonly ChatTraceResponseDto[];

  @ApiProperty({ type: ChatProposalResponseDto, nullable: true })
  readonly proposal: ChatProposalResponseDto | null;

  constructor(
    position: number,
    kind: string,
    body: string,
    at: string,
    author: InboxAuthorResponseDto | null,
    runId: string | null,
    attachments: readonly AttachmentResponseDto[],
    traces: readonly ChatTraceResponseDto[],
    proposal: ChatProposalResponseDto | null,
  ) {
    this.position = position;
    this.kind = kind;
    this.body = body;
    this.at = at;
    this.author = author;
    this.runId = runId;
    this.attachments = attachments;
    this.traces = traces;
    this.proposal = proposal;
  }
}

export class ChatResponseDto extends ChatSummaryResponseDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The run answering now',
  })
  readonly runId: string | null;

  @ApiProperty({ type: ChatMessageResponseDto, isArray: true })
  readonly messages: readonly ChatMessageResponseDto[];

  constructor(
    summary: ChatSummaryResponseDto,
    runId: string | null,
    messages: readonly ChatMessageResponseDto[],
  ) {
    super(
      summary.id,
      summary.title,
      summary.harness,
      summary.model,
      summary.effort,
      summary.repositories,
      summary.targetStation,
      summary.setup,
      summary.createdAt,
      summary.updatedAt,
      summary.progress,
    );
    this.runId = runId;
    this.messages = messages;
  }
}
