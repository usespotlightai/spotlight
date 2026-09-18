import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export const RUNNER_IDENTITY = Symbol('RUNNER_IDENTITY');

export interface RunnerIdentityPort {
  identify(token: string | undefined): Promise<RunnerId | null>;
}
