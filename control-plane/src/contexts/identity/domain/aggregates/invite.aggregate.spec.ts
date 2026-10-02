import { Invite } from '@identity/domain/aggregates/invite.aggregate';
import { Team } from '@identity/domain/aggregates/team.aggregate';
import { InviteClosedError } from '@identity/domain/exceptions/invite-closed.error';
import { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import { InviteId } from '@identity/domain/value-objects/invite-id.vo';
import { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import { TeamName } from '@identity/domain/value-objects/team-name.vo';
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
const hash = (of: string) => TokenHash.of(of.repeat(64).slice(0, 64));

const platform = Team.rehydrate({
  id: TeamId.of('team_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  key: TeamKey.of('platform'),
  name: TeamName.of('Platform'),
  members: [asker],
  version: 0,
});

const offered = (to = 'ada@example.com') =>
  Invite.offer({
    id: InviteId.of('invite_1'),
    workspaceId: platform.workspaceId,
    teamId: platform.id,
    email: EmailAddress.of(to),
    tokenHash: hash('a'),
    invitedBy: asker,
    now: NOW,
  });

describe('Invite', () => {
  it('is of the workspace the team it is onto belongs to', () => {
    const invite = offered();

    expect(invite.teamId).toBe(platform.id);
    expect(invite.workspaceId).toBe(platform.workspaceId);
  });

  it('says it was offered, so a link going out is never quiet', () => {
    expect(offered().pullEvents()).toMatchObject([
      { kind: 'invite.offered', again: false },
    ]);
  });

  it('says it was taken up, and by whom', () => {
    const accepted = offered().acceptedBySomeone(
      ada,
      EmailAddress.of('ada@example.com'),
      LATER,
    );

    expect(accepted.pullEvents()).toMatchObject([
      { kind: 'invite.offered' },
      { kind: 'invite.accepted', userId: ada },
    ]);
  });

  it('says it was taken back', () => {
    const revoked = offered().revoked(LATER);

    expect(revoked.pullEvents()).toMatchObject([
      { kind: 'invite.offered' },
      { kind: 'invite.revoked' },
    ]);
  });

  it('says a fresh send is the same invite asked again', () => {
    const again = offered().sentAgain({
      freshId: InviteId.of('invite_2'),
      tokenHash: hash('b'),
      by: asker,
      now: LATER,
    });

    expect(again.pullEvents()).toMatchObject([
      { kind: 'invite.offered' },
      { kind: 'invite.offered', again: true },
    ]);
  });

  it('is open until anything happens to it', () => {
    expect(offered().statusAt(NOW)).toBe('open');
  });

  it('runs out a fortnight after it was sent', () => {
    const invite = offered();

    expect(invite.statusAt(LATER)).toBe('open');
    expect(invite.statusAt(AFTER_IT_RUNS_OUT)).toBe('expired');
  });

  it('is taken up by the person it was sent to', () => {
    const accepted = offered().acceptedBySomeone(
      ada,
      EmailAddress.of('ada@example.com'),
      LATER,
    );

    expect(accepted.statusAt(LATER)).toBe('accepted');
    expect(accepted.acceptedBy).toBe(ada);
    expect(accepted.acceptedAt).toEqual(LATER);
  });

  it('refuses somebody signed in as anybody else', () => {
    expect(() =>
      offered().acceptedBySomeone(
        ada,
        EmailAddress.of('someone@example.com'),
        LATER,
      ),
    ).toThrow(/sent to ada@example.com/);
  });

  it('minds nothing but the mailbox in how an address was written', () => {
    const accepted = offered('Ada@Example.com').acceptedBySomeone(
      ada,
      EmailAddress.of('ada@example.com  '),
      LATER,
    );

    expect(accepted.statusAt(LATER)).toBe('accepted');
  });

  it('cannot be taken up twice', () => {
    const accepted = offered().acceptedBySomeone(
      ada,
      EmailAddress.of('ada@example.com'),
      LATER,
    );

    expect(() =>
      accepted.acceptedBySomeone(
        ada,
        EmailAddress.of('ada@example.com'),
        LATER,
      ),
    ).toThrow(/already been accepted/);
  });

  it('cannot be taken up once it has run out', () => {
    expect(() =>
      offered().acceptedBySomeone(
        ada,
        EmailAddress.of('ada@example.com'),
        AFTER_IT_RUNS_OUT,
      ),
    ).toThrow(/run out/);
  });

  it('cannot be taken up once it has been taken back', () => {
    expect(() =>
      offered()
        .revoked(LATER)
        .acceptedBySomeone(ada, EmailAddress.of('ada@example.com'), LATER),
    ).toThrow(/been revoked/);
  });

  it('is revoked once however often it is asked', () => {
    const revoked = offered().revoked(LATER);

    expect(revoked.revoked(AFTER_IT_RUNS_OUT)).toBe(revoked);
    expect(revoked.statusAt(LATER)).toBe('revoked');
  });

  it('cannot be taken back once it has been accepted', () => {
    const accepted = offered().acceptedBySomeone(
      ada,
      EmailAddress.of('ada@example.com'),
      LATER,
    );

    expect(() => accepted.revoked(LATER)).toThrow(/already been accepted/);
  });

  it('sent again once run out carries a new link and stands open from then', () => {
    const again = offered().sentAgain({
      freshId: InviteId.of('invite_2'),
      tokenHash: hash('b'),
      by: asker,
      now: AFTER_IT_RUNS_OUT,
    });

    expect(again.id.value).toBe('invite_1');
    expect(again.tokenHash.value).toBe(hash('b').value);
    expect(again.statusAt(AFTER_IT_RUNS_OUT)).toBe('open');
    expect(again.expiresAt.getTime()).toBeGreaterThan(
      AFTER_IT_RUNS_OUT.getTime(),
    );
  });

  it('sent again is the same invite, to the same person', () => {
    const invite = offered();
    const again = invite.sentAgain({
      freshId: InviteId.of('invite_2'),
      tokenHash: hash('b'),
      by: ada,
      now: LATER,
    });

    expect(again.equals(invite)).toBe(true);
    expect(again.email).toBe(invite.email);
    expect(again.invitedBy).toBe(ada);
  });

  it('sent again once revoked is a fresh invite, leaving the revoked one as it was', () => {
    const revoked = offered().revoked(LATER);
    revoked.pullEvents();

    const fresh = revoked.sentAgain({
      freshId: InviteId.of('invite_2'),
      tokenHash: hash('b'),
      by: ada,
      now: AFTER_IT_RUNS_OUT,
    });

    expect(fresh.id.value).toBe('invite_2');
    expect(fresh.equals(revoked)).toBe(false);
    expect(fresh.email).toEqual(revoked.email);
    expect(fresh.statusAt(AFTER_IT_RUNS_OUT)).toBe('open');
    expect(fresh.pullEvents()).toMatchObject([
      { kind: 'invite.offered', again: false },
    ]);
    expect(revoked.statusAt(AFTER_IT_RUNS_OUT)).toBe('revoked');
    expect(revoked.revokedAt).toEqual(LATER);
  });

  it('refuses to be sent again once accepted', () => {
    const accepted = offered().acceptedBySomeone(
      ada,
      EmailAddress.of('ada@example.com'),
      LATER,
    );

    expect(() =>
      accepted.sentAgain({
        freshId: InviteId.of('invite_2'),
        tokenHash: hash('b'),
        by: asker,
        now: LATER,
      }),
    ).toThrow(InviteClosedError);
  });

  it('refuses to stand as both accepted and revoked', () => {
    expect(() =>
      Invite.rehydrate({
        id: InviteId.of('invite_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        teamId: TeamId.of('team_1'),
        email: EmailAddress.of('ada@example.com'),
        tokenHash: hash('a'),
        invitedBy: asker,
        invitedAt: NOW,
        expiresAt: LATER,
        acceptedAt: LATER,
        acceptedBy: ada,
        revokedAt: LATER,
        version: 1,
      }),
    ).toThrow(/both accepted and revoked/);
  });

  it('refuses to stand as accepted by nobody', () => {
    expect(() =>
      Invite.rehydrate({
        id: InviteId.of('invite_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        teamId: TeamId.of('team_1'),
        email: EmailAddress.of('ada@example.com'),
        tokenHash: hash('a'),
        invitedBy: asker,
        invitedAt: NOW,
        expiresAt: LATER,
        acceptedAt: LATER,
        acceptedBy: null,
        revokedAt: null,
        version: 1,
      }),
    ).toThrow(/accepted by nobody/);
  });

  it('refuses to stand as kept without ever being written', () => {
    expect(() =>
      Invite.rehydrate({
        id: InviteId.of('invite_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        teamId: TeamId.of('team_1'),
        email: EmailAddress.of('ada@example.com'),
        tokenHash: hash('a'),
        invitedBy: asker,
        invitedAt: NOW,
        expiresAt: LATER,
        acceptedAt: null,
        acceptedBy: null,
        revokedAt: null,
        version: 0,
      }),
    ).toThrow(/without ever being written/);
  });

  it('carries the version it was read at through every change, so a stale write is caught', () => {
    const kept = Invite.rehydrate({ ...offered(), version: 4 });

    expect(
      kept.acceptedBySomeone(ada, EmailAddress.of('ada@example.com'), LATER)
        .version,
    ).toBe(4);
    expect(kept.revoked(LATER).version).toBe(4);
    expect(
      kept.sentAgain({
        freshId: InviteId.of('invite_2'),
        tokenHash: hash('b'),
        by: asker,
        now: LATER,
      }).version,
    ).toBe(4);
    expect(offered().isNew).toBe(true);
    expect(kept.isNew).toBe(false);
  });
});
