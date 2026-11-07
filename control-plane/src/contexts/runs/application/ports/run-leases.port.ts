import type { RunFacts } from '@runs/application/ports/run-facts.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export const RUN_LEASES = Symbol('RUN_LEASES');

export interface LeasedAttempt {
  readonly runId: RunId;
  readonly attempt: number;
}

export interface LeasedRun extends RunFacts {
  readonly claimedBy: RunnerId;
  readonly manifest: readonly string[];
  readonly pins: readonly string[];
}

export interface RunLeasesPort {
  leasedBy(runId: RunId, runner: RunnerId): Promise<LeasedRun | null>;
  leaseOf(runId: RunId, runner: RunnerId): Promise<LeasedRun>;
  isStillOn(runId: RunId, attempt: number, runner: RunnerId): Promise<boolean>;
}
