import { InviteAccepted } from '@identity/domain/events/invite-accepted.event';
import { InviteOffered } from '@identity/domain/events/invite-offered.event';
import { InviteRevoked } from '@identity/domain/events/invite-revoked.event';
import { InviteClosedError } from '@identity/domain/exceptions/invite-closed.error';
import { NotYourInviteError } from '@identity/domain/exceptions/not-your-invite.error';
import type { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import type { InviteId } from '@identity/domain/value-objects/invite-id.vo';
import { EventRecorder } from '@shared-kernel/domain/aggregates/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const INVITE_LASTS_FOR_DAYS = 14;

const DAY = 24 * 60 * 60 * 1000;

export type InviteStatus = 'open' | 'accepted' | 'revoked' | 'expired';

const CLOSED_BECAUSE: Record<Exclude<InviteStatus, 'open'>, string> = {
  accepted: 'has already been accepted',
  revoked: 'has been revoked',
  expired: 'has run out. Ask for another',
};

export class Invite extends EventRecorder {
  private constructor(
    readonly id: InviteId,
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly email: EmailAddress,
    readonly tokenHash: TokenHash,
    readonly invitedBy: UserId,
    readonly invitedAt: Date,
    readonly expiresAt: Date,
    readonly acceptedAt: Date | null,
    readonly acceptedBy: UserId | null,
    readonly revokedAt: Date | null,
    readonly version: number,
  ) {
    super();
  }

  static offer(input: {
    id: InviteId;
    workspaceId: WorkspaceId;
    teamId: TeamId;
    email: EmailAddress;
    tokenHash: TokenHash;
    invitedBy: UserId;
    now: Date;
  }): Invite {
    const offered = new Invite(
      input.id,
      input.workspaceId,
      input.teamId,
      input.email,
      input.tokenHash,
      input.invitedBy,
      input.now,
      Invite.expiryFrom(input.now),
      null,
      null,
      null,
      0,
    );

    offered.record(
      new InviteOffered(
        input.id,
        input.teamId,
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
    tokenHash: TokenHash;
    invitedBy: UserId;
    invitedAt: Date;
    expiresAt: Date;
    acceptedAt: Date | null;
    acceptedBy: UserId | null;
    revokedAt: Date | null;
    version: number;
  }): Invite {
    if (!Number.isInteger(input.version) || input.version < 1) {
      throw new InconsistentStateError(
        'invite',
        'was kept without ever being written',
      );
    }
    if (Boolean(input.acceptedAt) !== Boolean(input.acceptedBy)) {
      throw new InconsistentStateError(
        'invite',
        'was accepted by nobody, or by somebody at no time',
      );
    }
    if (input.acceptedAt && input.revokedAt) {
      throw new InconsistentStateError(
        'invite',
        'was both accepted and revoked',
      );
    }

    return new Invite(
      input.id,
      input.workspaceId,
      input.teamId,
      input.email,
      input.tokenHash,
      input.invitedBy,
      input.invitedAt,
      input.expiresAt,
      input.acceptedAt,
      input.acceptedBy,
      input.revokedAt,
      input.version,
    );
  }

  statusAt(now: Date): InviteStatus {
    if (this.acceptedAt) {
      return 'accepted';
    }
    if (this.revokedAt) {
      return 'revoked';
    }

    return this.expiresAt <= now ? 'expired' : 'open';
  }

  isOpenAt(now: Date): boolean {
    return this.statusAt(now) === 'open';
  }

  sentAgain(input: {
    freshId: InviteId;
    tokenHash: TokenHash;
    by: UserId;
    now: Date;
  }): Invite {
    const status = this.statusAt(input.now);

    if (status === 'accepted') {
      throw new InviteClosedError(CLOSED_BECAUSE.accepted);
    }

    if (status === 'revoked') {
      return Invite.offer({
        id: input.freshId,
        workspaceId: this.workspaceId,
        teamId: this.teamId,
        email: this.email,
        tokenHash: input.tokenHash,
        invitedBy: input.by,
        now: input.now,
      });
    }

    const again = new Invite(
      this.id,
      this.workspaceId,
      this.teamId,
      this.email,
      input.tokenHash,
      input.by,
      input.now,
      Invite.expiryFrom(input.now),
      null,
      null,
      null,
      this.version,
    );

    again.inheritEvents(this);
    again.record(
      new InviteOffered(this.id, this.teamId, this.email, input.by, true),
    );

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
      this.tokenHash,
      this.invitedBy,
      this.invitedAt,
      this.expiresAt,
      now,
      who,
      null,
      this.version,
    );

    accepted.inheritEvents(this);
    accepted.record(
      new InviteAccepted(this.id, this.workspaceId, this.teamId, who),
    );

    return accepted;
  }

  revoked(now: Date): Invite {
    if (this.acceptedAt) {
      throw new InviteClosedError(CLOSED_BECAUSE.accepted);
    }
    if (this.revokedAt) {
      return this;
    }

    const revoked = new Invite(
      this.id,
      this.workspaceId,
      this.teamId,
      this.email,
      this.tokenHash,
      this.invitedBy,
      this.invitedAt,
      this.expiresAt,
      null,
      null,
      now,
      this.version,
    );

    revoked.inheritEvents(this);
    revoked.record(new InviteRevoked(this.id, this.teamId, this.email));

    return revoked;
  }

  get isNew(): boolean {
    return this.version === 0;
  }

  equals(other: Invite): boolean {
    return this.id.equals(other.id);
  }

  private static expiryFrom(now: Date): Date {
    return new Date(now.getTime() + INVITE_LASTS_FOR_DAYS * DAY);
  }

  private refuseClosed(now: Date): void {
    const status = this.statusAt(now);

    if (status !== 'open') {
      throw new InviteClosedError(CLOSED_BECAUSE[status]);
    }
  }
}
