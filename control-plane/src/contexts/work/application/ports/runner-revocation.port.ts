import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export const RUNNER_REVOCATION = Symbol('RUNNER_REVOCATION');

export interface RunnerRevocationPort {
  onRunnerRevoked(runnerId: RunnerId): Promise<void>;
}
