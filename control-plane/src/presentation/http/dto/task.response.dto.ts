import { ApiProperty } from '@nestjs/swagger';

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

  @ApiProperty({ example: '2026-08-27T09:15:00.000Z' })
  readonly createdAt: string;

  @ApiProperty({ example: false, description: 'A run is under way' })
  readonly running: boolean;

  @ApiProperty({ example: false, description: 'Waiting on a person' })
  readonly awaitingReview: boolean;

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
    createdAt: string,
    running: boolean,
    awaitingReview: boolean,
    note: TaskNoteResponseDto | null,
  ) {
    this.id = id;
    this.stationId = stationId;
    this.title = title;
    this.description = description;
    this.createdAt = createdAt;
    this.running = running;
    this.awaitingReview = awaitingReview;
    this.note = note;
  }
}
