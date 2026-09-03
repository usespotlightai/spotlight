import { ApiProperty } from '@nestjs/swagger';

export class ConfigProblemResponseDto {
  @ApiProperty({ example: '.spotlight/integrations/linear.yml' })
  readonly path: string;

  @ApiProperty({ example: 'happenings.0.when' })
  readonly at: string;

  @ApiProperty({ example: 'must be an expression' })
  readonly reason: string;

  constructor(path: string, at: string, reason: string) {
    this.path = path;
    this.at = at;
    this.reason = reason;
  }
}

export class ConfiguredHappeningResponseDto {
  @ApiProperty({ example: 'linear.issue.completed' })
  readonly happening: string;

  @ApiProperty({ example: 'Issue completed' })
  readonly label: string;

  constructor(happening: string, label: string) {
    this.happening = happening;
    this.label = label;
  }
}

export class ConfiguredIntegrationResponseDto {
  @ApiProperty({ example: 'linear' })
  readonly source: string;

  @ApiProperty({ example: 'Linear' })
  readonly name: string;

  @ApiProperty({
    description: 'Where this host should be told to send its deliveries',
    example: '/api/webhooks/w/acme/linear',
  })
  readonly deliverTo: string;

  @ApiProperty({ example: 'LINEAR_WEBHOOK_SECRET' })
  readonly secret: string;

  @ApiProperty({
    description: 'Whether the workspace has set it. Never its value.',
    example: true,
  })
  readonly secretSet: boolean;

  @ApiProperty({ type: ConfiguredHappeningResponseDto, isArray: true })
  readonly happenings: readonly ConfiguredHappeningResponseDto[];

  constructor(
    source: string,
    name: string,
    deliverTo: string,
    secret: string,
    secretSet: boolean,
    happenings: readonly ConfiguredHappeningResponseDto[],
  ) {
    this.source = source;
    this.name = name;
    this.deliverTo = deliverTo;
    this.secret = secret;
    this.secretSet = secretSet;
    this.happenings = happenings;
  }
}

export class ConfigurationResponseDto {
  @ApiProperty({ nullable: true, type: String, example: 'acme/api' })
  readonly repository: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'a1b2c3d' })
  readonly sha: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly readAt: string | null;

  @ApiProperty({ type: ConfiguredIntegrationResponseDto, isArray: true })
  readonly integrations: readonly ConfiguredIntegrationResponseDto[];

  @ApiProperty({ type: ConfigProblemResponseDto, isArray: true })
  readonly problems: readonly ConfigProblemResponseDto[];

  constructor(
    repository: string | null,
    sha: string | null,
    readAt: string | null,
    integrations: readonly ConfiguredIntegrationResponseDto[],
    problems: readonly ConfigProblemResponseDto[],
  ) {
    this.repository = repository;
    this.sha = sha;
    this.readAt = readAt;
    this.integrations = integrations;
    this.problems = problems;
  }
}

export class ProposedResponseDto {
  @ApiProperty({ example: 'https://github.com/acme/api/pull/4' })
  readonly url: string;

  constructor(url: string) {
    this.url = url;
  }
}

export class SetSecretRequestDto {
  @ApiProperty({
    description: 'What the configuration calls it. Never its value.',
    example: 'LINEAR_WEBHOOK_SECRET',
  })
  readonly name!: string;

  @ApiProperty({
    description: 'Written once and never read back out of Spotlight.',
    example: 'whsec_...',
  })
  readonly value!: string;
}

export class KnownToolResponseDto {
  @ApiProperty({ example: 'linear' })
  readonly source: string;

  @ApiProperty({ example: 'Linear' })
  readonly name: string;

  @ApiProperty({ example: 'Move a task on when its issue is done.' })
  readonly summary: string;

  @ApiProperty({ example: 'the signing secret on the webhook you create' })
  readonly secretCalled: string;

  @ApiProperty({ description: 'Whether this team already listens to it' })
  readonly chosen: boolean;

  constructor(
    source: string,
    name: string,
    summary: string,
    secretCalled: string,
    chosen: boolean,
  ) {
    this.source = source;
    this.name = name;
    this.summary = summary;
    this.secretCalled = secretCalled;
    this.chosen = chosen;
  }
}

export class OnboardingResponseDto {
  @ApiProperty({ description: 'A runner has to be reachable, or nothing runs' })
  readonly hasRunner: boolean;

  @ApiProperty({ description: 'The App has to be installed to read or write' })
  readonly connectedToGitHub: boolean;

  @ApiProperty({ description: 'Configuration has been read at least once' })
  readonly hasConfiguration: boolean;

  @ApiProperty({ type: KnownToolResponseDto, isArray: true })
  readonly tools: readonly KnownToolResponseDto[];

  constructor(
    hasRunner: boolean,
    connectedToGitHub: boolean,
    hasConfiguration: boolean,
    tools: readonly KnownToolResponseDto[],
  ) {
    this.hasRunner = hasRunner;
    this.connectedToGitHub = connectedToGitHub;
    this.hasConfiguration = hasConfiguration;
    this.tools = tools;
  }
}

export class ChooseToolsRequestDto {
  @ApiProperty({
    description: 'The hosts this team uses, by the name each is known by',
    example: ['linear', 'sentry'],
    isArray: true,
    type: String,
  })
  readonly sources!: string[];
}
