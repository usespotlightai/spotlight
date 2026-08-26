import type { RunnerRevoked } from '@domain/events/runner-revoked.event';

export const RUNNER_REVOCATION = Symbol('RUNNER_REVOCATION');

export interface RunnerRevocationPort {
  onRunnerRevoked(event: RunnerRevoked): Promise<void>;
}
