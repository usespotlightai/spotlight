/** One host Spotlight can write a starting file for. */
export interface KnownToolDto {
  readonly source: string;
  readonly name: string;
  readonly summary: string;
  readonly secretCalled: string;
  /** True where this team already listens to it. */
  readonly chosen: boolean;
}

/**
 * What a team still needs before any of this does anything, and what it may
 * choose. Said as plainly as it can be: each of these is something a person
 * has to go and do somewhere else.
 */
export interface OnboardingDto {
  /** A runner has to be reachable, or nothing runs. */
  readonly hasRunner: boolean;
  /** The App has to be installed, or nothing is read or written. */
  readonly connectedToGitHub: boolean;
  /** Configuration has to have been read at least once. */
  readonly hasConfiguration: boolean;
  readonly tools: readonly KnownToolDto[];
}
