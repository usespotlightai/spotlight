import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const MEMBER_DIRECTORY = Symbol('MEMBER_DIRECTORY');

export interface MemberDirectoryPort {
  // Not viewer-scoped. Use it to match an outside email to a member, not to read the roster.
  byEmail(workspaceId: WorkspaceId, email: string): Promise<UserId | null>;
}
