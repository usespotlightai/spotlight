import { ApiProperty } from '@nestjs/swagger';
import { ResourceResponseDto } from '@platform/http/dto/resource.response.dto';
import type { LineResourceDto } from '@work/application/dto/line-resource.dto';

export class LineResourceResponseDto extends ResourceResponseDto {
  @ApiProperty({
    example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84',
    description: 'The team it belongs to',
  })
  readonly teamId: string;

  @ApiProperty({
    example: 'delivery',
    description:
      'Names the line within its team; fixed for its life, so changing it means replacing the line',
  })
  readonly key: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'The current line, stations in order, with every field a definition may leave out filled in',
    example: {
      key: 'delivery',
      name: 'Delivery',
      repositories: [],
      stations: [
        {
          key: 'backlog',
          name: 'Backlog',
          kind: 'backlog',
          color: '#a3a8b0',
          diffs: false,
          decisions: false,
          memories: false,
          alerts: [],
          tools: [],
          skills: [],
          passesTo: ['completed'],
          ends: false,
        },
      ],
      reactions: [],
      replayCheck: {
        maxRegressions: 0,
        ceiling: 10,
        currency: 'USD',
        minGain: 0.05,
      },
    },
  })
  readonly definition: Readonly<Record<string, unknown>>;

  constructor(line: LineResourceDto) {
    super(line);
    this.teamId = line.teamId;
    this.key = line.key;
    this.definition = line.definition;
  }
}
