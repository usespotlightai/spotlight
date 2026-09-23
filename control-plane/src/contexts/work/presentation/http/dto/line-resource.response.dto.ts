import { ApiProperty } from '@nestjs/swagger';
import type { LineResourceDto } from '@work/application/dto/line-resource.dto';

export class LineResourceResponseDto {
  @ApiProperty({ example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84' })
  readonly id: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'The line as it was defined, with every field it left out filled in',
    example: {
      key: 'delivery',
      name: 'Delivery',
      stations: [{ key: 'backlog', name: 'Backlog', kind: 'backlog' }],
    },
  })
  readonly definition: Readonly<Record<string, unknown>>;

  constructor(line: LineResourceDto) {
    this.id = line.id;
    this.definition = line.definition;
  }
}
