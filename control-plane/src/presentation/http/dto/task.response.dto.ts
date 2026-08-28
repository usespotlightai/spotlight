import { ApiProperty } from '@nestjs/swagger';

export class TaskResponseDto {
  @ApiProperty({ example: 'a17c4e02-9b3d-4f61-8e5a-0c2d7b9f4a13' })
  readonly id: string;

  @ApiProperty({ example: 'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80' })
  readonly stationId: string;

  @ApiProperty({ example: 'Fix the queue' })
  readonly title: string;

  @ApiProperty({
    example: '## Steps\n\nReproduce, then fix.',
    nullable: true,
    type: String,
    description: 'Markdown',
  })
  readonly description: string | null;

  @ApiProperty({ example: '2026-08-27T09:15:00.000Z' })
  readonly createdAt: string;

  constructor(
    id: string,
    stationId: string,
    title: string,
    description: string | null,
    createdAt: string,
  ) {
    this.id = id;
    this.stationId = stationId;
    this.title = title;
    this.description = description;
    this.createdAt = createdAt;
  }
}
