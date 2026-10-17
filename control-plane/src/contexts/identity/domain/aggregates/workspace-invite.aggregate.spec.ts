import { WorkspaceInvite } from '@identity/domain/aggregates/workspace-invite.aggregate';
import { InviteNotPendingError } from '@identity/domain/exceptions/invite-not-pending.error';
import { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import { InviteId } from '@identity/domain/value-objects/invite-id.vo';
import { InviteTerms } from '@identity/domain/value-objects/invite-terms.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-12T09:00:00.000Z');
const LATER = new Date('2026-09-13T09:00:00.000Z');
const AFTER_IT_RUNS_OUT = new Date('2026-10-12T09:00:00.000Z');

const ada = UserId.of('user_ada');
const inviter = UserId.of('user_leon');
const acme = WorkspaceId.of('ws_1');
const hash = (of: string) => TokenHash.of(of.repeat(64).slice(0, 64));

const terms = (role = WorkspaceRole.member, teams = ['team_1']) =>
  InviteTerms.of(
    role,
    teams.map((id) => TeamId.of(id)),
  );

const created = (to = 'ada@example.com') =>
  WorkspaceInvite.create({
    id: InviteId.of('invite_1'),
    workspaceId: acme,
    email: EmailAddress.of(to),
    terms: terms(),
    tokenHash: hash('a'),
    invitedBy: inviter,
    now: NOW,
  });

const acceptedBy = (invite: WorkspaceInvite, as = 'ada@example.com') =>
  invite.acceptBySomeone(ada, EmailAddress.of(as), LATER);

const resent = (invite: WorkspaceInvite, now = LATER) =>
  invite.resend({
    terms: terms(WorkspaceRole.admin, ['team_2']),
    tokenHash: hash('b'),
    by: ada,
    now,
  });

const stored = (
  over: Partial<Parameters<typeof WorkspaceInvite.rehydrate>[0]>,
) =>
  WorkspaceInvite.rehydrate({
    id: InviteId.of('invite_1'),
    workspaceId: acme,
    email: EmailAddress.of('ada@example.com'),
    terms: terms(),
    tokenHash: hash('a'),
    invitedBy: inviter,
    invitedAt: NOW,
    expiresAt: LATER,
    acceptedAt: null,
    acceptedBy: null,
    revokedAt: null,
    version: 1,
    ...over,
  });

describe('WorkspaceInvite', () => {
  it('says it was created, with the role and teams it grants', () => {
    expect(created().pullEvents()).toMatchObject([
      {
        kind: 'workspace-invite.created',
        resent: false,
        terms: { role: WorkspaceRole.member, teams: [{ value: 'team_1' }] },
      },
    ]);
  });

  it('is pending until anything happens to it', () => {
    expect(created().statusAt(NOW)).toBe('pending');
  });

  it('runs out a fortnight after it was sent', () => {
    expect(created().statusAt(LATER)).toBe('pending');
    expect(created().statusAt(AFTER_IT_RUNS_OUT)).toBe('expired');
  });

  it('is taken up by the person it was sent to, carrying its terms to them', () => {
    const accepted = acceptedBy(created());

    expect(accepted.statusAt(LATER)).toBe('accepted');
    expect(accepted.acceptedBy).toBe(ada);
    expect(accepted.pullEvents()).toMatchObject([
      { kind: 'workspace-invite.created' },
      {
        kind: 'workspace-invite.accepted',
        userId: ada,
        terms: { role: WorkspaceRole.member },
      },
    ]);
  });

  it('rejects somebody signed in as anybody else', () => {
    expect(() => acceptedBy(created(), 'someone@example.com')).toThrow(
      /sent to ada@example.com/,
    );
  });

  it('minds nothing but the mailbox in how an address was written', () => {
    const accepted = acceptedBy(created('Ada@Example.com'), 'ADA@example.com ');

    expect(accepted.statusAt(LATER)).toBe('accepted');
  });

  it('cannot be taken up twice', () => {
    expect(() => acceptedBy(acceptedBy(created()))).toThrow(
      /already been accepted/,
    );
  });

  it('cannot be taken up once it has run out', () => {
    expect(() =>
      created().acceptBySomeone(
        ada,
        EmailAddress.of('ada@example.com'),
        AFTER_IT_RUNS_OUT,
      ),
    ).toThrow(/has expired/);
  });

  it('cannot be taken up once it has been taken back', () => {
    expect(() => acceptedBy(created().revoke(inviter, LATER))).toThrow(
      /been revoked/,
    );
  });

  it('is revoked once however often revoke is called, and says so once, naming who revoked it', () => {
    const revoked = created().revoke(ada, LATER);

    expect(revoked.revoke(inviter, AFTER_IT_RUNS_OUT)).toBe(revoked);
    expect(revoked.statusAt(LATER)).toBe('revoked');
    expect(revoked.pullEvents()).toMatchObject([
      { kind: 'workspace-invite.created' },
      { kind: 'workspace-invite.revoked', by: ada },
    ]);
  });

  it('cannot be taken back once it has been accepted', () => {
    expect(() => acceptedBy(created()).revoke(inviter, LATER)).toThrow(
      /already been accepted/,
    );
  });

  it('a resent invite carries a new link, its new terms, and a fresh fortnight', () => {
    const invite = created();
    const resentInvite = resent(invite, AFTER_IT_RUNS_OUT);

    expect(resentInvite.id).toBe(invite.id);
    expect(resentInvite.tokenHash.value).toBe(hash('b').value);
    expect(resentInvite.terms.role).toBe(WorkspaceRole.admin);
    expect(resentInvite.terms.teams.map((each) => each.value)).toEqual([
      'team_2',
    ]);
    expect(resentInvite.invitedBy).toBe(ada);
    expect(resentInvite.statusAt(AFTER_IT_RUNS_OUT)).toBe('pending');
    expect(resentInvite.expiresAt.getTime()).toBeGreaterThan(
      AFTER_IT_RUNS_OUT.getTime(),
    );
    expect(resentInvite.pullEvents()).toMatchObject([
      { kind: 'workspace-invite.created', resent: false },
      { kind: 'workspace-invite.created', resent: true },
    ]);
  });

  it('is not resent once accepted or revoked', () => {
    expect(() => resent(acceptedBy(created()))).toThrow(InviteNotPendingError);
    expect(() => resent(created().revoke(inviter, LATER))).toThrow(
      InviteNotPendingError,
    );
  });

  it('counts as ended only once accepted or revoked, not once run out', () => {
    expect(created().hasEndedAt(AFTER_IT_RUNS_OUT)).toBe(false);
    expect(created().revoke(inviter, LATER).hasEndedAt(LATER)).toBe(true);
    expect(acceptedBy(created()).hasEndedAt(LATER)).toBe(true);
  });

  it('does not rehydrate as both accepted and revoked', () => {
    expect(() =>
      stored({ acceptedAt: LATER, acceptedBy: ada, revokedAt: LATER }),
    ).toThrow(/both accepted and revoked/);
  });

  it('rehydrates as accepted by an account since deleted', () => {
    const read = stored({ acceptedAt: LATER, acceptedBy: null });

    expect(read.statusAt(LATER)).toBe('accepted');
    expect(read.hasEndedAt(LATER)).toBe(true);
  });

  it('rehydrates with an inviter whose account was since deleted', () => {
    expect(stored({ invitedBy: null }).statusAt(NOW)).toBe('pending');
  });

  it('does not rehydrate as accepted by somebody at no time', () => {
    expect(() => stored({ acceptedBy: ada })).toThrow(
      /accepted by somebody at no time/,
    );
  });

  it('does not rehydrate as stored without ever being written', () => {
    expect(() => stored({ version: 0 })).toThrow(/without ever being written/);
  });

  it('carries the version it was read at through every change, so a stale write is caught', () => {
    const read = stored({ version: 4, expiresAt: AFTER_IT_RUNS_OUT });

    expect(acceptedBy(read).version).toBe(4);
    expect(read.revoke(inviter, NOW).version).toBe(4);
    expect(resent(read).version).toBe(4);
  });

  it('creates a new invite where there is no pending one', () => {
    const { invite, resent } = WorkspaceInvite.createOrResend(null, {
      id: InviteId.of('invite_2'),
      workspaceId: acme,
      email: EmailAddress.of('ada@example.com'),
      terms: terms(),
      tokenHash: hash('c'),
      invitedBy: inviter,
      now: LATER,
    });

    expect(resent).toBe(false);
    expect(invite.id.value).toBe('invite_2');
    expect(invite.invitedAt).toBe(LATER);
  });

  it('resends the pending invite, on the terms requested now, rather than creating a second', () => {
    const pending = stored({ expiresAt: NOW });
    const { invite, resent } = WorkspaceInvite.createOrResend(pending, {
      id: InviteId.of('invite_2'),
      workspaceId: acme,
      email: EmailAddress.of('ada@example.com'),
      terms: terms(WorkspaceRole.admin),
      tokenHash: hash('c'),
      invitedBy: ada,
      now: LATER,
    });

    expect(resent).toBe(true);
    expect(invite.id.value).toBe('invite_1');
    expect(invite.terms.invitedAs).toBe('admin');
    expect(invite.invitedBy).toBe(ada);
    expect(invite.statusAt(LATER)).toBe('pending');
  });

  it('tells its status from when it was accepted, revoked and runs out', () => {
    const status = (over: { acceptedAt?: Date; revokedAt?: Date }) =>
      WorkspaceInvite.statusOf(
        {
          acceptedAt: over.acceptedAt ?? null,
          revokedAt: over.revokedAt ?? null,
          expiresAt: LATER,
        },
        NOW,
      );

    expect(status({})).toBe('pending');
    expect(status({ acceptedAt: NOW })).toBe('accepted');
    expect(status({ revokedAt: NOW })).toBe('revoked');
    expect(
      WorkspaceInvite.statusOf(
        { acceptedAt: null, revokedAt: null, expiresAt: NOW },
        NOW,
      ),
    ).toBe('expired');
  });
});
