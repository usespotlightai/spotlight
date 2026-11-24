import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const ARCHIVE_REFERENCE_LOCKS = Symbol('ARCHIVE_REFERENCE_LOCKS');

export interface ArchiveReferenceLocksPort {
  referencing<T>(workspaceId: WorkspaceId, work: () => Promise<T>): Promise<T>;

  // Runs work in one transaction, under the workspace's exclusive lock: what work writes is kept whole or not at all.
  removing<T>(workspaceId: WorkspaceId, work: () => Promise<T>): Promise<T>;
}
