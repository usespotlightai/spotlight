import { ApiProperty } from '@nestjs/swagger';

export class TaskRunResponseDto {
  @ApiProperty({ example: '4e1e84a2-0c39-406d-bbbb-559f29e450be' })
  readonly id: string;

  @ApiProperty({ example: 'completed' })
  readonly state: string;

  @ApiProperty({ example: 1 })
  readonly attempt: number;

  @ApiProperty({ example: 0, nullable: true, type: Number })
  readonly exitCode: number | null;

  @ApiProperty({ example: '2026-08-28T16:32:47.877Z' })
  readonly startedAt: string;

  @ApiProperty({ example: '2026-08-28T16:33:25.712Z' })
  readonly updatedAt: string;

  constructor(
    id: string,
    state: string,
    attempt: number,
    exitCode: number | null,
    startedAt: string,
    updatedAt: string,
  ) {
    this.id = id;
    this.state = state;
    this.attempt = attempt;
    this.exitCode = exitCode;
    this.startedAt = startedAt;
    this.updatedAt = updatedAt;
  }
}
