import { InviteToTeamHandler } from '@application/commands/handlers/invite-to-team.handler';
import type { InviteToTeamCommand } from '@application/commands/invite-to-team.command';
import type { ClockPort } from '@application/ports/clock.port';
import type { DomainEventDispatcher } from '@application/ports/domain-event-dispatcher.port';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type {
  InviteMailPort,
  InviteToSend,
} from '@application/ports/invite-mail.port';
import type { MemberReaderPort } from '@application/ports/member-reader.port';
import type { PersonReaderPort } from '@application/ports/person-reader.port';
import type { TokenMintPort } from '@application/ports/token-mint.port';
import type { ConnectionAuthorization } from '@application/services/connection-authorization.service';
import { Invite } from '@domain/aggregates/invite.aggregate';
import { Team } from '@domain/aggregates/team.aggregate';
import { Workspace } from '@domain/aggregates/workspace.aggregate';
import type { InviteRepository } from '@domain/repositories/invite.repository';
import type { TeamRepository } from '@domain/repositories/team.repository';
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

const NOW = new Date('2026-09-12T09:00:00.000Z');

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

const inviting = (
  over: { allowed?: boolean; onTeam?: boolean; standing?: Invite | null } = {},
) => {
  const add = vi.fn(async (_: Invite) => {});
  const save = vi.fn(async (_: Invite) => {});
  const send = vi.fn(async (_: InviteToSend) => {});

  const handler = new InviteToTeamHandler(
    {
      connectableBy: async () => (over.allowed === false ? null : workspace),
    } as unknown as ConnectionAuthorization,
    { find: async () => team } as unknown as TeamRepository,
    {
      add,
      save,
      to: async () => over.standing ?? null,
    } as unknown as InviteRepository,
    { onTeam: async () => over.onTeam ?? false } as unknown as MemberReaderPort,
    {
      find: async () => ({ id: 'user_leon', name: 'Leon Liang', image: null }),
    } as PersonReaderPort,
    {
      mint: () => ({ token: 'tok', hash: 'a'.repeat(64) }),
      hash: () => 'a'.repeat(64),
    } as TokenMintPort,
    { send } as InviteMailPort,
    { generate: () => 'invite_1' } as IdGeneratorPort,
    { now: () => NOW } as ClockPort,
    { dispatch: async () => {} } as DomainEventDispatcher,
  );

  return { handler, add, save, send };
};

const invite = (email = 'Ada@Example.com') =>
  ({ teamId: 'team_1', email, viewerId: 'user_leon' }) as InviteToTeamCommand;

describe('InviteToTeamHandler', () => {
  it('writes the invite down and sends the link', async () => {
    const { handler, add, send } = inviting();

    await expect(handler.execute(invite())).resolves.toMatchObject({
      id: 'invite_1',
      email: 'ada@example.com',
      invitedBy: 'Leon Liang',
    });

    expect(add).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({
      to: 'ada@example.com',
      token: 'tok',
      teamName: 'Platform',
      workspaceName: 'Acme',
      invitedBy: 'Leon Liang',
    });
  });

  it('keeps only the hash of the token it sent', async () => {
    const { handler, add } = inviting();

    await handler.execute(invite());

    expect(add.mock.calls[0]?.[0]).toMatchObject({
      tokenHash: { value: 'a'.repeat(64) },
    });
  });

  it('is nothing to somebody who may not invite to this team', async () => {
    const { handler, add, send } = inviting({ allowed: false });

    await expect(handler.execute(invite())).resolves.toBeNull();
    expect(add).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('refuses somebody already on the team', async () => {
    const { handler, send } = inviting({ onTeam: true });

    await expect(handler.execute(invite())).rejects.toThrow(
      /already on this team/,
    );
    expect(send).not.toHaveBeenCalled();
  });

  it('refuses something that is not an address', async () => {
    const { handler, send } = inviting();

    await expect(handler.execute(invite('ada'))).rejects.toThrow(
      /not an email address/,
    );
    expect(send).not.toHaveBeenCalled();
  });

  it('sends the standing invite again rather than opening a second', async () => {
    const standing = Invite.offer({
      id: InviteId.of('invite_1'),
      team,
      email: EmailAddress.of('ada@example.com'),
      tokenHash: TokenHash.of('b'.repeat(64)),
      invitedBy: UserId.of('user_leon'),
      now: new Date('2026-09-01T09:00:00.000Z'),
    });
    const { handler, add, save, send } = inviting({ standing });

    await handler.execute(invite());

    expect(add).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]?.[0]).toMatchObject({
      id: { value: 'invite_1' },
      tokenHash: { value: 'a'.repeat(64) },
      invitedAt: NOW,
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'ada@example.com', token: 'tok' }),
    );
  });
});
