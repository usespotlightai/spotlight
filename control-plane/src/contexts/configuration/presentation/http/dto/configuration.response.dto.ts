import {
  type ApiSpecView,
  CONFIGURED_INTEGRATION_ACTS_AS,
  CONFIGURED_INTEGRATION_CONNECTION_STATUSES,
  type IntegrationView,
} from '@configuration/application/dto/configuration.dto';
import { ApiProperty } from '@nestjs/swagger';

export class ApiSpecViewResponseDto {
  @ApiProperty({
    enum: ['openapi', 'graphql', 'mcp'],
    example: 'openapi',
    description:
      'The kind of API spec that its tools are generated from: an OpenAPI document, a GraphQL schema or an MCP server',
  })
  readonly kind: string;

  @ApiProperty({
    type: 'integer',
    example: 19,
    description: 'How many tools were generated from it',
  })
  readonly tools: number;

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
      'Why it could not be read when it was last requested. The tools from the last good read stay available',
  })
  readonly problem: string | null;

  constructor(spec: ApiSpecView) {
    this.kind = spec.kind;
    this.tools = spec.tools;
    this.readAt = spec.readAt;
    this.problem = spec.problem;
  }
}

export class IntegrationViewResponseDto {
  @ApiProperty({
    description: 'The name of the integration, as in slack',
    example: 'linear',
  })
  readonly integration: string;

  @ApiProperty({ example: 'Linear' })
  readonly name: string;

  @ApiProperty({
    description: 'Where the integration is defined',
    example: 'integrations/linear',
  })
  readonly path: string;

  @ApiProperty({
    description:
      'Whether the team is connected to the integration. The integration needs no connection, is disconnected, or is connected.',
    enum: CONFIGURED_INTEGRATION_CONNECTION_STATUSES,
    example: 'connected',
  })
  readonly connectionStatus: IntegrationView['connectionStatus'];

  @ApiProperty({
    description:
      'Whose connection its tools act with: the team’s, or that of the person who started the task',
    enum: CONFIGURED_INTEGRATION_ACTS_AS,
    example: 'team',
  })
  readonly actsAs: IntegrationView['actsAs'];

  @ApiProperty({
    description:
      'The account name of the team on the service once connected, where the service gives one',
    example: 'Acme',
    nullable: true,
    type: String,
  })
  readonly linkedAccount: string | null;

  @ApiProperty({
    description:
      'The API spec that its tools are generated from, as last read. Null where it names none',
    type: ApiSpecViewResponseDto,
    nullable: true,
  })
  readonly spec: ApiSpecViewResponseDto | null;

  constructor(integration: IntegrationView) {
    this.integration = integration.integration;
    this.name = integration.name;
    this.path = integration.path;
    this.connectionStatus = integration.connectionStatus;
    this.actsAs = integration.actsAs;
    this.linkedAccount = integration.linkedAccount;
    this.spec = integration.spec
      ? new ApiSpecViewResponseDto(integration.spec)
      : null;
  }
}

export class ConfigurationResponseDto {
  @ApiProperty({ type: IntegrationViewResponseDto, isArray: true })
  readonly integrations: readonly IntegrationViewResponseDto[];

  constructor(integrations: readonly IntegrationViewResponseDto[]) {
    this.integrations = integrations;
  }
}
