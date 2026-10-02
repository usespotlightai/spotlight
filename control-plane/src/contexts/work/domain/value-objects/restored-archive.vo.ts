import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ContinuityKey } from '@work/domain/value-objects/continuity-key.vo';
import type { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';

export class RestoredArchive {
  private constructor(
    readonly id: WorkspaceArchiveId,
    readonly workspaceId: WorkspaceId,
    readonly continuity: ContinuityKey,
  ) {}

  static of(
    id: WorkspaceArchiveId,
    workspaceId: WorkspaceId,
    continuity: ContinuityKey,
  ): RestoredArchive {
    return new RestoredArchive(id, workspaceId, continuity);
  }

  restores(
    workspaceId: WorkspaceId,
    continuity: ContinuityKey | null,
  ): boolean {
    return (
      continuity !== null &&
      this.workspaceId.equals(workspaceId) &&
      this.continuity.equals(continuity)
    );
  }

  equals(other: RestoredArchive): boolean {
    return (
      this.id.equals(other.id) &&
      this.workspaceId.equals(other.workspaceId) &&
      this.continuity.equals(other.continuity)
    );
  }
}
