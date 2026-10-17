import { WorkspaceInviteAccepted } from '@identity/domain/events/workspace-invite-accepted.event';
import { WorkspaceInviteOffered } from '@identity/domain/events/workspace-invite-offered.event';
import { WorkspaceInviteRevoked } from '@identity/domain/events/workspace-invite-revoked.event';
import { InviteClosedError } from '@identity/domain/exceptions/invite-closed.error';
import { NotYourInviteError } from '@identity/domain/exceptions/not-your-invite.error';
import type { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import type { InviteId } from '@identity/domain/value-objects/invite-id.vo';
import type { InviteTerms } from '@identity/domain/value-objects/invite-terms.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const INVITE_LASTS_FOR_DAYS = 14;

const DAY = 24 * 60 * 60 * 1000;

export type InviteStatus = 'open' | 'accepted' | 'revoked' | 'expired';

const CLOSED_BECAUSE: Record<Exclude<InviteStatus, 'open'>, string> = {
  accepted: 'has already been accepted',
  revoked: 'has been revoked',
  expired: 'has expired. Please ask for a new one',
};

interface State {
  readonly id: InviteId;
  readonly workspaceId: WorkspaceId;
  readonly email: EmailAddress;
  readonly terms: InviteTerms;
  readonly tokenHash: TokenHash;
  readonly invitedBy: UserId | null;
  readonly invitedAt: Date;
  readonly expiresAt: Date;
  readonly acceptedAt: Date | null;
  readonly acceptedBy: UserId | null;
  readonly revokedAt: Date | null;
  readonly version: number;
}

export class WorkspaceInvite extends EventRecorder implements State {
  readonly id: InviteId;
  readonly workspaceId: WorkspaceId;
  readonly email: EmailAddress;
  readonly terms: InviteTerms;
  readonly tokenHash: TokenHash;
  readonly invitedBy: UserId | null;
  readonly invitedAt: Date;
  readonly expiresAt: Date;
  readonly acceptedAt: Date | null;
  readonly acceptedBy: UserId | null;
  readonly revokedAt: Date | null;
  readonly version: number;

  private constructor(state: State) {
    super();
    this.id = state.id;
    this.workspaceId = state.workspaceId;
    this.email = state.email;
    this.terms = state.terms;
    this.tokenHash = state.tokenHash;
    this.invitedBy = state.invitedBy;
    this.invitedAt = state.invitedAt;
    this.expiresAt = state.expiresAt;
    this.acceptedAt = state.acceptedAt;
    this.acceptedBy = state.acceptedBy;
    this.revokedAt = state.revokedAt;
    this.version = state.version;
  }

  static offer(input: {
    id: InviteId;
    workspaceId: WorkspaceId;
    email: EmailAddress;
    terms: InviteTerms;
    tokenHash: TokenHash;
    invitedBy: UserId;
    now: Date;
  }): WorkspaceInvite {
    const offered = new WorkspaceInvite({
      id: input.id,
      workspaceId: input.workspaceId,
      email: input.email,
      terms: input.terms,
      tokenHash: input.tokenHash,
      invitedBy: input.invitedBy,
      invitedAt: input.now,
      expiresAt: WorkspaceInvite.expiryFrom(input.now),
      acceptedAt: null,
      acceptedBy: null,
      revokedAt: null,
      version: 0,
    });

    offered.record(offered.offered(input.invitedBy, false));

    return offered;
  }

  static offerTo(
    open: WorkspaceInvite | null,
    input: {
      id: InviteId;
      workspaceId: WorkspaceId;
      email: EmailAddress;
      terms: InviteTerms;
      tokenHash: TokenHash;
      invitedBy: UserId;
      now: Date;
    },
  ): { invite: WorkspaceInvite; again: boolean } {
    if (open && !open.isClosedAt(input.now)) {
      return {
        invite: open.resend({
          terms: input.terms,
          tokenHash: input.tokenHash,
          by: input.invitedBy,
          now: input.now,
        }),
        again: true,
      };
    }

    return { invite: WorkspaceInvite.offer(input), again: false };
  }

  static statusOf(
    invite: {
      readonly acceptedAt: Date | null;
      readonly revokedAt: Date | null;
      readonly expiresAt: Date;
    },
    now: Date,
  ): InviteStatus {
    if (invite.acceptedAt) {
      return 'accepted';
    }
    if (invite.revokedAt) {
      return 'revoked';
    }

    return invite.expiresAt <= now ? 'expired' : 'open';
  }

  static rehydrate(input: State): WorkspaceInvite {
    if (!Number.isInteger(input.version) || input.version < 1) {
      throw new InconsistentStateError(
        'invite',
        'was kept without ever being written',
      );
    }
    if (input.acceptedBy && !input.acceptedAt) {
      throw new InconsistentStateError(
        'invite',
        'was accepted by somebody at no time',
      );
    }
    if (input.acceptedAt && input.revokedAt) {
      throw new InconsistentStateError(
        'invite',
        'was both accepted and revoked',
      );
    }

    return new WorkspaceInvite(input);
  }

  statusAt(now: Date): InviteStatus {
    return WorkspaceInvite.statusOf(this, now);
  }

  isClosedAt(now: Date): boolean {
    const status = this.statusAt(now);

    return status === 'accepted' || status === 'revoked';
  }

  resend(input: {
    terms: InviteTerms;
    tokenHash: TokenHash;
    by: UserId;
    now: Date;
  }): WorkspaceInvite {
    const status = this.statusAt(input.now);

    if (status === 'accepted' || status === 'revoked') {
      throw new InviteClosedError(CLOSED_BECAUSE[status]);
    }

    const again = this.with({
      terms: input.terms,
      tokenHash: input.tokenHash,
      invitedBy: input.by,
      invitedAt: input.now,
      expiresAt: WorkspaceInvite.expiryFrom(input.now),
    });

    again.record(again.offered(input.by, true));

    return again;
  }

  acceptBySomeone(
    who: UserId,
    signedInAs: EmailAddress,
    now: Date,
  ): WorkspaceInvite {
    const status = this.statusAt(now);

    if (status !== 'open') {
      throw new InviteClosedError(CLOSED_BECAUSE[status]);
    }
    if (!this.email.equals(signedInAs)) {
      throw new NotYourInviteError(this.email.value);
    }

    const accepted = this.with({ acceptedAt: now, acceptedBy: who });

    accepted.record(
      new WorkspaceInviteAccepted(this.id, this.workspaceId, this.terms, who),
    );

    return accepted;
  }

  revoke(by: UserId, now: Date): WorkspaceInvite {
    if (this.acceptedAt) {
      throw new InviteClosedError(CLOSED_BECAUSE.accepted);
    }
    if (this.revokedAt) {
      return this;
    }

    const revoked = this.with({ revokedAt: now });

    revoked.record(
      new WorkspaceInviteRevoked(this.id, this.workspaceId, this.email, by),
    );

    return revoked;
  }

  private offered(by: UserId, again: boolean): WorkspaceInviteOffered {
    return new WorkspaceInviteOffered(
      this.id,
      this.workspaceId,
      this.email,
      this.terms,
      by,
      again,
    );
  }

  private with(over: Partial<State>): WorkspaceInvite {
    const next = new WorkspaceInvite({ ...this.state, ...over });

    next.inheritEvents(this);

    return next;
  }

  private get state(): State {
    return {
      id: this.id,
      workspaceId: this.workspaceId,
      email: this.email,
      terms: this.terms,
      tokenHash: this.tokenHash,
      invitedBy: this.invitedBy,
      invitedAt: this.invitedAt,
      expiresAt: this.expiresAt,
      acceptedAt: this.acceptedAt,
      acceptedBy: this.acceptedBy,
      revokedAt: this.revokedAt,
      version: this.version,
    };
  }

  private static expiryFrom(now: Date): Date {
    return new Date(now.getTime() + INVITE_LASTS_FOR_DAYS * DAY);
  }
}
