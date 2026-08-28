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
  readonly pool?: string | null;

  @ApiPropertyOptional({
    example: '## Role\n\nSort the queue.',
    maxLength: 20000,
    nullable: true,
    type: String,
    description: 'Markdown, handed to the agent that works this station',
  })
  readonly agentPrompt?: string | null;
}
