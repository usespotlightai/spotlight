import type { RunnerClaimant } from '@runners/application/ports/runner-claimants.port';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export const RUNNER_HEARTBEATS = Symbol('RUNNER_HEARTBEATS');

export interface RunnerHeartbeatsPort {
  heartbeat(runnerId: RunnerId, at: Date): Promise<RunnerClaimant | null>;
}
