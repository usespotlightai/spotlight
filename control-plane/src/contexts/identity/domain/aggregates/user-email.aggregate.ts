import { UserEmailAdded } from '@identity/domain/events/user-email-added.event';
import { UserEmailRemoved } from '@identity/domain/events/user-email-removed.event';
import { UserEmailVerified } from '@identity/domain/events/user-email-verified.event';
import { EmailAlreadyVerifiedError } from '@identity/domain/exceptions/email-already-verified.error';
import { EmailInUseError } from '@identity/domain/exceptions/email-in-use.error';
import { EmailVerificationExpiredError } from '@identity/domain/exceptions/email-verification-expired.error';
import { NotYourEmailError } from '@identity/domain/exceptions/not-your-email.error';
import { SignInEmailNotAdditionalError } from '@identity/domain/exceptions/sign-in-email-not-additional.error';
import { TooManyEmailsError } from '@identity/domain/exceptions/too-many-emails.error';
import { TooManyVerificationsSentError } from '@identity/domain/exceptions/too-many-verifications-sent.error';
import { VerificationSentRecentlyError } from '@identity/domain/exceptions/verification-sent-recently.error';
import type { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import type { UserEmailId } from '@identity/domain/value-objects/user-email-id.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

const VERIFICATION_LASTS_FOR_HOURS = 24;

const MINUTE = 60 * 1000;

const HOUR = 60 * MINUTE;

const RESEND_AFTER = MINUTE;

export const MOST_ADDITIONAL_EMAILS = 10;

export const MOST_VERIFICATIONS_PER_HOUR = 10;

export type UserEmailStatus = 'verified' | 'pending' | 'expired';

interface State {
  readonly id: UserEmailId;
  readonly userId: UserId;
  readonly email: EmailAddress;
  readonly tokenHash: TokenHash;
  readonly addedAt: Date;
  readonly sentAt: Date;
  readonly expiresAt: Date;
  readonly verifiedAt: Date | null;
  readonly version: number;
}

export class UserEmail extends EventRecorder implements State {
  readonly id: UserEmailId;
  readonly userId: UserId;
  readonly email: EmailAddress;
  readonly tokenHash: TokenHash;
  readonly addedAt: Date;
  readonly sentAt: Date;
  readonly expiresAt: Date;
  readonly verifiedAt: Date | null;
  readonly version: number;

  private constructor(state: State) {
    super();
    this.id = state.id;
    this.userId = state.userId;
    this.email = state.email;
    this.tokenHash = state.tokenHash;
    this.addedAt = state.addedAt;
    this.sentAt = state.sentAt;
    this.expiresAt = state.expiresAt;
    this.verifiedAt = state.verifiedAt;
    this.version = state.version;
  }

  static add(input: {
    id: UserEmailId;
    userId: UserId;
    email: EmailAddress;
    signInEmail: EmailAddress;
    held: number;
    sentInLastHour: number;
    tokenHash: TokenHash;
    now: Date;
  }): UserEmail {
    if (input.email.equals(input.signInEmail)) {
      throw new SignInEmailNotAdditionalError(input.email.value);
    }
    if (input.held >= MOST_ADDITIONAL_EMAILS) {
      throw new TooManyEmailsError(MOST_ADDITIONAL_EMAILS);
    }
    UserEmail.mayVerifyAgain(input.sentInLastHour);

    const added = new UserEmail({
      id: input.id,
      userId: input.userId,
      email: input.email,
      tokenHash: input.tokenHash,
      addedAt: input.now,
      sentAt: input.now,
      expiresAt: UserEmail.expiryFrom(input.now),
      verifiedAt: null,
      version: 0,
    });

    added.record(new UserEmailAdded(added.id, added.userId, added.email));

    return added;
  }

  static statusOf(
    email: { readonly verifiedAt: Date | null; readonly expiresAt: Date },
    now: Date,
  ): UserEmailStatus {
    if (email.verifiedAt) {
      return 'verified';
    }

    return email.expiresAt <= now ? 'expired' : 'pending';
  }

  static rehydrate(input: State): UserEmail {
    if (!Number.isInteger(input.version) || input.version < 1) {
      throw new InconsistentStateError(
        'user email',
        'was stored without ever being written',
      );
    }

    return new UserEmail(input);
  }

  statusAt(now: Date): UserEmailStatus {
    return UserEmail.statusOf(this, now);
  }

  static sendsCountedSince(now: Date): Date {
    return new Date(now.getTime() - HOUR);
  }

  resend(tokenHash: TokenHash, now: Date, sentInLastHour: number): UserEmail {
    if (this.verifiedAt) {
      throw new EmailAlreadyVerifiedError(this.email.value);
    }
    if (now.getTime() - this.sentAt.getTime() < RESEND_AFTER) {
      throw new VerificationSentRecentlyError(this.email.value);
    }
    UserEmail.mayVerifyAgain(sentInLastHour);

    return this.with({
      tokenHash,
      sentAt: now,
      expiresAt: UserEmail.expiryFrom(now),
    });
  }

  verify(input: { by: UserId; owner: UserId | null; now: Date }): UserEmail {
    if (!input.by.equals(this.userId)) {
      throw new NotYourEmailError(this.email.value);
    }
    if (this.verifiedAt) {
      return this;
    }
    if (this.statusAt(input.now) === 'expired') {
      throw new EmailVerificationExpiredError(this.email.value);
    }
    if (input.owner && !input.owner.equals(input.by)) {
      throw new EmailInUseError(this.email.value);
    }

    const verified = this.with({ verifiedAt: input.now });

    verified.record(new UserEmailVerified(this.id, this.userId, this.email));

    return verified;
  }

  remove(): UserEmail {
    const removed = this.with({});

    removed.record(new UserEmailRemoved(this.id, this.userId, this.email));

    return removed;
  }

  private with(over: Partial<State>): UserEmail {
    const next = new UserEmail({ ...this.state, ...over });

    next.inheritEvents(this);

    return next;
  }

  private get state(): State {
    return {
      id: this.id,
      userId: this.userId,
      email: this.email,
      tokenHash: this.tokenHash,
      addedAt: this.addedAt,
      sentAt: this.sentAt,
      expiresAt: this.expiresAt,
      verifiedAt: this.verifiedAt,
      version: this.version,
    };
  }

  private static mayVerifyAgain(sentInLastHour: number): void {
    if (sentInLastHour >= MOST_VERIFICATIONS_PER_HOUR) {
      throw new TooManyVerificationsSentError(MOST_VERIFICATIONS_PER_HOUR);
    }
  }

  private static expiryFrom(now: Date): Date {
    return new Date(now.getTime() + VERIFICATION_LASTS_FOR_HOURS * HOUR);
  }
}
