import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { WorkspaceArchive } from '@work/domain/aggregates/workspace-archive.aggregate';
import type { ResumeKey } from '@work/domain/value-objects/resume-key.vo';
import type { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';

export interface WorkspaceArchiveRepository {
  add(archive: WorkspaceArchive): Promise<void>;

  save(archive: WorkspaceArchive): Promise<void>;

  find(id: WorkspaceArchiveId): Promise<WorkspaceArchive | null>;

  newestCompleted(
    workspaceId: WorkspaceId,
    resumeKey: ResumeKey,
  ): Promise<WorkspaceArchive | null>;
}
