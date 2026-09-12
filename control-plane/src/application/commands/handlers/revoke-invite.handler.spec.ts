import { RevokeInviteHandler } from '@application/commands/handlers/revoke-invite.handler';
import type { RevokeInviteCommand } from '@application/commands/revoke-invite.command';
import type { ClockPort } from '@application/ports/clock.port';
import type { DomainEventDispatcher } from '@application/ports/domain-event-dispatcher.port';
import type { ConnectionAuthorization } from '@application/services/connection-authorization.service';
import { Invite } from '@domain/aggregates/invite.aggregate';
import { Team } from '@domain/aggregates/team.aggregate';
import type { InviteRepository } from '@domain/repositories/invite.repository';
import { EmailAddress } from '@domain/value-objects/email-address.vo';
import { InviteId } from '@domain/value-objects/invite-id.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { TeamName } from '@domain/value-objects/team-name.vo';
import { TeamRole } from '@domain/value-objects/team-role.vo';
import { TokenHash } from '@domain/value-objects/token-hash.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-13T09:00:00.000Z');

const onto = (teamId: string) =>
  Team.rehydrate({
    id: TeamId.of(teamId),
    workspaceId: WorkspaceId.of('ws_1'),
    name: TeamName.of('Platform'),
    members: [{ userId: UserId.of('user_leon'), role: TeamRole.owner }],
  });

const offered = (teamId = 'team_1') =>
  Invite.offer({
    id: InviteId.of('invite_1'),
    team: onto(teamId),
    email: EmailAddress.of('ada@example.com'),
    tokenHash: TokenHash.of('a'.repeat(64)),
    invitedBy: UserId.of('user_leon'),
    now: new Date('2026-09-12T09:00:00.000Z'),
  });

const revoking = (over: { allowed?: boolean; invite?: Invite | null } = {}) => {
  const save = vi.fn(async (_: Invite) => {});

  const handler = new RevokeInviteHandler(
    {
      connectableBy: async () => (over.allowed === false ? null : {}),
    } as unknown as ConnectionAuthorization,
    {
      find: async () => (over.invite === undefined ? offered() : over.invite),
      save,
    } as unknown as InviteRepository,
    { now: () => NOW } as ClockPort,
    { dispatch: async () => {} } as DomainEventDispatcher,
  );

  return { handler, save };
};

const revoke = {
  teamId: 'team_1',
  inviteId: 'invite_1',
  viewerId: 'user_leon',
} as RevokeInviteCommand;

describe('RevokeInviteHandler', () => {
  it('takes the invite back, so the link stops working', async () => {
    const { handler, save } = revoking();

    await expect(handler.execute(revoke)).resolves.toBe(true);
    expect(save.mock.calls[0]?.[0]).toMatchObject({ revokedAt: NOW });
  });

  it('is nothing to somebody who may not invite to this team', async () => {
    const { handler, save } = revoking({ allowed: false });

    await expect(handler.execute(revoke)).resolves.toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it('is nothing to an invite that is not there', async () => {
    const { handler, save } = revoking({ invite: null });

    await expect(handler.execute(revoke)).resolves.toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it('refuses an invite belonging to another team', async () => {
    const { handler, save } = revoking({ invite: offered('team_2') });

    await expect(handler.execute(revoke)).resolves.toBe(false);
    expect(save).not.toHaveBeenCalled();
  });
});
