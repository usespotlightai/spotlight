import { SETUP_STEPS, type SetupStepKey } from '@domain/services/setup-list';

/** The steps this contract names. The list is the domain's; publishing it is this layer's. */
export const SETUP_STEP_KEYS = SETUP_STEPS;

/** One host Spotlight can write a starting file for. */
export interface KnownToolDto {
  readonly source: string;
  readonly name: string;
  readonly summary: string;
  readonly secretCalled: string;
  readonly chosen: boolean;
}

export interface SetupStepDto {
  readonly key: SetupStepKey;
  readonly title: string;
  readonly description: string;
  readonly where: string | null;
  readonly done: boolean;
}

/** What a team still needs before any of this does anything. */
export interface OnboardingDto {
  /** The list itself, in the order it is worked through. */
  readonly steps: readonly SetupStepDto[];
  /** Where to go and install the App, or null where GitHub would not say. */
  readonly installUrl: string | null;
  readonly connectedToGitHub: boolean;
  /** Null where nobody chose, and then the fallback scan answers instead. */
  readonly configRepository: string | null;
  /** The account repositories are named under, so only the name is typed. */
  readonly repositoryOwner: string | null;
  readonly tools: readonly KnownToolDto[];
}
