import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const MEMBER_LOOKUP = Symbol('MEMBER_LOOKUP');

export interface MemberLookupPort {
  listedByEmail(
    workspaceId: WorkspaceId,
    email: string,
  ): Promise<UserId | null>;

  emailsOf(userId: UserId): Promise<readonly string[]>;
}
