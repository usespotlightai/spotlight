import type { Provisioning } from '@work/application/ports/team-provisioning.port';
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

interface SetupCiDto {
  readonly defaultBranch: string;
  readonly defaultBranchProtected: boolean;
  readonly variables: 'written' | 'not-permitted';
}

interface SetupChatDto {
  readonly id: string | null;
  readonly repository: string;
  readonly pullRequest: string | null;
  readonly ci: SetupCiDto | null;
  readonly startedBy: string;
}

export interface OnboardingDto {
  readonly provisioning: Provisioning;
  readonly steps: readonly SetupStepDto[];
  readonly canSetUp: boolean;
  readonly viewerIsAdmin: boolean;
  readonly setupChat: SetupChatDto | null;
}
