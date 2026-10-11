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

export interface SetupConnectionDto {
  readonly source: string;
  readonly name: string;
  readonly tryIt: string;
  readonly heard: string;
  readonly link: { readonly label: string; readonly url: string } | null;
  readonly firstOpenedAt: Date | null;
}

interface SetupChatDto {
  readonly id: string;
  readonly pullRequest: string | null;
}

export interface OnboardingDto {
  readonly steps: readonly SetupStepDto[];
  readonly setupChat: SetupChatDto | null;
  readonly connections: readonly SetupConnectionDto[];
}
