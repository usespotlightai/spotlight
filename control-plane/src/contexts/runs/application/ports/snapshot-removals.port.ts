import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const SNAPSHOT_REMOVALS = Symbol('SNAPSHOT_REMOVALS');

export interface SnapshotRemoval {
  readonly archiveId: string;
  readonly workspaceId: WorkspaceId;
  readonly store: string;
  readonly snapshot: string;
  readonly queuedAt: Date;
}

// The snapshots of removed archives, until a host of the store deletes them.
export interface SnapshotRemovalsPort {
  queue(removal: SnapshotRemoval): Promise<void>;

  due(
    workspaceId: WorkspaceId,
    store: string,
    limit: number,
  ): Promise<readonly SnapshotRemoval[]>;

  forget(
    workspaceId: WorkspaceId,
    store: string,
    archiveId: string,
  ): Promise<boolean>;
}
