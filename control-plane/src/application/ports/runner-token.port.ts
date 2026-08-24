export const RUNNER_TOKEN = Symbol('RUNNER_TOKEN');

export interface MintedToken {
  /** Shown to the person enrolling the runner, once. */
  readonly token: string;
  /** All that is kept. */
  readonly hash: string;
}

export interface RunnerTokenPort {
  mint(): MintedToken;

  hash(token: string): string;
}
