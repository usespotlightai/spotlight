import type { WorkspaceInvite } from '@identity/domain/aggregates/workspace-invite.aggregate';
import type { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import type { InviteId } from '@identity/domain/value-objects/invite-id.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface WorkspaceInviteRepository {
  add(invite: WorkspaceInvite): Promise<void>;

  save(invite: WorkspaceInvite): Promise<void>;

  find(id: InviteId): Promise<WorkspaceInvite | null>;

  withToken(hash: TokenHash): Promise<WorkspaceInvite | null>;

  notEndedTo(
    workspaceId: WorkspaceId,
    email: EmailAddress,
  ): Promise<WorkspaceInvite | null>;
}
