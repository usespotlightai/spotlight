import { ApiProperty } from '@nestjs/swagger';
import {
  MOVE_MAKER_NAMES,
  type TaskMoveDto,
} from '@work/application/dto/task-move.dto';
import { TaskPersonResponseDto } from '@work/presentation/http/dto/task.response.dto';

export class TaskMoveResponseDto {
  @ApiProperty({ example: 4 })
  readonly position: number;

  @ApiProperty({ example: '2026-11-27T09:15:00.000Z' })
  readonly at: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Backlog',
    description: 'The station the task moved to; null once it is gone',
  })
  readonly station: string | null;

  @ApiProperty({
    enum: MOVE_MAKER_NAMES,
    example: 'line',
    description:
      'Who moved the task: the line, when something happened in the world, or a person',
  })
  readonly by: TaskMoveDto['by'];

  @ApiProperty({
    type: TaskPersonResponseDto,
    nullable: true,
    description: 'The person who moved the task, when a person did',
  })
  readonly person: TaskPersonResponseDto | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'The pull request was closed without being merged.',
    description: 'Why the task moved, when the mover said',
  })
  readonly why: string | null;

  constructor(move: TaskMoveDto) {
    this.position = move.position;
    this.at = move.at;
    this.station = move.station;
    this.by = move.by;
    this.person = move.person
      ? new TaskPersonResponseDto(
          move.person.id,
          move.person.name,
          move.person.image,
        )
      : null;
    this.why = move.why;
  }
}
