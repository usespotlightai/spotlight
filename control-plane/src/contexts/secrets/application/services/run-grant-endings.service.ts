import type {
  RunGrantsPort,
  RunLeaseDto,
} from '@secrets/application/ports/run-grants.port';
import type { RunGrantsChanges } from '@secrets/application/services/run-grants-changes';
import { RunLease } from '@secrets/domain/value-objects/run-lease.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class RunGrantEndings implements RunGrantsPort {
  constructor(
    private readonly changes: RunGrantsChanges,
    private readonly clock: ClockPort,
  ) {}

  leaseLost(lost: RunLeaseDto): Promise<void> {
    const run = runOf(lost);

    return this.changes.changed(run, (current) => current.loseLease(run.lease));
  }

  endedFor(ended: RunLeaseDto): Promise<void> {
    return this.changes.changed(runOf(ended), (current) =>
      current.end(this.clock.now()),
    );
  }
}

const runOf = (lease: RunLeaseDto) => ({
  lease: RunLease.of(RunId.of(lease.runId), lease.attempt),
  workspaceId: WorkspaceId.of(lease.workspaceId),
});
