import {
  CONFIGURATION_MOVE_KINDS,
  type ConfigurationMoveDto,
} from '@application/dto/configuration.dto';
import {
  SETUP_STEP_KEYS,
  type SetupStepDto,
} from '@application/dto/onboarding.dto';
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

export class ProposedResponseDto {
  @ApiProperty({ example: 'https://github.com/acme/api/pull/4' })
  readonly url: string;

  constructor(url: string) {
    this.url = url;
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

export class KnownIntegrationResponseDto {
  @ApiProperty({ example: 'linear' })
  readonly source: string;

  @ApiProperty({ example: 'Linear' })
  readonly name: string;

  @ApiProperty({ example: 'Move a task on when its issue is done.' })
  readonly summary: string;

  @ApiProperty({
    description: 'The secrets its starting file reads, by name',
    example: ['LINEAR_WEBHOOK_SECRET'],
    isArray: true,
    type: String,
  })
  readonly secrets: readonly string[];

  @ApiProperty({
    description: 'Where this integration should be told to send its deliveries',
    example:
      'https://hooks.usespotlight.ai/api/webhooks/w/acme/t/platform/linear',
  })
  readonly deliverTo: string;

  constructor(
    source: string,
    name: string,
    summary: string,
    secrets: readonly string[],
    deliverTo: string,
  ) {
    this.source = source;
    this.name = name;
    this.summary = summary;
    this.secrets = secrets;
    this.deliverTo = deliverTo;
  }
}

export class SetupStepResponseDto {
  @ApiProperty({
    description: 'Which step this is',
    enum: SETUP_STEP_KEYS,
    example: 'runner',
  })
  readonly key: SetupStepDto['key'];

  @ApiProperty({ example: 'Start a runner' })
  readonly title: string;

  @ApiProperty()
  readonly description: string;

  @ApiProperty({
    description:
      'The page in Spotlight this step is taken from, or null where there is none',
    nullable: true,
    type: String,
    example: '/w/acme/runners',
  })
  readonly where: string | null;

  @ApiProperty()
  readonly done: boolean;

  constructor(
    key: SetupStepDto['key'],
    title: string,
    description: string,
    where: string | null,
    done: boolean,
  ) {
    this.key = key;
    this.title = title;
    this.description = description;
    this.where = where;
    this.done = done;
  }
}

export class OnboardingLineResponseDto {
  @ApiProperty({ example: 'delivery' })
  readonly key: string;

  @ApiProperty({ example: 'Delivery' })
  readonly name: string;

  @ApiProperty({ nullable: true, type: String, example: 'claude-code' })
  readonly harness: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'claude-sonnet-5' })
  readonly model: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'high' })
  readonly effort: string | null;

  @ApiProperty({ isArray: true, type: String, example: ['acme/api'] })
  readonly repositories: readonly string[];

  constructor(
    key: string,
    name: string,
    harness: string | null,
    model: string | null,
    effort: string | null,
    repositories: readonly string[],
  ) {
    this.key = key;
    this.name = name;
    this.harness = harness;
    this.model = model;
    this.effort = effort;
    this.repositories = repositories;
  }
}

export class OnboardingResponseDto {
  @ApiProperty({
    description: 'The list itself, in the order it is worked through',
    type: SetupStepResponseDto,
    isArray: true,
  })
  readonly steps: readonly SetupStepResponseDto[];

  @ApiProperty({
    description: 'Where to install the App, or null where GitHub would not say',
    nullable: true,
    type: String,
    example: 'https://github.com/apps/spotlight/installations/new',
  })
  readonly installUrl: string | null;

  @ApiProperty({ description: 'The App has to be installed to read or write' })
  readonly connectedToGitHub: boolean;

  @ApiProperty({ nullable: true, type: String, example: 'acme/api' })
  readonly configRepository: string | null;

  @ApiProperty({
    description: 'The account repositories are named under, or null',
    nullable: true,
    type: String,
    example: 'acme',
  })
  readonly repositoryOwner: string | null;

  @ApiProperty({ type: OnboardingLineResponseDto, isArray: true })
  readonly lines: readonly OnboardingLineResponseDto[];

  @ApiProperty({ type: KnownIntegrationResponseDto, isArray: true })
  readonly integrations: readonly KnownIntegrationResponseDto[];

  constructor(
    steps: readonly SetupStepResponseDto[],
    installUrl: string | null,
    connectedToGitHub: boolean,
    configRepository: string | null,
    repositoryOwner: string | null,
    lines: readonly OnboardingLineResponseDto[],
    integrations: readonly KnownIntegrationResponseDto[],
  ) {
    this.steps = steps;
    this.installUrl = installUrl;
    this.connectedToGitHub = connectedToGitHub;
    this.configRepository = configRepository;
    this.repositoryOwner = repositoryOwner;
    this.lines = lines;
    this.integrations = integrations;
  }
}

export class SetUpLineRequestDto {
  @ApiProperty({ example: 'delivery' })
  readonly key!: string;

  @ApiPropertyOptional({ nullable: true, type: String, example: 'claude-code' })
  readonly harness?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    example: 'claude-sonnet-5',
  })
  readonly model?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, example: 'high' })
  readonly effort?: string | null;

  @ApiProperty({ isArray: true, type: String, example: ['acme/api'] })
  readonly repositories!: string[];
}

export class SetUpLinesRequestDto {
  @ApiProperty({ type: SetUpLineRequestDto, isArray: true })
  readonly lines!: SetUpLineRequestDto[];
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
