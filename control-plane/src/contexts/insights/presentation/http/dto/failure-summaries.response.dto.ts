import type {
  RunFailureSummary,
  TaskFailureSummary,
} from '@insights/domain/services/failure-summaries';
import { ApiProperty } from '@nestjs/swagger';

export class TaskFailureSummaryResponseDto {
  @ApiProperty({
    example: 'hook:notify',
    description: 'run, or hook:<name> for a hook’s failure',
  })
  readonly source: string;

  @ApiProperty({ example: 'loop', description: 'What went wrong' })
  readonly code: string;

  @ApiProperty({
    example: 3,
    description: 'Times it was raised or repeated in the period',
  })
  readonly occurrences: number;

  @ApiProperty({
    example: 3,
    description: 'The most times it repeated on one task without a break',
  })
  readonly maxInARow: number;

  @ApiProperty({ type: String, isArray: true })
  readonly taskIds: readonly string[];

  constructor(summary: TaskFailureSummary) {
    this.source = summary.source;
    this.code = summary.code;
    this.occurrences = summary.occurrences;
    this.maxInARow = summary.maxInARow;
    this.taskIds = summary.taskIds;
  }
}

export class RunFailureSummaryResponseDto {
  @ApiProperty({
    nullable: true,
    type: String,
    example: 'exited',
    description: 'Why the runs failed, where they said',
  })
  readonly failure: string | null;

  @ApiProperty({ example: 2 })
  readonly runs: number;

  @ApiProperty({ type: String, isArray: true })
  readonly runIds: readonly string[];

  constructor(summary: RunFailureSummary) {
    this.failure = summary.failure;
    this.runs = summary.runs;
    this.runIds = summary.runIds;
  }
}
