import { ApiProperty } from '@nestjs/swagger';
import type {
  ReplayableRunDto,
  ReplaySetDto,
  ReplaySetEntryDto,
} from '@replays/application/dto/replays.dto';
import { REPLAY_REFUSALS } from '@replays/domain/value-objects/replay-refusal';

export class ReplaySetEntryResponseDto {
  @ApiProperty({ example: '9b2f6c1e-4d3a-4e8b-a7f0-2c5d1e9b3a64' })
  readonly runId: string;

  @ApiProperty({ example: '4e1a7c9d-2b5f-4a3e-9c8d-7f1b2e6a5d30' })
  readonly taskId: string;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'Drain the retry queue on restart',
    description:
      'The title of the task it worked, as it reads now; null once the task is deleted',
  })
  readonly title: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'completed',
    description: 'How the run stands now; null where there is no such run',
  })
  readonly state: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: '2026-09-30T16:20:00.000Z',
    description: 'When the run ended; null while it has not',
  })
  readonly endedAt: string | null;

  @ApiProperty({ example: '2026-10-01T09:00:00.000Z' })
  readonly addedAt: string;

  @ApiProperty({
    enum: [...REPLAY_REFUSALS, null],
    nullable: true,
    type: String,
    description:
      'Why the run can no longer be replayed, as it stands now; null while it can',
  })
  readonly refusal: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly reason: string | null;

  constructor(entry: ReplaySetEntryDto) {
    this.runId = entry.runId;
    this.taskId = entry.taskId;
    this.title = entry.title;
    this.state = entry.state;
    this.endedAt = entry.endedAt;
    this.addedAt = entry.addedAt;
    this.refusal = entry.refusal;
    this.reason = entry.reason;
  }
}

export class ReplaySetResponseDto {
  @ApiProperty({ example: '1c7e9a2b-5d4f-4b8e-a3c6-0f2d9e7b1a58' })
  readonly id: string;

  @ApiProperty()
  readonly lineId: string;

  @ApiProperty()
  readonly stationId: string;

  @ApiProperty({ example: 'Queue fixes' })
  readonly name: string;

  @ApiProperty({ example: '2026-10-01T09:00:00.000Z' })
  readonly createdAt: string;

  @ApiProperty({
    description:
      'Its station is gone from its line: it takes no more runs, starts no replays and keeps no archives; it may still be renamed, have runs taken out, or be deleted',
  })
  readonly stationGone: boolean;

  @ApiProperty({ type: ReplaySetEntryResponseDto, isArray: true })
  readonly entries: ReplaySetEntryResponseDto[];

  constructor(set: ReplaySetDto) {
    this.id = set.id;
    this.lineId = set.lineId;
    this.stationId = set.stationId;
    this.name = set.name;
    this.createdAt = set.createdAt;
    this.stationGone = set.stationGone;
    this.entries = set.entries.map(
      (each) => new ReplaySetEntryResponseDto(each),
    );
  }
}

export class ReplayableRunResponseDto {
  @ApiProperty()
  readonly runId: string;

  @ApiProperty({ nullable: true, type: String })
  readonly taskId: string | null;

  @ApiProperty({ example: 'Drain the queue' })
  readonly title: string;

  @ApiProperty({ example: 'completed' })
  readonly state: string;

  @ApiProperty({ example: '2026-10-01T09:00:00.000Z' })
  readonly endedAt: string;

  @ApiProperty({
    enum: [...REPLAY_REFUSALS, null],
    nullable: true,
    type: String,
    description: 'Why it cannot be replayed; null when it can',
  })
  readonly refusal: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly reason: string | null;

  constructor(run: ReplayableRunDto) {
    this.runId = run.runId;
    this.taskId = run.taskId;
    this.title = run.title;
    this.state = run.state;
    this.endedAt = run.endedAt;
    this.refusal = run.refusal;
    this.reason = run.reason;
  }
}

export class OpenReplaySetRequestDto {
  @ApiProperty({ example: 'Queue fixes', minLength: 1, maxLength: 100 })
  readonly name!: string;
}

export class RenameReplaySetRequestDto {
  @ApiProperty({
    example: 'Queue fixes, hard ones',
    minLength: 1,
    maxLength: 100,
  })
  readonly name!: string;
}

export class AddReplaySetEntryRequestDto {
  @ApiProperty({
    example: '9b2f6c1e-4d3a-4e8b-a7f0-2c5d1e9b3a64',
    description: 'A past run of a task at the set’s station',
  })
  readonly runId!: string;
}

export class ReplaySetOpenedResponseDto {
  @ApiProperty()
  readonly id: string;

  constructor(id: string) {
    this.id = id;
  }
}
