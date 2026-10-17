import { RunGrants } from '@secrets/domain/aggregates/run-grants.aggregate';
import { RunGrantsVersionConflictError } from '@secrets/domain/exceptions/run-grants-version-conflict.error';
import type { RunGrantsRepository } from '@secrets/domain/repositories/run-grants.repository';
import type { RunLease } from '@secrets/domain/value-objects/run-lease.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const ATTEMPTS = 3;

export class RunGrantsKept {
  constructor(private readonly grants: RunGrantsRepository) {}

  async changed(
    run: { readonly lease: RunLease; readonly workspaceId: WorkspaceId },
    change: (current: RunGrants) => RunGrants,
  ): Promise<void> {
    await this.retried(async () => {
      const current =
        (await this.grants.find(run.lease.runId)) ??
        RunGrants.start(run.lease, run.workspaceId);

      await this.saved(current, change(current));
    });
  }

  async changedIfExists(
    runId: RunId,
    change: (current: RunGrants) => RunGrants,
  ): Promise<void> {
    await this.retried(async () => {
      const current = await this.grants.find(runId);

      if (current) {
        await this.saved(current, change(current));
      }
    });
  }

  async settled(current: RunGrants, changed: RunGrants): Promise<boolean> {
    try {
      await this.saved(current, changed);
      return changed !== current;
    } catch (error) {
      if (error instanceof RunGrantsVersionConflictError) {
        return false;
      }

      throw error;
    }
  }

  private async saved(current: RunGrants, changed: RunGrants): Promise<void> {
    if (changed !== current) {
      await this.grants.save(changed);
    }
  }

  private async retried(attempt: () => Promise<void>): Promise<void> {
    for (let left = ATTEMPTS; ; left -= 1) {
      try {
        return await attempt();
      } catch (error) {
        if (!(error instanceof RunGrantsVersionConflictError) || left <= 1) {
          throw error;
        }
      }
    }
  }
}
