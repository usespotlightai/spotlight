import type { RunnerId } from '@domain/value-objects/runner-id.vo';

export const RUNNER_AUTH = Symbol('RUNNER_AUTH');

export interface RunnerAuthPort {
  /**
   * The runner this bearer token belongs to, or null when no live token
   * matches. The token identifies the runner: there is nothing else it could
   * be, so a caller cannot claim to be a runner it is not.
   */
  identify(token: string | undefined): Promise<RunnerId | null>;
}
