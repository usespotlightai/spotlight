import {
  REVIEW_STATE_NAMES,
  RUN_STATE_NAMES,
} from '@application/dto/task-run.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttachmentResponseDto } from '@presentation/http/dto/attachment.response.dto';
import { InboxMessageResponseDto } from '@presentation/http/dto/inbox.response.dto';

export class RunStationResponseDto {
  @ApiProperty({ example: 'Implementation' })
  readonly name: string;

  @ApiProperty({ example: '#edc12b' })
  readonly color: string;

  @ApiProperty({ example: 3 })
  readonly position: number;

  @ApiProperty({ example: 5, description: 'How many stations the line holds' })
  readonly count: number;

  constructor(name: string, color: string, position: number, count: number) {
    this.name = name;
    this.color = color;
    this.position = position;
    this.count = count;
  }
}

export class RunReviewResponseDto {
  @ApiProperty({ enum: REVIEW_STATE_NAMES })
  readonly state: string;

  @ApiProperty({
    example: 'a17c4e02-9b3d-4f61-8e5a-0c2d7b9f4a13:5',
    description: 'The inbox conversation it opened',
  })
  readonly conversationId: string;

  constructor(state: string, conversationId: string) {
    this.state = state;
    this.conversationId = conversationId;
  }
}

export class RunConversationResponseDto {
  @ApiProperty({ example: '4e1e84a2-0c39-406d-bbbb-559f29e450be' })
  readonly runId: string;

  @ApiProperty({ example: 'a17c4e02-9b3d-4f61-8e5a-0c2d7b9f4a13' })
  readonly taskId: string;

  @ApiProperty({ example: 'Fix the queue' })
  readonly title: string;

  @ApiProperty({ nullable: true, type: String })
  readonly description: string | null;

  @ApiProperty({
    type: AttachmentResponseDto,
    isArray: true,
    description: 'The files the task was raised with',
  })
  readonly attachments: readonly AttachmentResponseDto[];

  @ApiProperty({ type: RunStationResponseDto, nullable: true })
  readonly station: RunStationResponseDto | null;

  @ApiProperty({ example: '2026-08-28T16:32:47.877Z' })
  readonly createdAt: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'What the run was given, word for word',
  })
  readonly briefing: string | null;

  @ApiProperty({ example: false, description: 'A run is on the task now' })
  readonly working: boolean;

  @ApiProperty({ type: InboxMessageResponseDto, isArray: true })
  readonly notes: readonly InboxMessageResponseDto[];

  constructor(
    runId: string,
    taskId: string,
    title: string,
    description: string | null,
    attachments: readonly AttachmentResponseDto[],
    station: RunStationResponseDto | null,
    createdAt: string,
    briefing: string | null,
    working: boolean,
    notes: readonly InboxMessageResponseDto[],
  ) {
    this.runId = runId;
    this.taskId = taskId;
    this.title = title;
    this.description = description;
    this.attachments = attachments;
    this.station = station;
    this.createdAt = createdAt;
    this.briefing = briefing;
    this.working = working;
    this.notes = notes;
  }
}

export class SayToRunRequestDto {
  @ApiProperty({
    example: 'Cap the retries at 500 while you are in there.',
    description:
      'Reaches the agent when its current turn ends. May be empty where files are attached.',
  })
  readonly body!: string;

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    description: 'Uploads to attach, by the id each was granted',
  })
  readonly attachments?: string[];
}

export class TaskRunResponseDto {
  @ApiProperty({ example: '4e1e84a2-0c39-406d-bbbb-559f29e450be' })
  readonly id: string;

  @ApiProperty({ example: 'completed', enum: RUN_STATE_NAMES })
  readonly state: string;

  @ApiProperty({ example: 1 })
  readonly attempt: number;

  @ApiProperty({ example: 0, nullable: true, type: Number })
  readonly exitCode: number | null;

  @ApiProperty({ example: '2026-08-28T16:32:47.877Z' })
  readonly startedAt: string;

  @ApiProperty({ example: '2026-08-28T16:33:25.712Z' })
  readonly updatedAt: string;

  @ApiProperty({ example: 'claude-code' })
  readonly harness: string;

  @ApiProperty({
    type: RunStationResponseDto,
    nullable: true,
    description: 'Where it ran, which the task may since have left',
  })
  readonly station: RunStationResponseDto | null;

  @ApiProperty({
    type: RunReviewResponseDto,
    nullable: true,
    description: 'Set where it put the task to a person',
  })
  readonly review: RunReviewResponseDto | null;

  constructor(
    id: string,
    state: string,
    attempt: number,
    exitCode: number | null,
    startedAt: string,
    updatedAt: string,
    harness: string,
    station: RunStationResponseDto | null,
    review: RunReviewResponseDto | null,
  ) {
    this.id = id;
    this.state = state;
    this.attempt = attempt;
    this.exitCode = exitCode;
    this.startedAt = startedAt;
    this.updatedAt = updatedAt;
    this.harness = harness;
    this.station = station;
    this.review = review;
  }
}

export class TeamRunResponseDto extends TaskRunResponseDto {
  @ApiProperty({ nullable: true, type: String })
  readonly taskId: string | null;

  @ApiProperty({ example: 'Fix the queue', nullable: true, type: String })
  readonly taskTitle: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'What was asked for, shown before a run has said anything',
  })
  readonly taskDescription: string | null;

  constructor(
    run: TaskRunResponseDto,
    taskId: string | null,
    taskTitle: string | null,
    taskDescription: string | null,
  ) {
    super(
      run.id,
      run.state,
      run.attempt,
      run.exitCode,
      run.startedAt,
      run.updatedAt,
      run.harness,
      run.station,
      run.review,
    );
    this.taskId = taskId;
    this.taskTitle = taskTitle;
    this.taskDescription = taskDescription;
  }
}
