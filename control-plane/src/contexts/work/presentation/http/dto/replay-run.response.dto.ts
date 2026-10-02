import { ApiProperty } from '@nestjs/swagger';
import type {
  ReplayedRunDto,
  ReplayRunDto,
} from '@work/application/dto/replay-run.dto';
import { RunJournalResponseDto } from '@work/presentation/http/dto/run-journal.response.dto';
import {
  RunSpendResponseDto,
  RunStationResponseDto,
  TaskRunResponseDto,
} from '@work/presentation/http/dto/task-run.response.dto';
import { RunJournalHttpMapper } from '@work/presentation/http/mappers/run-journal.http.mapper';

export class ReplayedRunResponseDto {
  @ApiProperty({ example: '9b2f6c1e-4d3a-4e8b-a7f0-2c5d1e9b3a64' })
  readonly runId: string;

  @ApiProperty({ nullable: true, type: String })
  readonly taskId: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'Drain the retry queue on restart',
    description:
      'The title of the task it worked, as it reads now; null once the task is deleted',
  })
  readonly title: string | null;

  constructor(original: ReplayedRunDto) {
    this.runId = original.runId;
    this.taskId = original.taskId;
    this.title = original.title;
  }
}

export class ReplayRunResponseDto extends TaskRunResponseDto {
  @ApiProperty({
    type: ReplayedRunResponseDto,
    description: 'The past task run it replays',
  })
  readonly original: ReplayedRunResponseDto;

  @ApiProperty({ type: RunSpendResponseDto, nullable: true })
  readonly spend: RunSpendResponseDto | null;

  @ApiProperty({
    type: RunJournalResponseDto,
    isArray: true,
    description: 'What it did and said, attempt by attempt',
  })
  readonly journals: RunJournalResponseDto[];

  constructor(replay: ReplayRunDto) {
    super(
      replay.id,
      replay.state,
      replay.attempt,
      replay.exitCode,
      replay.startedAt,
      replay.updatedAt,
      replay.harness,
      replay.image,
      replay.station
        ? new RunStationResponseDto(
            replay.station.id,
            replay.station.name,
            replay.station.color,
            replay.station.position,
            replay.station.count,
          )
        : null,
      null,
    );
    this.original = new ReplayedRunResponseDto(replay.original);
    this.spend = replay.spend
      ? new RunSpendResponseDto(
          replay.spend.cost,
          replay.spend.currency,
          replay.spend.inputTokens,
          replay.spend.outputTokens,
          replay.spend.cacheReadTokens,
          replay.spend.cacheWriteTokens,
        )
      : null;
    this.journals = replay.journals.map(RunJournalHttpMapper.toResponse);
  }
}
