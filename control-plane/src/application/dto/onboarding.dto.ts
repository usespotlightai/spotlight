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

/** A built-in line as it stands, so setup can offer its harness and repositories. */
export interface OnboardingLineDto {
  readonly key: string;
  readonly name: string;
  /** The harness its work stations run on, or null where none is set yet. */
  readonly harness: string | null;
  /** The model that harness answers with, or null where none is set yet. */
  readonly model: string | null;
  /** How hard that harness thinks, or null where none is set yet. */
  readonly effort: string | null;
  readonly repositories: readonly string[];
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
  /** The team's lines, each offered a harness and repositories during setup. */
  readonly lines: readonly OnboardingLineDto[];
  readonly tools: readonly KnownToolDto[];
}
