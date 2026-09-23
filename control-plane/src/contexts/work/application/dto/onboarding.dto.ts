import {
  SETUP_STEPS,
  type SetupStepKey,
} from '@work/domain/services/setup-list';

export const SETUP_STEP_KEYS = SETUP_STEPS;

export interface SetupStepDto {
  readonly key: SetupStepKey;
  readonly title: string;
  readonly description: string;
  readonly where: string | null;
  readonly done: boolean;
}

export interface OnboardingDto {
  readonly steps: readonly SetupStepDto[];
  readonly installUrl: string | null;
  readonly connectedToGitHub: boolean;
}
