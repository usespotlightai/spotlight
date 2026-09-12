import type { AcceptInviteCommand } from '@application/commands/accept-invite.command';
import { AcceptInviteHandler } from '@application/commands/handlers/accept-invite.handler';
import type { ClockPort } from '@application/ports/clock.port';
import type { DomainEventDispatcher } from '@application/ports/domain-event-dispatcher.port';
import type { TokenMintPort } from '@application/ports/token-mint.port';
import { Invite } from '@domain/aggregates/invite.aggregate';
import { Team } from '@domain/aggregates/team.aggregate';
import { Workspace } from '@domain/aggregates/workspace.aggregate';
import type { InviteRepository } from '@domain/repositories/invite.repository';
import type { TeamRepository } from '@domain/repositories/team.repository';
import type { WorkspaceRepository } from '@domain/repositories/workspace.repository';
import { EmailAddress } from '@domain/value-objects/email-address.vo';
import { InviteId } from '@domain/value-objects/invite-id.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { TeamName } from '@domain/value-objects/team-name.vo';
import { TeamRole } from '@domain/value-objects/team-role.vo';
import { TokenHash } from '@domain/value-objects/token-hash.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { WorkspaceName } from '@domain/value-objects/workspace-name.vo';
import { WorkspaceRole } from '@domain/value-objects/workspace-role.vo';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-13T09:00:00.000Z');

const workspace = Workspace.rehydrate({
  id: WorkspaceId.of('ws_1'),
  name: WorkspaceName.of('Acme'),
  slug: WorkspaceSlug.of('acme'),
  members: [{ userId: UserId.of('user_leon'), role: WorkspaceRole.owner }],
  teams: [TeamId.of('team_1')],
});

const team = Team.rehydrate({
  id: TeamId.of('team_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  name: TeamName.of('Platform'),
  members: [{ userId: UserId.of('user_leon'), role: TeamRole.owner }],
});

const standing = (over: { sentAt?: Date; revoked?: boolean } = {}) => {
  const offered = Invite.offer({
    id: InviteId.of('invite_1'),
    team,
    email: EmailAddress.of('ada@example.com'),
    tokenHash: TokenHash.of('a'.repeat(64)),
    invitedBy: UserId.of('user_leon'),
    now: over.sentAt ?? new Date('2026-09-12T09:00:00.000Z'),
  });

  const invite = over.revoked ? offered.revoked(NOW) : offered;

  invite.pullEvents();

  return invite;
};

const accepting = (invite: Invite | null = standing()) => {
  const save = vi.fn(async (_: Invite) => {});
  const savedWorkspace = vi.fn(async (_: Workspace) => {});
  const savedTeam = vi.fn(async (_: Team) => {});

  const handler = new AcceptInviteHandler(
    { withToken: async () => invite, save } as unknown as InviteRepository,
    { find: async () => team, save: savedTeam } as unknown as TeamRepository,
    {
      find: async () => workspace,
      save: savedWorkspace,
    } as unknown as WorkspaceRepository,
    { hash: () => 'a'.repeat(64) } as unknown as TokenMintPort,
    { dispatch: async () => {} } as DomainEventDispatcher,
    { now: () => NOW } as ClockPort,
  );

  return { handler, save, savedWorkspace, savedTeam };
};

const accept = (email = 'ada@example.com') =>
  ({
    token: 'tok',
    viewerId: 'user_ada',
    viewerEmail: email,
  }) as AcceptInviteCommand;

describe('AcceptInviteHandler', () => {
  it('puts them on the team and says where they landed', async () => {
    const { handler, savedTeam } = accepting();

    await expect(handler.execute(accept())).resolves.toEqual({
      workspaceSlug: 'acme',
      teamId: 'team_1',
      teamName: 'Platform',
    });

    expect(savedTeam.mock.calls[0]?.[0].holds(UserId.of('user_ada'))).toBe(
      true,
    );
  });

  it('puts them in the workspace too', async () => {
    const { handler, savedWorkspace } = accepting();

    await handler.execute(accept());

    expect(
      savedWorkspace.mock.calls[0]?.[0].roleOf(UserId.of('user_ada')),
    ).toBe(WorkspaceRole.member);
  });

  it('marks the invite taken up, so the link is spent', async () => {
    const { handler, save } = accepting();

    await handler.execute(accept());

    expect(save.mock.calls[0]?.[0]).toMatchObject({
      acceptedAt: NOW,
      acceptedBy: { value: 'user_ada' },
    });
  });

  it('is nothing to a link that stands for no invite', async () => {
    const { handler, savedTeam } = accepting(null);

    await expect(handler.execute(accept())).resolves.toBeNull();
    expect(savedTeam).not.toHaveBeenCalled();
  });

  it('refuses somebody signed in as anybody but the person invited', async () => {
    const { handler, savedTeam } = accepting();

    await expect(handler.execute(accept('grace@example.com'))).rejects.toThrow(
      /sent to ada@example.com/,
    );
    expect(savedTeam).not.toHaveBeenCalled();
  });

  it('refuses an invite that has been taken back', async () => {
    const { handler, savedTeam } = accepting(standing({ revoked: true }));

    await expect(handler.execute(accept())).rejects.toThrow(/been revoked/);
    expect(savedTeam).not.toHaveBeenCalled();
  });

  it('refuses an invite that has run out', async () => {
    const { handler, savedTeam } = accepting(
      standing({ sentAt: new Date('2026-08-01T09:00:00.000Z') }),
    );

    await expect(handler.execute(accept())).rejects.toThrow(/run out/);
    expect(savedTeam).not.toHaveBeenCalled();
  });

  it('joins before it spends the link', async () => {
    const order: string[] = [];
    const handler = new AcceptInviteHandler(
      {
        withToken: async () => standing(),
        save: async () => {
          order.push('invite');
        },
      } as unknown as InviteRepository,
      {
        find: async () => team,
        save: async () => {
          order.push('team');
        },
      } as unknown as TeamRepository,
      {
        find: async () => workspace,
        save: async () => {
          order.push('workspace');
        },
      } as unknown as WorkspaceRepository,
      { hash: () => 'a'.repeat(64) } as unknown as TokenMintPort,
      { dispatch: async () => {} } as DomainEventDispatcher,
      { now: () => NOW } as ClockPort,
    );

    await handler.execute(accept());

    expect(order).toEqual(['workspace', 'team', 'invite']);
  });

  it('says what happened, once all three have been written', async () => {
    const dispatched: string[] = [];
    const handler = new AcceptInviteHandler(
      {
        withToken: async () => standing(),
        save: async () => {},
      } as unknown as InviteRepository,
      {
        find: async () => team,
        save: async () => {},
      } as unknown as TeamRepository,
      {
        find: async () => workspace,
        save: async () => {},
      } as unknown as WorkspaceRepository,
      { hash: () => 'a'.repeat(64) } as unknown as TokenMintPort,
      {
        dispatch: async (events) => {
          dispatched.push(...events.map((each) => each.kind));
        },
      } as DomainEventDispatcher,
      { now: () => NOW } as ClockPort,
    );

    await handler.execute(accept());

    expect(dispatched).toEqual([
      'workspace.member-joined',
      'team.member-joined',
      'invite.accepted',
    ]);
  });
});
