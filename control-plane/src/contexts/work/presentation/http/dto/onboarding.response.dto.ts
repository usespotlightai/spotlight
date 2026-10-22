import { ApiProperty } from '@nestjs/swagger';
import {
  SETUP_STEP_KEYS,
  type SetupStepDto,
} from '@work/application/dto/onboarding.dto';
import {
  PROVISIONINGS,
  type Provisioning,
} from '@work/application/ports/team-provisioning.port';

export class SetupStepResponseDto {
  @ApiProperty({
    description: 'Which step this is',
    enum: SETUP_STEP_KEYS,
    example: 'github',
  })
  readonly key: SetupStepDto['key'];

  @ApiProperty({ example: 'Install the GitHub App' })
  readonly title: string;

  @ApiProperty()
  readonly description: string;

  @ApiProperty()
  readonly done: boolean;

  constructor(
    key: SetupStepDto['key'],
    title: string,
    description: string,
    done: boolean,
  ) {
    this.key = key;
    this.title = title;
    this.description = description;
    this.done = done;
  }
}

export class SetupCiResponseDto {
  @ApiProperty({
    example: 'main',
    description: 'The default branch, whose pushes may apply',
  })
  readonly defaultBranch: string;

  @ApiProperty({
    description:
      'Whether the default branch has branch protection or a ruleset that requires a pull request review',
  })
  readonly defaultBranchProtected: boolean;

  @ApiProperty({
    enum: ['written', 'not-permitted'],
    description:
      'Whether Spotlight wrote the GitHub Actions variables, or the GitHub App may not write variables',
  })
  readonly variables: 'written' | 'not-permitted';

  constructor(
    defaultBranch: string,
    defaultBranchProtected: boolean,
    variables: 'written' | 'not-permitted',
  ) {
    this.defaultBranch = defaultBranch;
    this.defaultBranchProtected = defaultBranchProtected;
    this.variables = variables;
  }
}

export class SetupChatResponseDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'The team’s setup chat, when the caller started it. Chats are seen only by whoever started them',
  })
  readonly id: string | null;

  @ApiProperty({
    example: 'acme/infra',
    description: 'The repository that holds the configuration',
  })
  readonly repository: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'https://github.com/acme/infra/pull/12',
    description: 'The pull request it opened with the configuration',
  })
  readonly pullRequest: string | null;

  @ApiProperty({
    type: SetupCiResponseDto,
    nullable: true,
    description:
      'The GitHub Actions trusts that the setup created for the repository. Pull requests plan, and pushes to the default branch apply',
  })
  readonly ci: SetupCiResponseDto | null;

  @ApiProperty({
    example: 'Ada Lovelace',
    description: 'Who started it, empty when they have left the workspace',
  })
  readonly startedBy: string;

  constructor(
    id: string | null,
    repository: string,
    pullRequest: string | null,
    ci: SetupCiResponseDto | null,
    startedBy: string,
  ) {
    this.id = id;
    this.repository = repository;
    this.pullRequest = pullRequest;
    this.ci = ci;
    this.startedBy = startedBy;
  }
}

export class OnboardingResponseDto {
  @ApiProperty({
    description:
      'Whether Spotlight has created the first lines and opened the setup task of the team. The value is failed after Spotlight stopped its attempts.',
    enum: PROVISIONINGS,
    example: 'done',
  })
  readonly provisioning: Provisioning;

  @ApiProperty({
    description: 'The list itself, in the order it is worked through',
    type: SetupStepResponseDto,
    isArray: true,
  })
  readonly steps: readonly SetupStepResponseDto[];

  @ApiProperty({
    description:
      'Whether a setup chat can start: the GitHub App is installed and a host runs sandboxes',
  })
  readonly canSetUp: boolean;

  @ApiProperty({
    description:
      'Whether the viewer is a workspace owner or admin. Only they may set up configuration as code, because the setup creates OIDC trusts',
  })
  readonly viewerIsAdmin: boolean;

  @ApiProperty({
    type: SetupChatResponseDto,
    nullable: true,
    description:
      'The chat setting up the team’s configuration as code, the one with a pull request first',
  })
  readonly setupChat: SetupChatResponseDto | null;

  constructor(
    provisioning: Provisioning,
    steps: readonly SetupStepResponseDto[],
    canSetUp: boolean,
    viewerIsAdmin: boolean,
    setupChat: SetupChatResponseDto | null,
  ) {
    this.provisioning = provisioning;
    this.steps = steps;
    this.canSetUp = canSetUp;
    this.viewerIsAdmin = viewerIsAdmin;
    this.setupChat = setupChat;
  }
}
