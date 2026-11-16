import { ApiProperty } from '@nestjs/swagger';

export class RecordPushDiffRequestDto {
  @ApiProperty({
    description: 'The changes of the pull request, as the output of git diff',
  })
  readonly diff!: string;

  @ApiProperty({
    description: 'The merge base of the pushed head and the base branch',
  })
  readonly base!: string;
}

export class FailPushDiffRequestDto {
  @ApiProperty({ description: 'Why the runner could not make the diff' })
  readonly reason!: string;
}
