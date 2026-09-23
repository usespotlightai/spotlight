import { ApiProperty } from '@nestjs/swagger';
import {
  SETUP_STEP_KEYS,
  type SetupStepDto,
} from '@work/application/dto/onboarding.dto';

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

  constructor(
    steps: readonly SetupStepResponseDto[],
    installUrl: string | null,
    connectedToGitHub: boolean,
  ) {
    this.steps = steps;
    this.installUrl = installUrl;
    this.connectedToGitHub = connectedToGitHub;
  }
}
