import type { SnapshotRemoval } from '@runs/domain/value-objects/snapshot-removal.vo';
import type { WorkingCopyArchiveId } from '@runs/domain/value-objects/working-copy-archive-id.vo';
import type { WorkingCopyStoreName } from '@shared-kernel/domain/value-objects/working-copy-names.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const SNAPSHOT_REMOVALS = Symbol('SNAPSHOT_REMOVALS');

// The snapshots of removed archives, until a host of the store deletes them. A removal stays until such a host forgets
// it: when no host serves the store any more, delete its snapshots in the store and the workspace's removals by hand.
export interface SnapshotRemovalsPort {
  queue(removal: SnapshotRemoval): Promise<void>;

  due(
    workspaceId: WorkspaceId,
    store: WorkingCopyStoreName,
    limit: number,
  ): Promise<readonly SnapshotRemoval[]>;

  forget(
    workspaceId: WorkspaceId,
    store: WorkingCopyStoreName,
    archiveId: WorkingCopyArchiveId,
  ): Promise<boolean>;
}
