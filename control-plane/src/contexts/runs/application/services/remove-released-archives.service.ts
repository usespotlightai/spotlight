import type {
  ArchiveCursor,
  ArchiveDue,
  ArchiveReferencesPort,
} from '@runs/application/ports/archive-references.port';
import type { WorkspaceArchiveStorePort } from '@runs/application/ports/workspace-archive-store.port';
import type { ArchiveHolders } from '@runs/application/services/archive-holders.service';
import {
  type ArchiveFacts,
  type HolderState,
  WorkspaceArchive,
} from '@runs/domain/aggregates/workspace-archive.aggregate';
import { WorkspaceArchiveVersionConflictError } from '@runs/domain/exceptions/workspace-archive-version-conflict.error';
import type { WorkspaceArchiveRepository } from '@runs/domain/repositories/workspace-archive.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

const MAX_AT_ONCE = 50;

const factsOf = (
  due: ArchiveDue,
  holders: ReadonlyMap<string, HolderState | null>,
): ArchiveFacts => ({
  holder: holders.get(due.workspaceKey.value) ?? null,
  supersededAt: due.supersededAt,
  lastStartedFromAt: due.lastStartedFromAt,
  pinned: due.pinned,
});

export class RemoveReleasedArchives {
  readonly name = 'Removing workspace archives no later run will restore';

  private after: ArchiveCursor | null = null;

  constructor(
    private readonly references: ArchiveReferencesPort,
    private readonly holders: ArchiveHolders,
    private readonly archives: WorkspaceArchiveRepository,
    private readonly store: WorkspaceArchiveStorePort,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async processDue(): Promise<void> {
    const now = this.clock.now();

    const page = await this.references.due(
      WorkspaceArchive.removalCutoffs(now),
      this.after,
      MAX_AT_ONCE,
    );

    this.after = page.next;

    const holders = await this.holders.stateOf(
      page.due.map((each) => each.workspaceKey),
    );

    for (const each of page.due) {
      const facts = factsOf(each, holders);

      try {
        const archive = await this.archives.find(each.id);

        if (!archive?.removableAt(now, facts)) {
          continue;
        }

        await this.archives.save(archive.remove(now, facts));
        await this.removeStored(archive);
      } catch (error) {
        if (!(error instanceof WorkspaceArchiveVersionConflictError)) {
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
