import type {
  DescribedSourceDto,
  IntegrationResourceDto,
} from '@integrations/application/dto/integration-resource.dto';
import { ApiProperty } from '@nestjs/swagger';
import { ResourceResponseDto } from '@platform/http/dto/resource.response.dto';

export class DescribedSourceResponseDto {
  @ApiProperty({
    enum: ['openapi', 'graphql'],
    example: 'openapi',
    description: 'The kind of API description its tools are generated from',
  })
  readonly kind: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '9f2c4e1a7b3d5f6081a2c3e4f5061728394a5b6c7d8e9f0a1b2c3d4e5f607182',
    description:
      'The sha256 of what was last read, kept while a later read fails; null when it has never been read',
  })
  readonly hash: string | null;

  @ApiProperty({
    format: 'date-time',
    example: '2026-10-05T12:00:00.000Z',
    description: 'When the description was last read',
  })
  readonly readAt: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description:
      'Why the description could not be read when it was last asked for, or null when it was; Spotlight reads it again when its url, document, baseUrl, revision or depth changes, on any update after a failed read, and when the integration is connected',
  })
  readonly problem: string | null;

  @ApiProperty({
    type: 'integer',
    example: 19,
    description: 'How many of its tools were generated from the description',
  })
  readonly tools: number;

  constructor(described: DescribedSourceDto) {
    this.kind = described.kind;
    this.hash = described.hash;
    this.readAt = described.readAt;
    this.problem = described.problem;
    this.tools = described.tools;
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
      'Each tool the integration offers, hand-written or generated from its API description, by its name within the integration, to the name a station or hook gives it by; not settable',
  })
  readonly tools: Readonly<Record<string, string>>;

  @ApiProperty({
    type: DescribedSourceResponseDto,
    nullable: true,
    description:
      'The API description its tools are generated from, as last read; null when it names none; not settable',
  })
  readonly described: DescribedSourceResponseDto | null;

  constructor(integration: IntegrationResourceDto) {
    super(integration);
    this.teamId = integration.teamId;
    this.source = integration.source;
    this.definition = integration.definition;
    this.tools = integration.tools;
    this.described = integration.described
      ? new DescribedSourceResponseDto(integration.described)
      : null;
  }
}
