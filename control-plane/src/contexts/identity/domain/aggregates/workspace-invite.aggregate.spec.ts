import { WorkspaceInvite } from '@identity/domain/aggregates/workspace-invite.aggregate';
import { InviteClosedError } from '@identity/domain/exceptions/invite-closed.error';
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
const asker = UserId.of('user_leon');
const acme = WorkspaceId.of('ws_1');
const hash = (of: string) => TokenHash.of(of.repeat(64).slice(0, 64));

const terms = (role = WorkspaceRole.member, teams = ['team_1']) =>
  InviteTerms.of(
    role,
    teams.map((id) => TeamId.of(id)),
  );

const offered = (to = 'ada@example.com') =>
  WorkspaceInvite.offer({
    id: InviteId.of('invite_1'),
    workspaceId: acme,
    email: EmailAddress.of(to),
    terms: terms(),
    tokenHash: hash('a'),
    invitedBy: asker,
    now: NOW,
  });

const acceptedBy = (invite: WorkspaceInvite, as = 'ada@example.com') =>
  invite.acceptBySomeone(ada, EmailAddress.of(as), LATER);

const sentAgain = (invite: WorkspaceInvite, now = LATER) =>
  invite.resend({
    terms: terms(WorkspaceRole.admin, ['team_2']),
    tokenHash: hash('b'),
    by: ada,
    now,
  });

const kept = (over: Partial<Parameters<typeof WorkspaceInvite.rehydrate>[0]>) =>
  WorkspaceInvite.rehydrate({
    id: InviteId.of('invite_1'),
    workspaceId: acme,
    email: EmailAddress.of('ada@example.com'),
    terms: terms(),
    tokenHash: hash('a'),
    invitedBy: asker,
    invitedAt: NOW,
    expiresAt: LATER,
    acceptedAt: null,
    acceptedBy: null,
    revokedAt: null,
    version: 1,
    ...over,
  });

describe('WorkspaceInvite', () => {
  it('says it was offered, with the role and teams it gives', () => {
    expect(offered().pullEvents()).toMatchObject([
      {
        kind: 'workspace-invite.offered',
        again: false,
        terms: { role: WorkspaceRole.member, teams: [{ value: 'team_1' }] },
      },
    ]);
  });

  it('is open until anything happens to it', () => {
    expect(offered().statusAt(NOW)).toBe('open');
  });

  it('runs out a fortnight after it was sent', () => {
    expect(offered().statusAt(LATER)).toBe('open');
    expect(offered().statusAt(AFTER_IT_RUNS_OUT)).toBe('expired');
  });

  it('is taken up by the person it was sent to, carrying its terms to them', () => {
    const accepted = acceptedBy(offered());

    expect(accepted.statusAt(LATER)).toBe('accepted');
    expect(accepted.acceptedBy).toBe(ada);
    expect(accepted.pullEvents()).toMatchObject([
      { kind: 'workspace-invite.offered' },
      {
        kind: 'workspace-invite.accepted',
        userId: ada,
        terms: { role: WorkspaceRole.member },
      },
    ]);
  });

  it('rejects somebody signed in as anybody else', () => {
    expect(() => acceptedBy(offered(), 'someone@example.com')).toThrow(
      /sent to ada@example.com/,
    );
  });

  it('minds nothing but the mailbox in how an address was written', () => {
    const accepted = acceptedBy(offered('Ada@Example.com'), 'ADA@example.com ');

    expect(accepted.statusAt(LATER)).toBe('accepted');
  });

  it('cannot be taken up twice', () => {
    expect(() => acceptedBy(acceptedBy(offered()))).toThrow(
      /already been accepted/,
    );
  });

  it('cannot be taken up once it has run out', () => {
    expect(() =>
      offered().acceptBySomeone(
        ada,
        EmailAddress.of('ada@example.com'),
        AFTER_IT_RUNS_OUT,
      ),
    ).toThrow(/has expired/);
  });

  it('cannot be taken up once it has been taken back', () => {
    expect(() => acceptedBy(offered().revoke(asker, LATER))).toThrow(
      /been revoked/,
    );
  });

  it('is revoked once however often it is asked, and says so once, naming who took it back', () => {
    const revoked = offered().revoke(ada, LATER);

    expect(revoked.revoke(asker, AFTER_IT_RUNS_OUT)).toBe(revoked);
    expect(revoked.statusAt(LATER)).toBe('revoked');
    expect(revoked.pullEvents()).toMatchObject([
      { kind: 'workspace-invite.offered' },
      { kind: 'workspace-invite.revoked', by: ada },
    ]);
  });

  it('cannot be taken back once it has been accepted', () => {
    expect(() => acceptedBy(offered()).revoke(asker, LATER)).toThrow(
      /already been accepted/,
    );
  });

  it('sent again carries a new link, its new terms, and a fresh fortnight', () => {
    const invite = offered();
    const again = sentAgain(invite, AFTER_IT_RUNS_OUT);

    expect(again.id).toBe(invite.id);
    expect(again.tokenHash.value).toBe(hash('b').value);
    expect(again.terms.role).toBe(WorkspaceRole.admin);
    expect(again.terms.teams.map((each) => each.value)).toEqual(['team_2']);
    expect(again.invitedBy).toBe(ada);
    expect(again.statusAt(AFTER_IT_RUNS_OUT)).toBe('open');
    expect(again.expiresAt.getTime()).toBeGreaterThan(
      AFTER_IT_RUNS_OUT.getTime(),
    );
    expect(again.pullEvents()).toMatchObject([
      { kind: 'workspace-invite.offered', again: false },
      { kind: 'workspace-invite.offered', again: true },
    ]);
  });

  it('is not sent again once accepted or revoked', () => {
    expect(() => sentAgain(acceptedBy(offered()))).toThrow(InviteClosedError);
    expect(() => sentAgain(offered().revoke(asker, LATER))).toThrow(
      InviteClosedError,
    );
  });

  it('counts as closed only once accepted or revoked, not once run out', () => {
    expect(offered().isClosedAt(AFTER_IT_RUNS_OUT)).toBe(false);
    expect(offered().revoke(asker, LATER).isClosedAt(LATER)).toBe(true);
    expect(acceptedBy(offered()).isClosedAt(LATER)).toBe(true);
  });

  it('does not rehydrate as both accepted and revoked', () => {
    expect(() =>
      kept({ acceptedAt: LATER, acceptedBy: ada, revokedAt: LATER }),
    ).toThrow(/both accepted and revoked/);
  });

  it('rehydrates as accepted by an account since deleted', () => {
    const read = kept({ acceptedAt: LATER, acceptedBy: null });

    expect(read.statusAt(LATER)).toBe('accepted');
    expect(read.isClosedAt(LATER)).toBe(true);
  });

  it('rehydrates with an inviter whose account was since deleted', () => {
    expect(kept({ invitedBy: null }).statusAt(NOW)).toBe('open');
  });

  it('does not rehydrate as accepted by somebody at no time', () => {
    expect(() => kept({ acceptedBy: ada })).toThrow(
      /accepted by somebody at no time/,
    );
  });

  it('does not rehydrate as kept without ever being written', () => {
    expect(() => kept({ version: 0 })).toThrow(/without ever being written/);
  });

  it('carries the version it was read at through every change, so a stale write is caught', () => {
    const read = kept({ version: 4, expiresAt: AFTER_IT_RUNS_OUT });

    expect(acceptedBy(read).version).toBe(4);
    expect(read.revoke(asker, NOW).version).toBe(4);
    expect(sentAgain(read).version).toBe(4);
  });

  it('opens a new invite where there is no open one', () => {
    const { invite, again } = WorkspaceInvite.offerTo(null, {
      id: InviteId.of('invite_2'),
      workspaceId: acme,
      email: EmailAddress.of('ada@example.com'),
      terms: terms(),
      tokenHash: hash('c'),
      invitedBy: asker,
      now: LATER,
    });

    expect(again).toBe(false);
    expect(invite.id.value).toBe('invite_2');
    expect(invite.invitedAt).toBe(LATER);
  });

  it('sends the open invite again, on the terms asked now, rather than opening a second', () => {
    const open = kept({ expiresAt: NOW });
    const { invite, again } = WorkspaceInvite.offerTo(open, {
      id: InviteId.of('invite_2'),
      workspaceId: acme,
      email: EmailAddress.of('ada@example.com'),
      terms: terms(WorkspaceRole.admin),
      tokenHash: hash('c'),
      invitedBy: ada,
      now: LATER,
    });

    expect(again).toBe(true);
    expect(invite.id.value).toBe('invite_1');
    expect(invite.terms.invitedAs).toBe('admin');
    expect(invite.invitedBy).toBe(ada);
    expect(invite.statusAt(LATER)).toBe('open');
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

    expect(status({})).toBe('open');
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
