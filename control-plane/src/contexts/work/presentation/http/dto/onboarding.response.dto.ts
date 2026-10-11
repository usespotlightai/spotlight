import { ApiProperty } from '@nestjs/swagger';
import {
  SETUP_STEP_KEYS,
  type SetupConnectionDto,
  type SetupStepDto,
} from '@work/application/dto/onboarding.dto';

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

export class SetupConnectionLinkResponseDto {
  @ApiProperty({ example: 'Open pull requests' })
  readonly label: string;

  @ApiProperty({ example: 'https://github.com/acme/api/pulls' })
  readonly url: string;

  constructor(label: string, url: string) {
    this.label = label;
    this.url = url;
  }
}

export class SetupConnectionResponseDto {
  @ApiProperty({
    description: 'The integration a task can be opened from',
    example: 'github',
  })
  readonly source: string;

  @ApiProperty({ example: 'GitHub' })
  readonly name: string;

  @ApiProperty({
    description: 'What to do there to open a first task',
    example:
      'Add the spotlight label to a pull request, or mention @spotlight on one.',
  })
  readonly tryIt: string;

  @ApiProperty({
    description: 'What a first task from this source means',
    example: 'Review asked for',
  })
  readonly heard: string;

  @ApiProperty({ type: SetupConnectionLinkResponseDto, nullable: true })
  readonly link: SetupConnectionLinkResponseDto | null;

  @ApiProperty({
    description: 'When this source first opened a task for the team',
    type: String,
    format: 'date-time',
    nullable: true,
  })
  readonly firstOpenedAt: string | null;

  constructor(connection: SetupConnectionDto) {
    this.source = connection.source;
    this.name = connection.name;
    this.tryIt = connection.tryIt;
    this.heard = connection.heard;
    this.link = connection.link
      ? new SetupConnectionLinkResponseDto(
          connection.link.label,
          connection.link.url,
        )
      : null;
    this.firstOpenedAt = connection.firstOpenedAt?.toISOString() ?? null;
  }
}

export class SetupChatResponseDto {
  @ApiProperty({ description: 'The team’s setup chat' })
  readonly id: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'https://github.com/acme/infra/pull/12',
    description: 'The pull request it opened with the configuration',
  })
  readonly pullRequest: string | null;

  constructor(id: string, pullRequest: string | null) {
    this.id = id;
    this.pullRequest = pullRequest;
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
    type: SetupChatResponseDto,
    nullable: true,
    description:
      'The chat setting up the team’s configuration as code, the one with a pull request first',
  })
  readonly setupChat: SetupChatResponseDto | null;

  @ApiProperty({
    description:
      'Each source that can open a task, and when it first did, GitHub first',
    type: SetupConnectionResponseDto,
    isArray: true,
  })
  readonly connections: readonly SetupConnectionResponseDto[];

  constructor(
    steps: readonly SetupStepResponseDto[],
    setupChat: SetupChatResponseDto | null,
    connections: readonly SetupConnectionResponseDto[],
  ) {
    this.steps = steps;
    this.setupChat = setupChat;
    this.connections = connections;
  }
}
