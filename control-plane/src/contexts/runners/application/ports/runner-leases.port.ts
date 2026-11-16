import type { LeasedWork } from '@runners/application/ports/runners.port';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export const RUNNER_LEASES = Symbol('RUNNER_LEASES');

export interface RunnerLeasesPort {
  leaseOf(runnerId: RunnerId): Promise<LeasedWork | null>;
}
