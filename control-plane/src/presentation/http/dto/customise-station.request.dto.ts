import { ApiPropertyOptional } from '@nestjs/swagger';

export class CustomiseStationRequestDto {
  @ApiPropertyOptional({ example: 'Triage', maxLength: 100 })
  readonly name?: string;

  @ApiPropertyOptional({
    example: '#5c66d9',
    description: 'Six digit hex. The board offers a palette, but any will do.',
  })
  readonly color?: string;

  @ApiPropertyOptional({
    example: 'Where new work lands before anyone looks at it',
    maxLength: 500,
    nullable: true,
    type: String,
  })
  readonly description?: string | null;

  @ApiPropertyOptional({
    example: 'dev',
    maxLength: 60,
    nullable: true,
    type: String,
    description: 'Which runners work this station',
  })
  readonly harness?: string | null;

  @ApiPropertyOptional({
    example: 'claude-sonnet-5',
    maxLength: 60,
    nullable: true,
    type: String,
    description: 'Which model the harness answers with here',
  })
  readonly model?: string | null;

  @ApiPropertyOptional({
    example: 'high',
    maxLength: 20,
    nullable: true,
    type: String,
    description: 'How hard the harness is told to think here',
  })
  readonly effort?: string | null;

  @ApiPropertyOptional({
    example: '## Role\n\nSort the queue.',
    maxLength: 20000,
    nullable: true,
    type: String,
    description: 'Markdown, handed to the agent that works this station',
  })
  readonly agentPrompt?: string | null;

  @ApiPropertyOptional({
    example: ['our-migrations'],
    isArray: true,
    type: String,
    description:
      'The team’s own skills given to a run here, by the folder each is defined in',
  })
  readonly skills?: string[];
}
