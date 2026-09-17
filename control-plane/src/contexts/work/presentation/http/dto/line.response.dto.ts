import { ApiProperty } from '@nestjs/swagger';

export class StationResponseDto {
  @ApiProperty({ example: 'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80' })
  readonly id: string;

  @ApiProperty({
    example: 'triage',
    description:
      'What the station is called in its line file, and what a run hands a task on to it by',
  })
  readonly key: string;

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
    example: 'claude-sonnet-5',
    nullable: true,
    type: String,
    description:
      'Which model the harness answers with. Null falls back to its default.',
  })
  readonly model: string | null;

  @ApiProperty({
    example: 'high',
    nullable: true,
    type: String,
    description:
      'How hard the harness is told to think. Null leaves its own default.',
  })
  readonly effort: string | null;

  @ApiProperty({
    example: '## Role\n\nSort the queue.',
    nullable: true,
    type: String,
    description: 'Markdown, handed to the agent that works this station',
  })
  readonly agentPrompt: string | null;

  @ApiProperty({
    enum: ['backlog', 'work', 'completed'],
    description:
      'The ends of the line: a backlog is where a task waits before anything works it, and completed is where it lands once its pull request is merged',
  })
  readonly kind: string;

  @ApiProperty({
    example: ['our-migrations'],
    isArray: true,
    type: String,
    description: 'The team’s own skills given to a run here',
  })
  readonly skills: string[];

  constructor(
    id: string,
    key: string,
    name: string,
    position: number,
    color: string,
    description: string | null,
    harness: string | null,
    model: string | null,
    effort: string | null,
    agentPrompt: string | null,
    kind: string,
    skills: readonly string[],
  ) {
    this.id = id;
    this.key = key;
    this.name = name;
    this.position = position;
    this.color = color;
    this.description = description;
    this.harness = harness;
    this.model = model;
    this.effort = effort;
    this.agentPrompt = agentPrompt;
    this.kind = kind;
    this.skills = [...skills];
  }
}

export class ReactionResponseDto {
  @ApiProperty({ example: 'github.pull_request.commented' })
  readonly happening: string;

  @ApiProperty({
    example: null,
    nullable: true,
    type: String,
    description:
      'Where the task must stand for this to count. Null is wherever it is.',
  })
  readonly from: string | null;

  @ApiProperty({ example: 'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80' })
  readonly to: string;

  constructor(happening: string, from: string | null, to: string) {
    this.happening = happening;
    this.from = from;
    this.to = to;
  }
}

export class LineResponseDto {
  @ApiProperty({ example: '7b2c9e14-3a5d-4c8f-b6e1-9d0a2f7c5b43' })
  readonly id: string;

  @ApiProperty({
    example: 'delivery',
    description: 'What the line is called in its file',
  })
  readonly key: string;

  @ApiProperty({ example: 'Default' })
  readonly name: string;

  @ApiProperty({ type: StationResponseDto, isArray: true })
  readonly stations: StationResponseDto[];

  @ApiProperty({ type: ReactionResponseDto, isArray: true })
  readonly reactions: ReactionResponseDto[];

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['usespotlightai/spotlight'],
    description: 'The repositories a run on this line works in, as owner/name',
  })
  readonly repositories: string[];

  constructor(
    id: string,
    key: string,
    name: string,
    stations: StationResponseDto[],
    reactions: ReactionResponseDto[],
    repositories: string[],
  ) {
    this.id = id;
    this.key = key;
    this.name = name;
    this.stations = stations;
    this.reactions = reactions;
    this.repositories = repositories;
  }
}
