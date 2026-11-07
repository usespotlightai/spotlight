import type { ArchiveRemovalCutoffs } from '@runs/domain/aggregates/workspace-archive.aggregate';
import type { WorkspaceArchiveId } from '@runs/domain/value-objects/workspace-archive-id.vo';
import type { WorkspaceKey } from '@runs/domain/value-objects/workspace-key.vo';

export const ARCHIVE_REFERENCES = Symbol('ARCHIVE_REFERENCES');

export interface ArchiveCursor {
  readonly grantedAt: Date;
  readonly id: WorkspaceArchiveId;
}

export interface ArchiveDue {
  readonly id: WorkspaceArchiveId;
  readonly workspaceKey: WorkspaceKey;
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
  of(id: WorkspaceArchiveId): Promise<ArchiveDue | null>;

  due(
    cutoffs: ArchiveRemovalCutoffs,
    after: ArchiveCursor | null,
    limit: number,
  ): Promise<ArchivesDue>;
}
