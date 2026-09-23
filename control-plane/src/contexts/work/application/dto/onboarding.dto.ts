import {
  SETUP_STEPS,
  type SetupStepKey,
} from '@work/domain/services/setup-list';

export const SETUP_STEP_KEYS = SETUP_STEPS;

export interface KnownIntegrationDto {
  readonly source: string;
  readonly name: string;
  readonly summary: string;
  readonly deliverTo: string;
}

export interface SetupStepDto {
  readonly key: SetupStepKey;
  readonly title: string;
  readonly description: string;
  readonly where: string | null;
  readonly done: boolean;
}

interface OnboardingLineDto {
  readonly key: string;
  readonly name: string;
  readonly harness: string | null;
  readonly model: string | null;
  readonly effort: string | null;
  readonly repositories: readonly string[];
}

export interface OnboardingDto {
  readonly steps: readonly SetupStepDto[];
  readonly installUrl: string | null;
  readonly connectedToGitHub: boolean;
  readonly configRepository: string | null;
  readonly repositoryOwner: string | null;
  readonly lines: readonly OnboardingLineDto[];
  readonly integrations: readonly KnownIntegrationDto[];
}
