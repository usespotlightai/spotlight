import { Invite } from '@domain/aggregates/invite.aggregate';
import { Team } from '@domain/aggregates/team.aggregate';
import { EmailAddress } from '@domain/value-objects/email-address.vo';
import { InviteId } from '@domain/value-objects/invite-id.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { TeamName } from '@domain/value-objects/team-name.vo';
import { TeamRole } from '@domain/value-objects/team-role.vo';
import { TokenHash } from '@domain/value-objects/token-hash.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
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
  name: TeamName.of('Platform'),
  members: [{ userId: asker, role: TeamRole.owner }],
});

const offered = (to = 'ada@example.com') =>
  Invite.offer({
    id: InviteId.of('invite_1'),
    team: platform,
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
    const again = offered().sentAgain(hash('b'), asker, LATER);

    expect(again.pullEvents()).toMatchObject([
      { kind: 'invite.offered' },
      { kind: 'invite.offered', again: true },
    ]);
  });

  it('is open, and a plain member, until anything happens to it', () => {
    const invite = offered();

    expect(invite.standingAt(NOW)).toBe('open');
    expect(invite.role).toBe(TeamRole.member);
  });

  it('runs out a fortnight after it was sent', () => {
    const invite = offered();

    expect(invite.standingAt(LATER)).toBe('open');
    expect(invite.standingAt(AFTER_IT_RUNS_OUT)).toBe('expired');
  });

  it('is taken up by the person it was sent to', () => {
    const accepted = offered().acceptedBySomeone(
      ada,
      EmailAddress.of('ada@example.com'),
      LATER,
    );

    expect(accepted.standingAt(LATER)).toBe('accepted');
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

    expect(accepted.standingAt(LATER)).toBe('accepted');
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
    expect(revoked.standingAt(LATER)).toBe('revoked');
  });

  it('cannot be taken back once it has been accepted', () => {
    const accepted = offered().acceptedBySomeone(
      ada,
      EmailAddress.of('ada@example.com'),
      LATER,
    );

    expect(() => accepted.revoked(LATER)).toThrow(/already been accepted/);
  });

  it('sent again carries a new link and stands open from then', () => {
    const again = offered()
      .revoked(LATER)
      .sentAgain(hash('b'), asker, AFTER_IT_RUNS_OUT);

    expect(again.tokenHash.value).toBe(hash('b').value);
    expect(again.standingAt(AFTER_IT_RUNS_OUT)).toBe('open');
    expect(again.expiresAt.getTime()).toBeGreaterThan(
      AFTER_IT_RUNS_OUT.getTime(),
    );
  });

  it('sent again is the same invite, to the same person', () => {
    const invite = offered();
    const again = invite.sentAgain(hash('b'), ada, LATER);

    expect(again.id).toBe(invite.id);
    expect(again.email).toBe(invite.email);
    expect(again.invitedBy).toBe(ada);
  });

  it('refuses to stand as accepted by nobody', () => {
    expect(() =>
      Invite.rehydrate({
        id: InviteId.of('invite_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        teamId: TeamId.of('team_1'),
        email: EmailAddress.of('ada@example.com'),
        role: TeamRole.member,
        tokenHash: hash('a'),
        invitedBy: asker,
        invitedAt: NOW,
        expiresAt: LATER,
        acceptedAt: LATER,
        acceptedBy: null,
        revokedAt: null,
      }),
    ).toThrow(/accepted by nobody/);
  });
});
