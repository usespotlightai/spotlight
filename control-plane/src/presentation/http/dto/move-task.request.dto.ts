import { ApiProperty } from '@nestjs/swagger';

export class MoveTaskRequestDto {
  @ApiProperty({
    example: 'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80',
    description: 'The station to move the task to, on the same assembly line',
  })
  readonly stationId!: string;
}
