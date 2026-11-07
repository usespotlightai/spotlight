import type { WorkspaceArchive } from '@runs/domain/aggregates/workspace-archive.aggregate';
import type { WorkspaceArchiveId } from '@runs/domain/value-objects/workspace-archive-id.vo';
import type { WorkspaceKey } from '@runs/domain/value-objects/workspace-key.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface WorkspaceArchiveRepository {
  add(archive: WorkspaceArchive): Promise<void>;

  save(archive: WorkspaceArchive): Promise<void>;

  find(id: WorkspaceArchiveId): Promise<WorkspaceArchive | null>;

  newestCompleted(
    workspaceId: WorkspaceId,
    workspaceKey: WorkspaceKey,
  ): Promise<WorkspaceArchive | null>;
}
