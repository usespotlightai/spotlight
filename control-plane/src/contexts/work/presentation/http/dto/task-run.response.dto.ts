import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PROGRESS_NAMES } from '@work/application/dto/task.dto';
import {
  REVIEW_STATE_NAMES,
  RUN_STATE_NAMES,
} from '@work/application/dto/task-run.dto';
import { AttachmentResponseDto } from '@work/presentation/http/dto/attachment.response.dto';
import { NoteResponseDto } from '@work/presentation/http/dto/inbox.response.dto';

export class RunStationResponseDto {
  @ApiProperty({ example: 'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80' })
  readonly id: string;

  @ApiProperty({ example: 'Implementation' })
  readonly name: string;

  @ApiProperty({ example: '#edc12b' })
  readonly color: string;

  @ApiProperty({ example: 3 })
  readonly position: number;

  @ApiProperty({ example: 5, description: 'How many stations the line has' })
  readonly count: number;

  constructor(
    id: string,
    name: string,
    color: string,
    position: number,
    count: number,
  ) {
    this.id = id;
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

export class RunSpendResponseDto {
  @ApiProperty({ example: 0.4213, nullable: true, type: Number })
  readonly cost: number | null;

  @ApiProperty({ example: 'USD', nullable: true, type: String })
  readonly currency: string | null;

  @ApiProperty({
    example: 3120,
    nullable: true,
    type: Number,
    description:
      'Fresh input tokens; null where the harness did not report them',
  })
  readonly inputTokens: number | null;

  @ApiProperty({
    example: 8840,
    nullable: true,
    type: Number,
    description: 'Output tokens; null where the harness did not report them',
  })
  readonly outputTokens: number | null;

  @ApiProperty({
    example: 412300,
    nullable: true,
    type: Number,
    description:
      'Input tokens read from the prompt cache; null where the harness did not report them',
  })
  readonly cacheReadTokens: number | null;

  @ApiProperty({
    example: 21400,
    nullable: true,
    type: Number,
    description:
      'Input tokens written to the prompt cache; null where the harness did not report them',
  })
  readonly cacheWriteTokens: number | null;

  constructor(
    cost: number | null,
    currency: string | null,
    inputTokens: number | null,
    outputTokens: number | null,
    cacheReadTokens: number | null,
    cacheWriteTokens: number | null,
  ) {
    this.cost = cost;
    this.currency = currency;
    this.inputTokens = inputTokens;
    this.outputTokens = outputTokens;
    this.cacheReadTokens = cacheReadTokens;
    this.cacheWriteTokens = cacheWriteTokens;
  }
}

export class LatestRunResponseDto {
  @ApiProperty({ example: '4e1e84a2-0c39-406d-bbbb-559f29e450be' })
  readonly id: string;

  @ApiProperty({ example: 'claimed', enum: RUN_STATE_NAMES })
  readonly state: string;

  @ApiProperty({
    enum: [...PROGRESS_NAMES, null],
    nullable: true,
    type: String,
    example: 'in-progress',
    description:
      'What it is doing: queued until a runner takes it, then in progress, and stopping once someone asked it to stop',
  })
  readonly progress: string | null;

  constructor(id: string, state: string, progress: string | null) {
    this.id = id;
    this.state = state;
    this.progress = progress;
  }
}

export class RunNotesResponseDto {
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
    description: 'The files the task was created with',
  })
  readonly attachments: readonly AttachmentResponseDto[];

  @ApiProperty({ type: RunStationResponseDto, nullable: true })
  readonly station: RunStationResponseDto | null;

  @ApiProperty({ example: '2026-08-28T16:32:47.877Z' })
  readonly createdAt: string;

  @ApiProperty({ description: 'The briefing of the run, word for word' })
  readonly briefing: string;

  @ApiProperty({
    enum: [...PROGRESS_NAMES, null],
    nullable: true,
    type: String,
    example: 'in-progress',
    description:
      'What the run of the task at this station is doing now: queued until a runner takes it, then in progress, and stopping once someone asked it to stop. A paused run is under way again once a person answered it.',
  })
  readonly progress: string | null;

  @ApiProperty({
    type: LatestRunResponseDto,
    description: 'The newest run of the task at this station',
  })
  readonly latestRun: LatestRunResponseDto;

  @ApiProperty({ type: NoteResponseDto, isArray: true })
  readonly notes: readonly NoteResponseDto[];

  @ApiProperty({
    type: RunSpendResponseDto,
    nullable: true,
    description:
      'What the run spent, once it has ended and its usage is recorded',
  })
  readonly spend: RunSpendResponseDto | null;

  constructor(
    runId: string,
    taskId: string,
    title: string,
    description: string | null,
    attachments: readonly AttachmentResponseDto[],
    station: RunStationResponseDto | null,
    createdAt: string,
    briefing: string,
    progress: string | null,
    latestRun: LatestRunResponseDto,
    notes: readonly NoteResponseDto[],
    spend: RunSpendResponseDto | null,
  ) {
    this.runId = runId;
    this.taskId = taskId;
    this.title = title;
    this.description = description;
    this.attachments = attachments;
    this.station = station;
    this.createdAt = createdAt;
    this.briefing = briefing;
    this.progress = progress;
    this.latestRun = latestRun;
    this.notes = notes;
    this.spend = spend;
  }
}

export class SendMessageRequestDto {
  @ApiProperty({
    example: 'Cap the retries at 500 while you are in there.',
    description:
      'Goes to the agent when its current turn ends. May be empty where files are attached.',
  })
  readonly body!: string;

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    description: 'Uploads to attach, by the id each was granted',
  })
  readonly attachments?: string[];

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    description:
      'The other people who wrote the shared draft with the sender, by user id',
  })
  readonly coAuthors?: string[];

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 0,
    description:
      'The generation of the shared draft this sends. A second send of the same generation is refused, so the draft goes only once',
  })
  readonly draftGeneration?: number | null;
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
    type: String,
    nullable: true,
    example:
      'ghcr.io/acme/api-runner@sha256:9b2f5c1e0d7a4b3c8e6f1a2d5c7b9e0f3a4d6c8b1e2f5a7c9d0b3e6f8a1c4d7e',
    description:
      'The image, by digest, its sandbox started from; null before it started or where a push pool provisioned it',
  })
  readonly image: string | null;

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

  @ApiProperty({
    enum: [...PROGRESS_NAMES, null],
    nullable: true,
    type: String,
    example: 'in-progress',
    description:
      'What it is doing: queued until a runner takes it, then in progress, and stopping once someone asked it to stop. Null once it waits for a person or has ended.',
  })
  readonly progress: string | null;

  constructor(
    id: string,
    state: string,
    attempt: number,
    exitCode: number | null,
    startedAt: string,
    updatedAt: string,
    harness: string,
    image: string | null,
    station: RunStationResponseDto | null,
    review: RunReviewResponseDto | null,
    progress: string | null,
  ) {
    this.id = id;
    this.state = state;
    this.attempt = attempt;
    this.exitCode = exitCode;
    this.startedAt = startedAt;
    this.updatedAt = updatedAt;
    this.harness = harness;
    this.image = image;
    this.station = station;
    this.review = review;
    this.progress = progress;
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
    description: 'What was requested, shown before a run has written a note',
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
      run.image,
      run.station,
      run.review,
      run.progress,
    );
    this.taskId = taskId;
    this.taskTitle = taskTitle;
    this.taskDescription = taskDescription;
  }
}
