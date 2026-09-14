import type { RunnerId } from '@domain/value-objects/runner-id.vo';

export const RUNNER_AUTH = Symbol('RUNNER_AUTH');

export interface RunnerAuthPort {
  identify(token: string | undefined): Promise<RunnerId | null>;
}
