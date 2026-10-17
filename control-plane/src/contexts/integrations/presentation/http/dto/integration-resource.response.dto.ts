import type {
  ApiSpecDto,
  IntegrationResourceDto,
} from '@integrations/application/dto/integration-resource.dto';
import { ApiProperty } from '@nestjs/swagger';
import { ResourceResponseDto } from '@platform/http/dto/resource.response.dto';

export class ApiSpecResponseDto {
  @ApiProperty({
    enum: ['openapi', 'graphql', 'mcp'],
    example: 'openapi',
    description:
      'The kind of API spec that its tools are generated from: an OpenAPI document, a GraphQL schema or an MCP server',
  })
  readonly kind: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '9f2c4e1a7b3d5f6081a2c3e4f5061728394a5b6c7d8e9f0a1b2c3d4e5f607182',
    description:
      'The sha256 of the spec that Spotlight last fetched. It does not change when a later fetch fails. It is null when Spotlight never fetched the spec',
  })
  readonly hash: string | null;

  @ApiProperty({
    format: 'date-time',
    example: '2026-10-05T12:00:00.000Z',
    description: 'When Spotlight last fetched the spec',
  })
  readonly readAt: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description:
      'Why Spotlight could not fetch the spec the last time, or null when it could. Spotlight fetches the spec again when its url, document, baseUrl, revision or depth changes, on each update after a failed fetch, and when the integration is connected. Spotlight lists the tools of an MCP server again every MCP_RELIST_SECONDS',
  })
  readonly problem: string | null;

  @ApiProperty({
    type: 'integer',
    example: 19,
    description: 'How many of its tools were generated from the spec',
  })
  readonly tools: number;

  constructor(spec: ApiSpecDto) {
    this.kind = spec.kind;
    this.hash = spec.hash;
    this.readAt = spec.readAt;
    this.problem = spec.problem;
    this.tools = spec.tools;
  }
}

export class IntegrationResourceResponseDto extends ResourceResponseDto {
  @ApiProperty({
    example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84',
    description: 'The team it belongs to',
  })
  readonly teamId: string;

  @ApiProperty({
    example: 'linear',
    description:
      'The name of the integration, as in linear. It cannot change. To change it, replace the integration',
  })
  readonly integration: string;

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
      'Each tool the integration provides, hand-written or generated from its API spec, by its name within the integration, to the name that a station or hook uses for it; not settable',
  })
  readonly tools: Readonly<Record<string, string>>;

  @ApiProperty({
    type: ApiSpecResponseDto,
    nullable: true,
    description:
      'The API spec that its tools are generated from, as Spotlight last fetched it; null when it names none; not settable',
  })
  readonly spec: ApiSpecResponseDto | null;

  constructor(integration: IntegrationResourceDto) {
    super(integration);
    this.teamId = integration.teamId;
    this.integration = integration.integration;
    this.definition = integration.definition;
    this.tools = integration.tools;
    this.spec = integration.spec
      ? new ApiSpecResponseDto(integration.spec)
      : null;
  }
}
