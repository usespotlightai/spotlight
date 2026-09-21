import { ApiProperty } from '@nestjs/swagger';

export class DraftChangeStackRequestDto {
  @ApiProperty({ description: 'The changes, as the output of git diff' })
  readonly diff!: string;

  @ApiProperty({
    nullable: true,
    description: 'Which checkout the changes are from',
  })
  readonly repository!: string | null;

  @ApiProperty({
    nullable: true,
    description: 'The commit the checkout stood at when the run began',
  })
  readonly base!: string | null;
}
