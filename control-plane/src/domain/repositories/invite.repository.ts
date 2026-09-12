import type { Invite } from '@domain/aggregates/invite.aggregate';
import type { EmailAddress } from '@domain/value-objects/email-address.vo';
import type { InviteId } from '@domain/value-objects/invite-id.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { TokenHash } from '@domain/value-objects/token-hash.vo';

export interface InviteRepository {
  add(invite: Invite): Promise<void>;

  save(invite: Invite): Promise<void>;

  find(id: InviteId): Promise<Invite | null>;

  withToken(hash: TokenHash): Promise<Invite | null>;

  to(teamId: TeamId, email: EmailAddress): Promise<Invite | null>;
}
