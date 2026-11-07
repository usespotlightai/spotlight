import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const ARCHIVE_REFERENCE_LOCKS = Symbol('ARCHIVE_REFERENCE_LOCKS');

export interface ArchiveReferenceLocksPort {
  referencing<T>(workspaceId: WorkspaceId, work: () => Promise<T>): Promise<T>;

  removing<T>(workspaceId: WorkspaceId, work: () => Promise<T>): Promise<T>;
}
