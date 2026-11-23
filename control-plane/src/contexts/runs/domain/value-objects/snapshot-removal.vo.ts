import { StoreSnapshot } from '@runs/domain/value-objects/archive-location.vo';
import type { WorkingCopyArchiveId } from '@runs/domain/value-objects/working-copy-archive-id.vo';
import type {
  SnapshotName,
  WorkingCopyStoreName,
} from '@shared-kernel/domain/value-objects/working-copy-names.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

// The snapshot of a removed archive, which a host of its store deletes: Spotlight cannot reach the store.
export class SnapshotRemoval {
  private constructor(
    readonly archiveId: WorkingCopyArchiveId,
    readonly workspaceId: WorkspaceId,
    readonly store: WorkingCopyStoreName,
    readonly queuedAt: Date,
  ) {}

  static of(input: {
    archiveId: WorkingCopyArchiveId;
    workspaceId: WorkspaceId;
    store: WorkingCopyStoreName;
    queuedAt: Date;
  }): SnapshotRemoval {
    return new SnapshotRemoval(
      input.archiveId,
      input.workspaceId,
      input.store,
      input.queuedAt,
    );
  }

  get snapshot(): SnapshotName {
    return StoreSnapshot.nameOf(this.archiveId);
  }
}
