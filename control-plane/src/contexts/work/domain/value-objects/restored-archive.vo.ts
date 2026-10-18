import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ResumeKey } from '@work/domain/value-objects/resume-key.vo';
import type { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';

export class RestoredArchive {
  private constructor(
    readonly id: WorkspaceArchiveId,
    readonly workspaceId: WorkspaceId,
    readonly resumeKey: ResumeKey,
  ) {}

  static of(
    id: WorkspaceArchiveId,
    workspaceId: WorkspaceId,
    resumeKey: ResumeKey,
  ): RestoredArchive {
    return new RestoredArchive(id, workspaceId, resumeKey);
  }

  restores(workspaceId: WorkspaceId, resumeKey: ResumeKey | null): boolean {
    return (
      resumeKey !== null &&
      this.workspaceId.equals(workspaceId) &&
      this.resumeKey.equals(resumeKey)
    );
  }

  equals(other: RestoredArchive): boolean {
    return (
      this.id.equals(other.id) &&
      this.workspaceId.equals(other.workspaceId) &&
      this.resumeKey.equals(other.resumeKey)
    );
  }
}
