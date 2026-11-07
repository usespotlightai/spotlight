import type { ArchiveRemovalCutoffs } from '@runs/domain/aggregates/working-copy-archive.aggregate';
import type { WorkingCopyArchiveId } from '@runs/domain/value-objects/working-copy-archive-id.vo';
import type { WorkingCopyKey } from '@runs/domain/value-objects/working-copy-key.vo';

export const ARCHIVE_REFERENCES = Symbol('ARCHIVE_REFERENCES');

export interface ArchiveCursor {
  readonly grantedAt: Date;
  readonly id: WorkingCopyArchiveId;
}

export interface ArchiveDue {
  readonly id: WorkingCopyArchiveId;
  readonly workingCopyKey: WorkingCopyKey;
  readonly grantedAt: Date;
  readonly supersededAt: Date | null;
  readonly lastStartedFromAt: Date | null;
  readonly pinned: boolean;
}

export interface ArchivesDue {
  readonly due: readonly ArchiveDue[];
  readonly next: ArchiveCursor | null;
}

export interface ArchiveReferencesPort {
  of(id: WorkingCopyArchiveId): Promise<ArchiveDue | null>;

  due(
    cutoffs: ArchiveRemovalCutoffs,
    after: ArchiveCursor | null,
    limit: number,
  ): Promise<ArchivesDue>;
}
