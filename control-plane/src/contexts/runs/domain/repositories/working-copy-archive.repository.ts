import type { WorkingCopyArchive } from '@runs/domain/aggregates/working-copy-archive.aggregate';
import type { WorkingCopyArchiveId } from '@runs/domain/value-objects/working-copy-archive-id.vo';
import type { WorkingCopyKey } from '@runs/domain/value-objects/working-copy-key.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const WORKING_COPY_ARCHIVE_REPOSITORY = Symbol(
  'WORKING_COPY_ARCHIVE_REPOSITORY',
);

export interface WorkingCopyArchiveRepository {
  add(archive: WorkingCopyArchive): Promise<void>;

  save(archive: WorkingCopyArchive): Promise<void>;

  find(id: WorkingCopyArchiveId): Promise<WorkingCopyArchive | null>;

  newestCompleted(
    workspaceId: WorkspaceId,
    workingCopyKey: WorkingCopyKey,
  ): Promise<WorkingCopyArchive | null>;
}
