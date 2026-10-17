import {
  CONFIGURED_INTEGRATION_HOLDINGS,
  CONFIGURED_INTEGRATION_STANDINGS,
  type DescriptionView,
  type IntegrationView,
} from '@configuration/application/dto/configuration.dto';
import { ApiProperty } from '@nestjs/swagger';

export class DescriptionViewResponseDto {
  @ApiProperty({
    enum: ['openapi', 'graphql', 'mcp'],
    example: 'openapi',
    description:
      'The kind of API description, or the MCP server, its tools are generated from',
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
    description: 'When it was last read',
  })
  readonly readAt: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description:
      'Why it could not be read when it was last asked for; the tools from the last good read stay offered',
  })
  readonly problem: string | null;

  constructor(described: DescriptionView) {
    this.kind = described.kind;
    this.tools = described.tools;
    this.readAt = described.readAt;
    this.problem = described.problem;
  }
}

export class IntegrationViewResponseDto {
  @ApiProperty({ example: 'linear' })
  readonly source: string;

  @ApiProperty({ example: 'Linear' })
  readonly name: string;

  @ApiProperty({
    description: 'Where the integration is defined',
    example: 'integrations/linear',
  })
  readonly path: string;

  @ApiProperty({
    description:
      'Whether the team is linked to the host: it only listens, it links by authorizing and has not, or it has',
    enum: CONFIGURED_INTEGRATION_STANDINGS,
    example: 'linked',
  })
  readonly standing: IntegrationView['standing'];

  @ApiProperty({
    description:
      'Whose connection its tools act with: the team’s, or that of the person who started the task',
    enum: CONFIGURED_INTEGRATION_HOLDINGS,
    example: 'team',
  })
  readonly holding: IntegrationView['holding'];

  @ApiProperty({
    description: 'What the host calls the team once linked, where it says',
    example: 'Acme',
    nullable: true,
    type: String,
  })
  readonly handle: string | null;

  @ApiProperty({
    description:
      'The API description its tools are generated from, as last read; null where it names none',
    type: DescriptionViewResponseDto,
    nullable: true,
  })
  readonly described: DescriptionViewResponseDto | null;

  constructor(integration: IntegrationView) {
    this.source = integration.source;
    this.name = integration.name;
    this.path = integration.path;
    this.standing = integration.standing;
    this.holding = integration.holding;
    this.handle = integration.handle;
    this.described = integration.described
      ? new DescriptionViewResponseDto(integration.described)
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
