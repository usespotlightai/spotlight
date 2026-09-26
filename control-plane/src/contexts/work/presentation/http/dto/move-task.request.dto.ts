import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MoveTaskRequestDto {
  @ApiProperty({
    example: 'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80',
    description: 'The station to move the task to, on the same line',
  })
  readonly stationId!: string;

  @ApiProperty({
    example: 3,
    description:
      'The revision the move was based on; a task that has moved since is not moved again',
  })
  readonly revision!: number;

  @ApiPropertyOptional({
    example: 'a17c4e02-9b3d-4f61-8e5a-0c2d7b9f4a13',
    nullable: true,
    type: String,
    description:
      'The task it was dropped after. Left out for the top of the station.',
  })
  readonly afterTaskId?: string | null;
}
