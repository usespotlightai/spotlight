import type { DefinedIntegration } from '@integrations/application/ports/defined-integrations.port';
import { ApiProperty } from '@nestjs/swagger';
import { ConfigurationProblemResponseDto } from '@platform/http/dto/configuration-problems.response.dto';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export class IntegrationResourceResponseDto {
  @ApiProperty({
    example: 'linear',
    description: 'The host it defines, which names it within the team',
  })
  readonly source: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'The integration as it was defined, with every field it left out filled in',
  })
  readonly definition: Readonly<Record<string, unknown>>;

  @ApiProperty({
    type: ConfigurationProblemResponseDto,
    isArray: true,
    description: 'What would work better, though nothing stops it working',
  })
  readonly warnings: readonly ConfigurationProblemResponseDto[];

  constructor(
    integration: DefinedIntegration,
    warnings: readonly ConfigurationProblem[],
  ) {
    this.source = integration.source;
    this.definition = integration.definition;
    this.warnings = warnings.map(
      (each) => new ConfigurationProblemResponseDto(each),
    );
  }
}
