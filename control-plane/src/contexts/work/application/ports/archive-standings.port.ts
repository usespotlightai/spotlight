import type { ArchiveFacts } from '@work/domain/aggregates/workspace-archive.aggregate';
import type { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';

export const ARCHIVE_STANDINGS = Symbol('ARCHIVE_STANDINGS');

export interface ArchiveDue {
  readonly id: WorkspaceArchiveId;
  readonly facts: ArchiveFacts;
}

export interface ArchiveStandingsPort {
  due(now: Date, limit: number): Promise<readonly ArchiveDue[]>;
}
