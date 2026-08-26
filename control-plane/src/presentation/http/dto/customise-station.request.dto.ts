import { ApiPropertyOptional } from '@nestjs/swagger';

/** Every field is optional: what is left out keeps the value it had, and what
 *  arrives blank is cleared. Name is the exception, having nothing to fall
 *  back to, so an empty one is refused. */
export class CustomiseStationRequestDto {
  @ApiPropertyOptional({ example: 'Triage', maxLength: 100 })
  readonly name?: string;

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
