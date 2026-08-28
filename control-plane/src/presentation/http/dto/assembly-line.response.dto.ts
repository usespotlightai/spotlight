import { ApiProperty } from '@nestjs/swagger';

export class StationResponseDto {
  @ApiProperty({ example: 'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80' })
  readonly id: string;

  @ApiProperty({ example: 'Triage' })
  readonly name: string;

  @ApiProperty({ example: 0, description: 'Left to right across the board' })
  readonly position: number;

  @ApiProperty({ example: '#5c66d9', description: 'Six digit hex' })
  readonly color: string;

  @ApiProperty({
    example: 'Where new work lands before anyone looks at it',
    nullable: true,
    type: String,
  })
  readonly description: string | null;

  @ApiProperty({
    example: 'dev',
    nullable: true,
    type: String,
    description: 'Which runners work this station. Null until one is chosen.',
  })
  readonly harness: string | null;

  @ApiProperty({
    example: '## Role\n\nSort the queue.',
    nullable: true,
    type: String,
    description: 'Markdown, handed to the agent that works this station',
  })
  readonly agentPrompt: string | null;

  constructor(
    id: string,
    name: string,
    position: number,
    color: string,
    description: string | null,
    harness: string | null,
    agentPrompt: string | null,
  ) {
    this.id = id;
    this.name = name;
    this.position = position;
    this.color = color;
    this.description = description;
    this.harness = harness;
    this.agentPrompt = agentPrompt;
  }
}

export class AssemblyLineResponseDto {
  @ApiProperty({ example: '7b2c9e14-3a5d-4c8f-b6e1-9d0a2f7c5b43' })
  readonly id: string;

  @ApiProperty({ example: 'Default' })
  readonly name: string;

  @ApiProperty({ type: StationResponseDto, isArray: true })
  readonly stations: StationResponseDto[];

  constructor(id: string, name: string, stations: StationResponseDto[]) {
    this.id = id;
    this.name = name;
    this.stations = stations;
  }
}
