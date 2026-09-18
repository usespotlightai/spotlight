import type { AcceptInviteCommand } from '@identity/application/commands/accept-invite.command';
import { AcceptInviteHandler } from '@identity/application/commands/handlers/accept-invite.handler';
import { Invite } from '@identity/domain/aggregates/invite.aggregate';
import { Team } from '@identity/domain/aggregates/team.aggregate';
import { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import { InviteMovedOnError } from '@identity/domain/exceptions/invite-moved-on.error';
import type { InviteRepository } from '@identity/domain/repositories/invite.repository';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import { InviteId } from '@identity/domain/value-objects/invite-id.vo';
import { TeamName } from '@identity/domain/value-objects/team-name.vo';
import { WorkspaceName } from '@identity/domain/value-objects/workspace-name.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TokenMintPort } from '@shared-kernel/application/ports/token-mint.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-13T09:00:00.000Z');

const workspace = Workspace.rehydrate({
  id: WorkspaceId.of('ws_1'),
  name: WorkspaceName.of('Acme'),
  slug: WorkspaceSlug.of('acme'),
  members: [{ userId: UserId.of('user_leon'), role: WorkspaceRole.owner }],
});

const team = Team.rehydrate({
  id: TeamId.of('team_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  name: TeamName.of('Platform'),
  members: [UserId.of('user_leon')],
});

const standing = (over: { sentAt?: Date; revoked?: boolean } = {}) => {
  const offered = Invite.offer({
    id: InviteId.of('invite_1'),
    workspaceId: team.workspaceId,
    teamId: team.id,
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
  const dispatched: DomainEvent[] = [];
  const save = vi.fn(async (saved: Invite) => {
    dispatched.push(...saved.pullEvents());
  });

  const handler = new AcceptInviteHandler(
    { withToken: async () => invite, save } as unknown as InviteRepository,
    { find: async () => team } as unknown as TeamRepository,
    { find: async () => workspace } as unknown as WorkspaceRepository,
    { hash: () => 'a'.repeat(64) } as unknown as TokenMintPort,
    { now: () => NOW } as ClockPort,
  );

  return { handler, save, dispatched };
};

const accept = (email = 'ada@example.com') =>
  ({
    token: 'tok',
    viewerId: 'user_ada',
    viewerEmail: email,
  }) as AcceptInviteCommand;

describe('AcceptInviteHandler', () => {
  it('says where they land', async () => {
    const { handler } = accepting();

    await expect(handler.execute(accept())).resolves.toEqual({
      workspaceSlug: 'acme',
      teamId: 'team_1',
      teamName: 'Platform',
    });
  });

  it('marks the invite taken up, so the link is spent', async () => {
    const { handler, save } = accepting();

    await handler.execute(accept());

    expect(save.mock.calls[0]?.[0]).toMatchObject({
      acceptedAt: NOW,
      acceptedBy: { value: 'user_ada' },
    });
  });

  it('says the invite was accepted, for the workspace and the team to take them in', async () => {
    const { handler, dispatched } = accepting();

    await handler.execute(accept());

    expect(dispatched.map((each) => each.kind)).toEqual(['invite.accepted']);
  });

  it('is nothing to a link that stands for no invite', async () => {
    const { handler, save } = accepting(null);

    await expect(handler.execute(accept())).resolves.toBeNull();
    expect(save).not.toHaveBeenCalled();
  });

  it('refuses somebody signed in as anybody but the person invited', async () => {
    const { handler, save } = accepting();

    await expect(handler.execute(accept('grace@example.com'))).rejects.toThrow(
      /sent to ada@example.com/,
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('refuses an invite that has been taken back', async () => {
    const { handler, save } = accepting(standing({ revoked: true }));

    await expect(handler.execute(accept())).rejects.toThrow(/been revoked/);
    expect(save).not.toHaveBeenCalled();
  });

  it('refuses an invite that has run out', async () => {
    const { handler, save } = accepting(
      standing({ sentAt: new Date('2026-08-01T09:00:00.000Z') }),
    );

    await expect(handler.execute(accept())).rejects.toThrow(/run out/);
    expect(save).not.toHaveBeenCalled();
  });

  it('refuses with a conflict where the invite was revoked while it was being accepted', async () => {
    const { handler, save, dispatched } = accepting();
    save.mockImplementationOnce(async () => {
      throw new InviteMovedOnError('invite_1');
    });

    await expect(handler.execute(accept())).rejects.toMatchObject({
      kind: 'conflict',
    });
    expect(dispatched).toEqual([]);
  });
});
