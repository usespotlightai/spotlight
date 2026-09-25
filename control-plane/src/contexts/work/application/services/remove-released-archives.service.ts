import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { ArchiveStandingsPort } from '@work/application/ports/archive-standings.port';
import type { WorkspaceArchiveStorePort } from '@work/application/ports/workspace-archive-store.port';
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

    for (const due of await this.standings.due(now, MOST_AT_ONCE)) {
      try {
        const archive = await this.archives.find(due.id);

        if (!archive?.removableAt(now, due.facts)) {
          continue;
        }

        await this.store.remove(archive);
        await this.archives.save(archive.removed());
      } catch (error) {
        if (!(error instanceof WorkspaceArchiveMovedOnError)) {
          this.logger.error({ err: error, archive: due.id.value }, this.name);
        }
      }
    }
  }
}
