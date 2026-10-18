import type {
  ArchiveFacts,
  ArchiveRemovalCutoffs,
} from '@work/domain/aggregates/workspace-archive.aggregate';
import type { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';

export const ARCHIVE_REFERENCES = Symbol('ARCHIVE_REFERENCES');

export interface ArchiveDue {
  readonly id: WorkspaceArchiveId;
  readonly facts: ArchiveFacts;
}

export interface ArchiveReferencesPort {
  due(
    cutoffs: ArchiveRemovalCutoffs,
    limit: number,
  ): Promise<readonly ArchiveDue[]>;
}
