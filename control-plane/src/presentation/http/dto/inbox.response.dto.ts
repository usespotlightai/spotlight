import { ApiProperty } from '@nestjs/swagger';
import { TaskNoteResponseDto } from '@presentation/http/dto/task.response.dto';

export class InboxItemResponseDto {
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

  @ApiProperty({ example: '2026-08-28T21:15:00.000Z' })
  readonly askedAt: string;

  @ApiProperty({ type: TaskNoteResponseDto, isArray: true })
  readonly notes: readonly TaskNoteResponseDto[];

  constructor(
    taskId: string,
    teamId: string,
    title: string,
    description: string | null,
    station: string,
    stationColor: string,
    askedAt: string,
    notes: readonly TaskNoteResponseDto[],
  ) {
    this.taskId = taskId;
    this.teamId = teamId;
    this.title = title;
    this.description = description;
    this.station = station;
    this.stationColor = stationColor;
    this.askedAt = askedAt;
    this.notes = notes;
  }
}
