import {
  SETUP_STEPS,
  type SetupStepKey,
} from '@work/domain/services/setup-list';

export const SETUP_STEP_KEYS = SETUP_STEPS;

export interface SetupStepDto {
  readonly key: SetupStepKey;
  readonly title: string;
  readonly description: string;
  readonly done: boolean;
}

interface SetupChatDto {
  readonly id: string | null;
  readonly pullRequest: string | null;
  readonly startedBy: string;
}

export interface OnboardingDto {
  readonly steps: readonly SetupStepDto[];
  readonly canSetUp: boolean;
  readonly setupChat: SetupChatDto | null;
}
