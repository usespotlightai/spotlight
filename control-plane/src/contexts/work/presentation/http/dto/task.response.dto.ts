import { ApiProperty } from '@nestjs/swagger';
import { AttachmentResponseDto } from '@work/presentation/http/dto/attachment.response.dto';

export class TaskNoteResponseDto {
  @ApiProperty({ example: 0 })
  readonly position: number;

  @ApiProperty({ example: 'Implementation' })
  readonly station: string;

  @ApiProperty({ example: 'The run was given up on after 3 attempts.' })
  readonly body: string;

  constructor(position: number, station: string, body: string) {
    this.position = position;
    this.station = station;
    this.body = body;
  }
}

export class TaskPersonResponseDto {
  @ApiProperty({ example: 'f2b1c9d4-3e57-4a80-9c62-1d8e5f0a7b34' })
  readonly id: string;

  @ApiProperty({ example: 'Ada Lovelace' })
  readonly name: string;

  @ApiProperty({
    example: 'https://example.com/ada.png',
    nullable: true,
    type: String,
  })
  readonly image: string | null;

  constructor(id: string, name: string, image: string | null) {
    this.id = id;
    this.name = name;
    this.image = image;
  }
}

export class TaskReviewResponseDto {
  @ApiProperty({
    example: 'a17c4e02-9b3d-4f61-8e5a-0c2d7b9f4a13:5',
    description: 'The inbox conversation waiting on a person',
  })
  readonly conversationId: string;

  constructor(conversationId: string) {
    this.conversationId = conversationId;
  }
}

export class TaskResponseDto {
  @ApiProperty({ example: 'a17c4e02-9b3d-4f61-8e5a-0c2d7b9f4a13' })
  readonly id: string;

  @ApiProperty({ example: 'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80' })
  readonly stationId: string;

  @ApiProperty({ example: 'Fix the queue' })
  readonly title: string;

  @ApiProperty({
    example: '## Steps\n\nReproduce, then fix.',
    nullable: true,
    type: String,
    description: 'Markdown',
  })
  readonly description: string | null;

  @ApiProperty({
    type: AttachmentResponseDto,
    isArray: true,
    description: 'The files it was raised with',
  })
  readonly attachments: readonly AttachmentResponseDto[];

  @ApiProperty({ example: '2026-08-27T09:15:00.000Z' })
  readonly createdAt: string;

  @ApiProperty({ example: false, description: 'A run is under way' })
  readonly running: boolean;

  @ApiProperty({
    type: TaskReviewResponseDto,
    nullable: true,
    description: 'Where a standing question is answered, or null for none',
  })
  readonly awaitingReview: TaskReviewResponseDto | null;

  @ApiProperty({
    example: 'https://github.com/acme/widgets/pull/7',
    nullable: true,
    type: String,
    description: 'The pull request this task ended in, once one is open',
  })
  readonly pullRequest: string | null;

  @ApiProperty({
    type: TaskPersonResponseDto,
    nullable: true,
    description: 'Who raised it, and so who it comes back to',
  })
  readonly raisedBy: TaskPersonResponseDto | null;

  @ApiProperty({
    type: TaskPersonResponseDto,
    nullable: true,
    description: 'The team member who owns the work, or nobody where unclaimed',
  })
  readonly assignee: TaskPersonResponseDto | null;

  @ApiProperty({
    type: TaskNoteResponseDto,
    nullable: true,
    description: 'The last thing said about this task, and where it was said',
  })
  readonly note: TaskNoteResponseDto | null;

  constructor(
    id: string,
    stationId: string,
    title: string,
    description: string | null,
    attachments: readonly AttachmentResponseDto[],
    createdAt: string,
    running: boolean,
    awaitingReview: TaskReviewResponseDto | null,
    pullRequest: string | null,
    raisedBy: TaskPersonResponseDto | null,
    assignee: TaskPersonResponseDto | null,
    note: TaskNoteResponseDto | null,
  ) {
    this.id = id;
    this.stationId = stationId;
    this.title = title;
    this.description = description;
    this.attachments = attachments;
    this.createdAt = createdAt;
    this.running = running;
    this.awaitingReview = awaitingReview;
    this.pullRequest = pullRequest;
    this.raisedBy = raisedBy;
    this.assignee = assignee;
    this.note = note;
  }
}
