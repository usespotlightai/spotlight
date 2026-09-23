import { ApiProperty } from '@nestjs/swagger';

export class ConfiguredConnectionResponseDto {
  @ApiProperty({
    description: 'What the host calls the team, where it says; null otherwise',
    example: 'Acme',
    nullable: true,
  })
  readonly handle: string | null;

  constructor(handle: string | null) {
    this.handle = handle;
  }
}

export class ConfiguredIntegrationResponseDto {
  @ApiProperty({ example: 'linear' })
  readonly source: string;

  @ApiProperty({ example: 'Linear' })
  readonly name: string;

  @ApiProperty({
    description: 'Where the integration is defined',
    example: '.spotlight/integrations/linear.yml',
  })
  readonly path: string;

  @ApiProperty({
    description: 'Whether this host is linked by authorizing a connection',
    example: true,
  })
  readonly connectable: boolean;

  @ApiProperty({
    type: ConfiguredConnectionResponseDto,
    nullable: true,
    description: 'The living link, or null where the team has not linked',
  })
  readonly connection: ConfiguredConnectionResponseDto | null;

  constructor(
    source: string,
    name: string,
    path: string,
    connectable: boolean,
    connection: ConfiguredConnectionResponseDto | null,
  ) {
    this.source = source;
    this.name = name;
    this.path = path;
    this.connectable = connectable;
    this.connection = connection;
  }
}

export class ConfigurationResponseDto {
  @ApiProperty({ type: ConfiguredIntegrationResponseDto, isArray: true })
  readonly integrations: readonly ConfiguredIntegrationResponseDto[];

  constructor(integrations: readonly ConfiguredIntegrationResponseDto[]) {
    this.integrations = integrations;
  }
}
