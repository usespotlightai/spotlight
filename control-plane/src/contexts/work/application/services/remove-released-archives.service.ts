import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { ArchiveStandingsPort } from '@work/application/ports/archive-standings.port';
import type { WorkspaceArchiveStorePort } from '@work/application/ports/workspace-archive-store.port';
import { WorkspaceArchive } from '@work/domain/aggregates/workspace-archive.aggregate';
import { WorkspaceArchiveMovedOnError } from '@work/domain/exceptions/workspace-archive-moved-on.error';
import type { WorkspaceArchiveRepository } from '@work/domain/repositories/workspace-archive.repository';

const MOST_AT_ONCE = 50;

export class RemoveReleasedArchives {
  readonly name = 'Removing workspace archives no later run will restore';

  constructor(
    private readonly standings: ArchiveStandingsPort,
    private readonly archives: WorkspaceArchiveRepository,
    private readonly store: WorkspaceArchiveStorePort,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async workDue(): Promise<void> {
    const now = this.clock.now();

    const due = await this.standings.due(
      WorkspaceArchive.removalCutoffs(now),
      MOST_AT_ONCE,
    );

    for (const each of due) {
      try {
        const archive = await this.archives.find(each.id);

        if (!archive?.removableAt(now, each.facts)) {
          continue;
        }

        await this.archives.save(archive.removed(now, each.facts));
        await this.removeStored(archive);
      } catch (error) {
        if (!(error instanceof WorkspaceArchiveMovedOnError)) {
          this.logger.error({ err: error, archive: each.id.value }, this.name);
        }
      }
    }
  }

  private async removeStored(archive: WorkspaceArchive): Promise<void> {
    try {
      await this.store.remove(archive);
    } catch (error) {
      this.logger.error(
        {
          err: error,
          archive: archive.id.value,
          workspaceId: archive.workspaceId.value,
        },
        'A removed workspace archive was left behind in storage',
      );
    }
  }
}
