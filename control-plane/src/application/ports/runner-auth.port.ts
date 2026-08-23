export const RUNNER_AUTH = Symbol('RUNNER_AUTH');

export interface RunnerAuthPort {
  /** Whether this bearer token belongs to a runner allowed to join. */
  admits(token: string | undefined): boolean;
}
