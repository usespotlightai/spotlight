import { ApiProperty } from '@nestjs/swagger';
import {
  SETUP_STEP_KEYS,
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

export class OnboardingResponseDto {
  @ApiProperty({
    description: 'The list itself, in the order it is worked through',
    type: SetupStepResponseDto,
    isArray: true,
  })
  readonly steps: readonly SetupStepResponseDto[];

  constructor(steps: readonly SetupStepResponseDto[]) {
    this.steps = steps;
  }
}
