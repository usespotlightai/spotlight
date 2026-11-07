import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';
import type { WorkspaceKey } from '@work/domain/value-objects/workspace-key.vo';

export class RestoredArchive {
  private constructor(
    readonly id: WorkspaceArchiveId,
    readonly workspaceId: WorkspaceId,
    readonly workspaceKey: WorkspaceKey,
  ) {}

  static of(
    id: WorkspaceArchiveId,
    workspaceId: WorkspaceId,
    workspaceKey: WorkspaceKey,
  ): RestoredArchive {
    return new RestoredArchive(id, workspaceId, workspaceKey);
  }

  equals(other: RestoredArchive): boolean {
    return (
      this.id.equals(other.id) &&
      this.workspaceId.equals(other.workspaceId) &&
      this.workspaceKey.equals(other.workspaceKey)
    );
  }
}
