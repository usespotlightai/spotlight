import type { IntegrationResourceDto } from '@integrations/application/dto/integration-resource.dto';
import { ApiProperty } from '@nestjs/swagger';
import { ResourceResponseDto } from '@platform/http/dto/resource.response.dto';

export class IntegrationResourceResponseDto extends ResourceResponseDto {
  @ApiProperty({
    example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84',
    description: 'The team it belongs to',
  })
  readonly teamId: string;

  @ApiProperty({
    example: 'linear',
    description:
      'The host it defines; fixed for its life, so changing it means replacing the integration',
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
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { search: 'grafana.search' },
    description:
      'Each tool the integration offers, by its name within the integration, to the name a station or hook gives it by; not settable',
  })
  readonly tools: Readonly<Record<string, string>>;

  constructor(integration: IntegrationResourceDto) {
    super(integration);
    this.teamId = integration.teamId;
    this.source = integration.source;
    this.definition = integration.definition;
    this.tools = integration.tools;
  }
}
