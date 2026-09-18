import {
  CONFIGURATION_MOVE_KINDS,
  type ConfigurationMoveDto,
} from '@configuration/application/dto/configuration.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
    description: 'The file in the configuration repository it is written in',
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
  @ApiProperty({
    description: 'The repository last read from.',
    nullable: true,
    type: String,
    example: 'acme/api',
  })
  readonly repository: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'a1b2c3d' })
  readonly sha: string | null;

  @ApiProperty({ type: ConfiguredIntegrationResponseDto, isArray: true })
  readonly integrations: readonly ConfiguredIntegrationResponseDto[];

  @ApiProperty({
    description:
      'Where this team reads its configuration from: where it keeps it, or else where it was last found.',
    nullable: true,
    type: String,
    example: 'acme/api',
  })
  readonly readsFrom: string | null;

  @ApiProperty({
    description:
      'Where its configuration is moving to, with a pull request open there.',
    nullable: true,
    type: String,
    example: 'acme/config',
  })
  readonly movingTo: string | null;

  constructor(
    repository: string | null,
    sha: string | null,
    integrations: readonly ConfiguredIntegrationResponseDto[],
    readsFrom: string | null,
    movingTo: string | null,
  ) {
    this.repository = repository;
    this.sha = sha;
    this.integrations = integrations;
    this.readsFrom = readsFrom;
    this.movingTo = movingTo;
  }
}

export class MoveConfigurationRequestDto {
  @ApiProperty({
    description: "The repository to move this team's configuration to.",
    example: 'acme/config',
    type: String,
  })
  readonly repository!: string;
}

export class MovedConfigurationResponseDto {
  @ApiProperty({
    description:
      'What the move came to: carried in a pull request the team reads through once merged, adopted where the repository already held configuration, or repointed where there was nothing to carry.',
    enum: CONFIGURATION_MOVE_KINDS,
    example: 'carried',
  })
  readonly kind: ConfigurationMoveDto['kind'];

  @ApiProperty({
    description:
      'The pull request carrying the configuration, where it was carried.',
    example: 'https://github.com/acme/config/pull/4',
    nullable: true,
    type: String,
  })
  readonly url: string | null;

  constructor(kind: ConfigurationMoveDto['kind'], url: string | null) {
    this.kind = kind;
    this.url = url;
  }
}

export class ChooseIntegrationsRequestDto {
  @ApiProperty({
    description: 'The hosts this team uses, by the name each is known by',
    example: ['linear', 'sentry'],
    isArray: true,
    type: String,
  })
  readonly sources!: string[];

  @ApiPropertyOptional({
    description: 'The hosts it no longer uses, whose files the change removes',
    example: ['grafana'],
    isArray: true,
    type: String,
  })
  readonly dropped?: string[];

  @ApiPropertyOptional({
    description:
      'The secrets the chosen integrations read, by name. Spotlight encrypts them into the team’s vault',
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { LINEAR_WEBHOOK_SECRET: 'lin_wh_...' },
  })
  readonly secrets?: Record<string, string>;
}

export class PinConfigurationRequestDto {
  @ApiProperty({
    description:
      'The repository this team reads its configuration from. Null takes the pin off.',
    example: 'acme/api',
    nullable: true,
    type: String,
  })
  readonly repository!: string | null;
}

export class VaultKeyResponseDto {
  @ApiProperty({
    description:
      'The passphrase that opens .spotlight/secrets.vault, as in age -d .spotlight/secrets.vault',
    example: 'Gk3qVb8Rz2mJwYtR9cH4nLpZ6sA1eGuFoKiMxBy7TwQ',
  })
  readonly key: string;

  constructor(key: string) {
    this.key = key;
  }
}
