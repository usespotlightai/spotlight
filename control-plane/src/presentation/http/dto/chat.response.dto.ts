import {
  CHAT_MESSAGE_KIND_NAMES,
  PROPOSAL_STATE_NAMES,
} from '@application/dto/chat.dto';
import { ApiProperty } from '@nestjs/swagger';
import { AttachmentResponseDto } from '@presentation/http/dto/attachment.response.dto';
import { InboxAuthorResponseDto } from '@presentation/http/dto/inbox.response.dto';

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

  @ApiProperty({ example: '2026-09-14T09:00:00.000Z' })
  readonly createdAt: string;

  @ApiProperty({ example: '2026-09-14T09:05:00.000Z' })
  readonly updatedAt: string;

  @ApiProperty({ example: true, description: 'The agent is answering now' })
  readonly working: boolean;

  constructor(
    id: string,
    title: string,
    harness: string,
    model: string | null,
    effort: string | null,
    repositories: readonly string[],
    createdAt: string,
    updatedAt: string,
    working: boolean,
  ) {
    this.id = id;
    this.title = title;
    this.harness = harness;
    this.model = model;
    this.effort = effort;
    this.repositories = repositories;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.working = working;
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
    this.title = title;
    this.description = description;
    this.state = state;
    this.taskId = taskId;
  }
}

export class ChatMessageResponseDto {
  @ApiProperty({ example: 0 })
  readonly position: number;

  @ApiProperty({ enum: CHAT_MESSAGE_KIND_NAMES, example: 'said' })
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
    proposal: ChatProposalResponseDto | null,
  ) {
    this.position = position;
    this.kind = kind;
    this.body = body;
    this.at = at;
    this.author = author;
    this.runId = runId;
    this.attachments = attachments;
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
      summary.createdAt,
      summary.updatedAt,
      summary.working,
    );
    this.runId = runId;
    this.messages = messages;
  }
}
