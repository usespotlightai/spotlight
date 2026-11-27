export const SETUP_STEP_KEYS = ['github', 'harness', 'configuration'] as const;

type SetupStepKeyName = (typeof SETUP_STEP_KEYS)[number];

export const SETUP_REFUSAL_NAMES = [
  'needs-an-admin',
  'code-unreachable',
  'needs-egress',
] as const;

export type SetupRefusalName = (typeof SETUP_REFUSAL_NAMES)[number];

export const PROVISIONING_NAMES = ['pending', 'done'] as const;

export type ProvisioningName = (typeof PROVISIONING_NAMES)[number];

export interface SetupStepDto {
  readonly key: SetupStepKeyName;
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
  readonly provisioning: ProvisioningName;
  readonly steps: readonly SetupStepDto[];
  readonly canSetUp: boolean;
  readonly setupRefusal: SetupRefusalName | null;
  readonly viewerIsAdmin: boolean;
  readonly setupChat: SetupChatDto | null;
}
