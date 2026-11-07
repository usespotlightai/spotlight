import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunFacts } from '@work/application/ports/run-facts.port';

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
  assertStillOn(runId: RunId, attempt: number, runner: RunnerId): Promise<void>;
}
