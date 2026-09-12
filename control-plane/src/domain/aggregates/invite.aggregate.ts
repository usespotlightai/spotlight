import { EventRecorder } from '@domain/aggregates/event-recorder';
import type { Team } from '@domain/aggregates/team.aggregate';
import { InviteAccepted } from '@domain/events/invite-accepted.event';
import { InviteOffered } from '@domain/events/invite-offered.event';
import { InviteRevoked } from '@domain/events/invite-revoked.event';
import { InconsistentStateError } from '@domain/exceptions/inconsistent-state.error';
import { InviteClosedError } from '@domain/exceptions/invite-closed.error';
import { NotYourInviteError } from '@domain/exceptions/not-your-invite.error';
import type { EmailAddress } from '@domain/value-objects/email-address.vo';
import type { InviteId } from '@domain/value-objects/invite-id.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import { TeamRole } from '@domain/value-objects/team-role.vo';
import type { TokenHash } from '@domain/value-objects/token-hash.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

export const INVITE_LASTS_FOR_DAYS = 14;

const DAY = 24 * 60 * 60 * 1000;

export type InviteStanding = 'open' | 'accepted' | 'revoked' | 'expired';

export class Invite extends EventRecorder {
  private constructor(
    readonly id: InviteId,
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly email: EmailAddress,
    readonly role: TeamRole,
    readonly tokenHash: TokenHash,
    readonly invitedBy: UserId,
    readonly invitedAt: Date,
    readonly expiresAt: Date,
    readonly acceptedAt: Date | null,
    readonly acceptedBy: UserId | null,
    readonly revokedAt: Date | null,
  ) {
    super();
  }

  static offer(input: {
    id: InviteId;
    team: Team;
    email: EmailAddress;
    role?: TeamRole;
    tokenHash: TokenHash;
    invitedBy: UserId;
    now: Date;
  }): Invite {
    const offered = new Invite(
      input.id,
      input.team.workspaceId,
      input.team.id,
      input.email,
      input.role ?? TeamRole.member,
      input.tokenHash,
      input.invitedBy,
      input.now,
      new Date(input.now.getTime() + INVITE_LASTS_FOR_DAYS * DAY),
      null,
      null,
      null,
    );

    offered.record(
      new InviteOffered(
        input.id,
        input.team.id,
        input.email,
        input.invitedBy,
        false,
      ),
    );

    return offered;
  }

  static rehydrate(input: {
    id: InviteId;
    workspaceId: WorkspaceId;
    teamId: TeamId;
    email: EmailAddress;
    role: TeamRole;
    tokenHash: TokenHash;
    invitedBy: UserId;
    invitedAt: Date;
    expiresAt: Date;
    acceptedAt: Date | null;
    acceptedBy: UserId | null;
    revokedAt: Date | null;
  }): Invite {
    if (Boolean(input.acceptedAt) !== Boolean(input.acceptedBy)) {
      throw new InconsistentStateError(
        'invite',
        'was accepted by nobody, or by somebody at no time',
      );
    }

    return new Invite(
      input.id,
      input.workspaceId,
      input.teamId,
      input.email,
      input.role,
      input.tokenHash,
      input.invitedBy,
      input.invitedAt,
      input.expiresAt,
      input.acceptedAt,
      input.acceptedBy,
      input.revokedAt,
    );
  }

  standingAt(now: Date): InviteStanding {
    if (this.acceptedAt) {
      return 'accepted';
    }
    if (this.revokedAt) {
      return 'revoked';
    }

    return this.expiresAt <= now ? 'expired' : 'open';
  }

  isOpenAt(now: Date): boolean {
    return this.standingAt(now) === 'open';
  }

  sentAgain(tokenHash: TokenHash, by: UserId, now: Date): Invite {
    const again = new Invite(
      this.id,
      this.workspaceId,
      this.teamId,
      this.email,
      this.role,
      tokenHash,
      by,
      now,
      new Date(now.getTime() + INVITE_LASTS_FOR_DAYS * DAY),
      null,
      null,
      null,
    );

    again.inheritEvents(this);
    again.record(new InviteOffered(this.id, this.teamId, this.email, by, true));

    return again;
  }

  acceptedBySomeone(who: UserId, signedInAs: EmailAddress, now: Date): Invite {
    this.refuseClosed(now);

    if (!this.email.equals(signedInAs)) {
      throw new NotYourInviteError(this.email.value);
    }

    const accepted = new Invite(
      this.id,
      this.workspaceId,
      this.teamId,
      this.email,
      this.role,
      this.tokenHash,
      this.invitedBy,
      this.invitedAt,
      this.expiresAt,
      now,
      who,
      null,
    );

    accepted.inheritEvents(this);
    accepted.record(
      new InviteAccepted(
        this.id,
        this.workspaceId,
        this.teamId,
        who,
        this.role,
      ),
    );

    return accepted;
  }

  revoked(now: Date): Invite {
    if (this.acceptedAt) {
      throw new InviteClosedError('has already been accepted');
    }
    if (this.revokedAt) {
      return this;
    }

    const revoked = new Invite(
      this.id,
      this.workspaceId,
      this.teamId,
      this.email,
      this.role,
      this.tokenHash,
      this.invitedBy,
      this.invitedAt,
      this.expiresAt,
      null,
      null,
      now,
    );

    revoked.inheritEvents(this);
    revoked.record(new InviteRevoked(this.id, this.teamId, this.email));

    return revoked;
  }

  equals(other: Invite): boolean {
    return this.id.equals(other.id);
  }

  private refuseClosed(now: Date): void {
    const closed: Partial<Record<InviteStanding, string>> = {
      accepted: 'has already been accepted',
      revoked: 'has been revoked',
      expired: 'has run out. Ask for another',
    };
    const why = closed[this.standingAt(now)];

    if (why) {
      throw new InviteClosedError(why);
    }
  }
}
