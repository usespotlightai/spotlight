import type { ArchiveReferenceLocksPort } from '@runs/application/ports/archive-reference-locks.port';
import type {
  ArchiveCursor,
  ArchiveDue,
  ArchiveReferencesPort,
} from '@runs/application/ports/archive-references.port';
import type { WorkingCopyArchiveStorePort } from '@runs/application/ports/working-copy-archive-store.port';
import type { ArchiveHolders } from '@runs/application/services/archive-holders.service';
import {
  type ArchiveFacts,
  type HolderState,
  WorkingCopyArchive,
} from '@runs/domain/aggregates/working-copy-archive.aggregate';
import { WorkingCopyArchiveVersionConflictError } from '@runs/domain/exceptions/working-copy-archive-version-conflict.error';
import type { WorkingCopyArchiveRepository } from '@runs/domain/repositories/working-copy-archive.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

const MAX_AT_ONCE = 50;

const factsOf = (
  due: ArchiveDue,
  holders: ReadonlyMap<string, HolderState | null>,
): ArchiveFacts => ({
  holder: holders.get(due.workingCopyKey.value) ?? null,
  supersededAt: due.supersededAt,
  lastStartedFromAt: due.lastStartedFromAt,
  pinned: due.pinned,
});

export class RemoveReleasedArchives {
  readonly name = 'Removing working copy archives no later run will restore';

  private after: ArchiveCursor | null = null;

  constructor(
    private readonly references: ArchiveReferencesPort,
    private readonly locks: ArchiveReferenceLocksPort,
    private readonly holders: ArchiveHolders,
    private readonly archives: WorkingCopyArchiveRepository,
    private readonly store: WorkingCopyArchiveStorePort,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async processDue(): Promise<void> {
    const now = this.clock.now();

    const page = await this.references.due(
      WorkingCopyArchive.removalCutoffs(now),
      this.after,
      MAX_AT_ONCE,
    );

    this.after = page.next;

    const holders = await this.holders.stateOf(
      page.due.map((each) => each.workingCopyKey),
    );

    for (const each of page.due) {
      try {
        const removed = await this.removed(each, holders, now);

        if (removed) {
          await this.removeStored(removed);
        }
      } catch (error) {
        if (!(error instanceof WorkingCopyArchiveVersionConflictError)) {
          this.logger.error({ err: error, archive: each.id.value }, this.name);
        }
      }
    }
  }

  private async removed(
    due: ArchiveDue,
    holders: ReadonlyMap<string, HolderState | null>,
    now: Date,
  ): Promise<WorkingCopyArchive | null> {
    const found = await this.archives.find(due.id);

    if (!found) {
      return null;
    }

    return this.locks.removing(found.workspaceId, async () => {
      const archive = await this.archives.find(due.id);
      const references = await this.references.of(due.id);
      const facts = references && factsOf(references, holders);

      if (!archive || !facts || !archive.removableAt(now, facts)) {
        return null;
      }

      await this.archives.save(archive.remove(now, facts));

      return archive;
    });
  }

  private async removeStored(archive: WorkingCopyArchive): Promise<void> {
    try {
      await this.store.remove(archive);
    } catch (error) {
      this.logger.error(
        {
          err: error,
          archive: archive.id.value,
          workspaceId: archive.workspaceId.value,
        },
        'A removed working copy archive was left behind in storage',
      );
    }
  }
}
