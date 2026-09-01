import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReactionRequestDto {
  @ApiProperty({
    example: 'github.pull_request.commented',
    description: 'One of the words a connected source raises',
  })
  readonly happening!: string;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    type: String,
    description:
      'Where the task must stand for this to count. Leave out for wherever it is.',
  })
  readonly from?: string | null;

  @ApiProperty({
    example: 'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80',
    description: 'Where the word takes the task',
  })
  readonly to!: string;
}

export class SetLineReactionsRequestDto {
  @ApiProperty({
    type: ReactionRequestDto,
    isArray: true,
    description: 'The whole set. Anything left out stops applying.',
  })
  readonly reactions!: ReactionRequestDto[];
}
