import type { WorkingCopyArchiveId } from '@runs/domain/value-objects/working-copy-archive-id.vo';
import type { WorkingCopyKey } from '@runs/domain/value-objects/working-copy-key.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class RestoredArchive {
  private constructor(
    readonly id: WorkingCopyArchiveId,
    readonly workspaceId: WorkspaceId,
    readonly workingCopyKey: WorkingCopyKey,
  ) {}

  static of(
    id: WorkingCopyArchiveId,
    workspaceId: WorkspaceId,
    workingCopyKey: WorkingCopyKey,
  ): RestoredArchive {
    return new RestoredArchive(id, workspaceId, workingCopyKey);
  }

  equals(other: RestoredArchive): boolean {
    return (
      this.id.equals(other.id) &&
      this.workspaceId.equals(other.workspaceId) &&
      this.workingCopyKey.equals(other.workingCopyKey)
    );
  }
}
