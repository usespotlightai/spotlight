import { RunGrants } from '@secrets/domain/aggregates/run-grants.aggregate';
import { RunGrantsVersionConflictError } from '@secrets/domain/exceptions/run-grants-version-conflict.error';
import type { RunGrantsRepository } from '@secrets/domain/repositories/run-grants.repository';
import type { RunHold } from '@secrets/domain/value-objects/run-hold.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const ATTEMPTS = 3;

export class RunGrantsKept {
  constructor(private readonly grants: RunGrantsRepository) {}

  async changed(
    run: { readonly hold: RunHold; readonly workspaceId: WorkspaceId },
    change: (held: RunGrants) => RunGrants,
  ): Promise<void> {
    await this.retried(async () => {
      const held =
        (await this.grants.find(run.hold.runId)) ??
        RunGrants.begun(run.hold, run.workspaceId);

      await this.saved(held, change(held));
    });
  }

  async changedIfHeld(
    runId: RunId,
    change: (held: RunGrants) => RunGrants,
  ): Promise<void> {
    await this.retried(async () => {
      const held = await this.grants.find(runId);

      if (held) {
        await this.saved(held, change(held));
      }
    });
  }

  async settled(held: RunGrants, changed: RunGrants): Promise<boolean> {
    try {
      await this.saved(held, changed);
      return changed !== held;
    } catch (error) {
      if (error instanceof RunGrantsVersionConflictError) {
        return false;
      }

      throw error;
    }
  }

  private async saved(held: RunGrants, changed: RunGrants): Promise<void> {
    if (changed !== held) {
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
