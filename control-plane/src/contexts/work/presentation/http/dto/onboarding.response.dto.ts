import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SETUP_STEP_KEYS,
  type SetupStepDto,
} from '@work/application/dto/onboarding.dto';

export class KnownIntegrationResponseDto {
  @ApiProperty({ example: 'linear' })
  readonly source: string;

  @ApiProperty({ example: 'Linear' })
  readonly name: string;

  @ApiProperty({ example: 'Move a task on when its issue is done.' })
  readonly summary: string;

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
    deliverTo: string,
  ) {
    this.source = source;
    this.name = name;
    this.summary = summary;
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
