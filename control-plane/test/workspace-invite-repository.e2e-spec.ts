import { WorkspaceInvite } from '@identity/domain/aggregates/workspace-invite.aggregate';
import { AlreadyInvitedError } from '@identity/domain/exceptions/already-invited.error';
import { InviteMovedOnError } from '@identity/domain/exceptions/invite-moved-on.error';
import { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import { InviteId } from '@identity/domain/value-objects/invite-id.vo';
import { InviteTerms } from '@identity/domain/value-objects/invite-terms.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { DrizzleWorkspaceInviteRepository } from '@identity/infrastructure/persistence/drizzle/repositories/workspace-invite.repository';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';
import * as schema from './support/schema';

const SENT = new Date('2026-09-12T09:00:00.000Z');
const NOW = new Date('2026-09-13T09:00:00.000Z');
const ACME = WorkspaceId.of('ws_1');

describe('DrizzleWorkspaceInviteRepository (e2e)', () => {
  let held: TestDatabase;
  let invites: DrizzleWorkspaceInviteRepository;
  const recorded: DomainEvent[] = [];
  let sequence = 0;

  const offered = (
    email = 'ada@example.com',
    teams = ['team_1', 'team_2'],
    invitedBy = 'user_leon',
  ) => {
    sequence += 1;

    return WorkspaceInvite.offer({
      id: InviteId.of(`invite_${sequence}`),
      workspaceId: ACME,
      email: EmailAddress.of(email),
      terms: InviteTerms.of(
        WorkspaceRole.admin,
        teams.map((each) => TeamId.of(each)),
      ),
      tokenHash: TokenHash.of(`${sequence}`.padStart(64, '0')),
      invitedBy: UserId.of(invitedBy),
      now: SENT,
    });
  };

  const accepted = (invite: WorkspaceInvite, by = 'user_ada') =>
    invite.acceptedBySomeone(
      UserId.of(by),
      EmailAddress.of('ada@example.com'),
      NOW,
    );

  const readBack = async (invite: WorkspaceInvite) =>
    (await invites.find(invite.id)) as WorkspaceInvite;

  beforeAll(async () => {
    held = await openDatabase('workspace_invites');
    await held.db.insert(schema.user).values(
      ['user_leon', 'user_ada', 'user_left', 'user_gone'].map((id) => ({
        id,
        name: id,
        email: `${id}@example.com`,
      })),
    );
    await held.db
      .insert(schema.workspace)
      .values({ id: 'ws_1', name: 'Acme', slug: 'acme' });
    await held.db.insert(schema.team).values([
      { id: 'team_1', workspaceId: 'ws_1', key: 'platform', name: 'Platform' },
      { id: 'team_2', workspaceId: 'ws_1', key: 'mobile', name: 'Mobile' },
    ]);
    invites = new DrizzleWorkspaceInviteRepository(
      new DrizzleContext(held.db),
      {
        dispatch: async (events) => {
          recorded.push(...events);
        },
      },
    );
  });

  afterAll(async () => {
    await held.close();
  });

  beforeEach(async () => {
    await held.db.delete(schema.workspaceInvite);
    recorded.length = 0;
  });

  it('keeps an invite with its role and teams, at its first version', async () => {
    const invite = offered();
    await invites.add(invite);

    const read = await readBack(invite);

    expect(read.version).toBe(1);
    expect(read.terms.invitedAs).toBe('admin');
    expect(read.terms.teams.map((each) => each.value).sort()).toEqual([
      'team_1',
      'team_2',
    ]);
    expect(recorded.map((each) => each.kind)).toEqual([
      'workspace-invite.offered',
    ]);
    expect((await invites.withToken(invite.tokenHash))?.id.value).toBe(
      invite.id.value,
    );
  });

  it('finds the open invite to an address, however it was written', async () => {
    const invite = offered('Ada@Example.com');
    await invites.add(invite);

    expect(
      (await invites.openTo(ACME, EmailAddress.of('ADA@example.com')))?.id
        .value,
    ).toBe(invite.id.value);
  });

  it('finds no open invite to an address whose invites were all accepted or revoked', async () => {
    const taken = offered();
    await invites.add(taken);
    await invites.save(accepted(await readBack(taken)));
    const withdrawn = offered();
    await invites.add(withdrawn);
    await invites.save(
      (await readBack(withdrawn)).revoked(UserId.of('user_leon'), NOW),
    );

    expect(
      await invites.openTo(ACME, EmailAddress.of('ada@example.com')),
    ).toBeNull();
  });

  it('reads back an invite accepted by an account since deleted, and opens a new one beside it', async () => {
    const invite = offered();
    await invites.add(invite);
    await invites.save(accepted(await readBack(invite), 'user_gone'));
    await held.db.delete(schema.user).where(eq(schema.user.id, 'user_gone'));

    const read = await invites.withToken(invite.tokenHash);

    expect(read?.statusAt(NOW)).toBe('accepted');
    expect(read?.acceptedBy).toBeNull();
    expect(
      await invites.openTo(ACME, EmailAddress.of('ada@example.com')),
    ).toBeNull();
    await expect(invites.add(offered())).resolves.toBeUndefined();
  });

  it('keeps an invite whose inviter’s account was deleted, with nobody as its inviter', async () => {
    const invite = offered('ada@example.com', [], 'user_left');
    await invites.add(invite);
    await held.db.delete(schema.user).where(eq(schema.user.id, 'user_left'));

    const read = await readBack(invite);

    expect(read.invitedBy).toBeNull();
    expect(read.statusAt(NOW)).toBe('open');
  });

  it('leaves the team links alone on a save that keeps the terms', async () => {
    const invite = offered();
    await invites.add(invite);
    await held.db
      .delete(schema.workspaceInviteTeam)
      .where(eq(schema.workspaceInviteTeam.teamId, 'team_2'));

    await invites.save(
      (await readBack(invite)).revoked(UserId.of('user_leon'), NOW),
    );

    expect(
      (await readBack(invite)).terms.teams.map((each) => each.value),
    ).toEqual(['team_1']);
  });

  it('refuses a second open invite to the same address', async () => {
    await invites.add(offered());

    await expect(invites.add(offered())).rejects.toThrow(AlreadyInvitedError);
  });

  it('opens a new invite once the last one was revoked', async () => {
    const first = offered();
    await invites.add(first);
    await invites.save(
      (await readBack(first)).revoked(UserId.of('user_leon'), NOW),
    );

    await expect(invites.add(offered())).resolves.toBeUndefined();
  });

  it('forgets a team deleted since the invite was sent', async () => {
    await held.db
      .insert(schema.team)
      .values({ id: 'team_3', workspaceId: 'ws_1', key: 'gone', name: 'Gone' });
    const invite = offered('ada@example.com', ['team_1', 'team_3']);
    await invites.add(invite);

    await held.db.delete(schema.team).where(eq(schema.team.id, 'team_3'));

    expect(
      (await readBack(invite)).terms.teams.map((each) => each.value),
    ).toEqual(['team_1']);
  });

  it('refuses a revoke read before the invite was accepted, and records nothing for it', async () => {
    const invite = offered();
    await invites.add(invite);
    recorded.length = 0;
    const acceptor = await readBack(invite);
    const revoker = await readBack(invite);

    await invites.save(
      acceptor.acceptedBySomeone(
        UserId.of('user_ada'),
        EmailAddress.of('ada@example.com'),
        NOW,
      ),
    );

    await expect(
      invites.save(revoker.revoked(UserId.of('user_leon'), NOW)),
    ).rejects.toThrow(InviteMovedOnError);
    expect((await readBack(invite)).acceptedAt).toEqual(NOW);
    expect((await readBack(invite)).version).toBe(2);
    expect(recorded.map((each) => each.kind)).toEqual([
      'workspace-invite.accepted',
    ]);
  });

  it('keeps the new link and terms of an invite sent again', async () => {
    const invite = offered();
    await invites.add(invite);

    await invites.save(
      (await readBack(invite)).sentAgain({
        terms: InviteTerms.of(WorkspaceRole.member, [TeamId.of('team_2')]),
        tokenHash: TokenHash.of('f'.repeat(64)),
        by: UserId.of('user_ada'),
        now: NOW,
      }),
    );

    const read = await readBack(invite);
    expect(read.tokenHash.value).toBe('f'.repeat(64));
    expect(read.terms.invitedAs).toBe('member');
    expect(read.terms.teams.map((each) => each.value)).toEqual(['team_2']);
    expect(read.invitedBy?.value).toBe('user_ada');
  });
});
