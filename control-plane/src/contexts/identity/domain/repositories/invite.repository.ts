import type { Invite } from '@identity/domain/aggregates/invite.aggregate';
import type { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import type { InviteId } from '@identity/domain/value-objects/invite-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

export interface InviteRepository {
  add(invite: Invite): Promise<void>;

  save(invite: Invite): Promise<void>;

  find(id: InviteId): Promise<Invite | null>;

  withToken(hash: TokenHash): Promise<Invite | null>;

  to(teamId: TeamId, email: EmailAddress): Promise<Invite | null>;
}
