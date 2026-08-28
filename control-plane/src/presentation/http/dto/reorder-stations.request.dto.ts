import { ApiProperty } from '@nestjs/swagger';

export class ReorderStationsRequestDto {
  @ApiProperty({
    type: [String],
    example: [
      'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80',
      '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84',
    ],
    description: 'Every station on the line, left to right',
  })
  readonly stationIds!: string[];
}
