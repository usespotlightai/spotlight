import type { RunGrantsUnitOfWork } from '@secrets/application/services/run-grants-unit-of-work';
import { RunGrants } from '@secrets/domain/aggregates/run-grants.aggregate';
import type { RunGrantsRepository } from '@secrets/domain/repositories/run-grants.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const MAX_AT_ONCE = 50;

export class ForgetRunGrants {
  readonly name = 'Forgetting the secret grants of long-ended runs';

  constructor(
    private readonly grants: RunGrantsRepository,
    private readonly unitOfWork: RunGrantsUnitOfWork,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async longEnded(): Promise<number> {
    const now = this.clock.now();
    const endedBy = RunGrants.endedForgettablyBy(now);
    let after: RunId | null = null;
    let forgotten = 0;

    for (;;) {
      const ended = await this.grants.endedBy(endedBy, after, MAX_AT_ONCE);

      for (const runId of ended) {
        if (await this.forgot(runId, now)) {
          forgotten += 1;
        }
      }

      if (ended.length < MAX_AT_ONCE) {
        return forgotten;
      }

      after = ended[ended.length - 1] ?? null;
    }
  }

  async ofWorkspace(workspaceId: WorkspaceId): Promise<void> {
    for (const runId of await this.grants.runsIn(workspaceId)) {
      if (await this.readable(runId)) {
        await this.unitOfWork.changedIfExists(runId, (current) =>
          current.abandon(),
        );
      }
    }
  }

  private async forgot(runId: RunId, now: Date): Promise<boolean> {
    const existing = await this.readable(runId);

    if (!existing?.isForgettableAt(now)) {
      return false;
    }

    return this.unitOfWork.saveIgnoringConflict(existing, existing.purge(now));
  }

  private async readable(runId: RunId): Promise<RunGrants | null> {
    try {
      return await this.grants.find(runId);
    } catch (error) {
      this.logger.warn(
        { err: error, runId: runId.value },
        'Skipping run grants that could not be read back',
      );
      return null;
    }
  }
}
