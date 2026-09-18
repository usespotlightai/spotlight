import type { InviteStatus } from '@identity/domain/aggregates/invite.aggregate';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export const INVITE_READER = Symbol('INVITE_READER');

export interface InviteSummary {
  readonly id: string;
  readonly email: string;
  readonly invitedBy: string;
  readonly invitedAt: Date;
  readonly expiresAt: Date;
  readonly standing: InviteStatus;
}

export interface InviteOffer {
  readonly email: string;
  readonly teamName: string;
  readonly workspaceName: string;
  readonly invitedBy: string;
  readonly standing: InviteStatus;
}

export interface InviteReaderPort {
  openForTeam(
    teamId: TeamId,
    viewerId: UserId,
  ): Promise<InviteSummary[] | null>;

  withToken(hash: TokenHash): Promise<InviteOffer | null>;
}
