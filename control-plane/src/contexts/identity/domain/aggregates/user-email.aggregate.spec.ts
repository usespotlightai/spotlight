import {
  MOST_ADDITIONAL_EMAILS,
  MOST_VERIFICATIONS_PER_HOUR,
  UserEmail,
} from '@identity/domain/aggregates/user-email.aggregate';
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
import { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import { UserEmailId } from '@identity/domain/value-objects/user-email-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-02T09:00:00.000Z');
const LATER = new Date('2026-11-02T20:00:00.000Z');
const NEXT_DAY = new Date('2026-11-03T09:00:00.000Z');

const ada = UserId.of('user_ada');
const grace = UserId.of('user_grace');
const hash = (of: string) => TokenHash.of(of.repeat(64).slice(0, 64));

const added = (email = 'Ada@Work.example.com', held = 0, sentInLastHour = 0) =>
  UserEmail.add({
    id: UserEmailId.of('email_1'),
    userId: ada,
    email: EmailAddress.of(email),
    signInEmail: EmailAddress.of('ada@example.com'),
    held,
    sentInLastHour,
    tokenHash: hash('a'),
    now: NOW,
  });

const verified = (email = added()) =>
  email.verify({ by: ada, owner: null, now: LATER });

describe('UserEmail', () => {
  it('waits for verification for 24 hours, then runs out', () => {
    const email = added();

    expect(email.email.value).toBe('ada@work.example.com');
    expect(email.statusAt(LATER)).toBe('pending');
    expect(email.statusAt(NEXT_DAY)).toBe('expired');
    expect(email.pullEvents()).toEqual([
      new UserEmailAdded(email.id, ada, email.email),
    ]);
  });

  it('refuses the sign-in email as an additional email', () => {
    expect(() => added('ADA@example.com')).toThrow(
      SignInEmailNotAdditionalError,
    );
  });

  it('refuses an address beyond the most a person may add', () => {
    expect(() => added('ada@work.example.com', MOST_ADDITIONAL_EMAILS)).toThrow(
      TooManyEmailsError,
    );
  });

  it('accepts the address of the account itself as its owner', () => {
    expect(
      added().verify({ by: ada, owner: ada, now: LATER }).statusAt(LATER),
    ).toBe('verified');
  });

  it('sends no second link within a minute', () => {
    expect(() =>
      added().resend(hash('b'), new Date(NOW.getTime() + 30_000), 0),
    ).toThrow(VerificationSentRecentlyError);
  });

  it('adds no address once the account used its links for the hour', () => {
    expect(() =>
      added('ada@work.example.com', 0, MOST_VERIFICATIONS_PER_HOUR),
    ).toThrow(TooManyVerificationsSentError);
  });

  it('sends no new link once the account used its links for the hour', () => {
    expect(() =>
      added().resend(hash('b'), NEXT_DAY, MOST_VERIFICATIONS_PER_HOUR),
    ).toThrow(TooManyVerificationsSentError);
  });

  it('counts the links sent in the hour before now', () => {
    expect(UserEmail.sendsCountedSince(NOW)).toEqual(
      new Date('2026-11-02T08:00:00.000Z'),
    );
  });

  it('is verified by the account that added it', () => {
    const email = verified();

    expect(email.statusAt(NEXT_DAY)).toBe('verified');
    expect(email.verifiedAt).toEqual(LATER);
    expect(email.pullEvents().slice(-1)[0]).toEqual(
      new UserEmailVerified(email.id, ada, email.email),
    );
  });

  it('stays verified when the link is opened again', () => {
    const email = verified();

    expect(email.verify({ by: ada, owner: null, now: NEXT_DAY })).toBe(email);
  });

  it('refuses verification by another account', () => {
    expect(() =>
      added().verify({ by: grace, owner: null, now: LATER }),
    ).toThrow(NotYourEmailError);
  });

  it('refuses verification after the link runs out', () => {
    expect(() =>
      added().verify({ by: ada, owner: null, now: NEXT_DAY }),
    ).toThrow(EmailVerificationExpiredError);
  });

  it('refuses verification of an address another account has', () => {
    expect(() => added().verify({ by: ada, owner: grace, now: LATER })).toThrow(
      EmailInUseError,
    );
  });

  it('sends a fresh link for 24 more hours', () => {
    const resent = added().resend(hash('b'), NEXT_DAY, 0);

    expect(resent.tokenHash).toEqual(hash('b'));
    expect(resent.sentAt).toEqual(NEXT_DAY);
    expect(resent.statusAt(NEXT_DAY)).toBe('pending');
  });

  it('sends no link to a verified address', () => {
    expect(() => verified().resend(hash('b'), NEXT_DAY, 0)).toThrow(
      EmailAlreadyVerifiedError,
    );
  });

  it('records its removal', () => {
    const email = added();

    email.pullEvents();

    expect(email.remove().pullEvents()).toEqual([
      new UserEmailRemoved(email.id, ada, email.email),
    ]);
  });
});
