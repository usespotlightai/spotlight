import { RevokeInviteHandler } from '@identity/application/commands/handlers/revoke-invite.handler';
import type { RevokeInviteCommand } from '@identity/application/commands/revoke-invite.command';
import type { TeamAdministration } from '@identity/application/services/team-administration.service';
import { Invite } from '@identity/domain/aggregates/invite.aggregate';
import { Team } from '@identity/domain/aggregates/team.aggregate';
import { InviteMovedOnError } from '@identity/domain/exceptions/invite-moved-on.error';
import type { InviteRepository } from '@identity/domain/repositories/invite.repository';
import { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import { InviteId } from '@identity/domain/value-objects/invite-id.vo';
import { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import { TeamName } from '@identity/domain/value-objects/team-name.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-13T09:00:00.000Z');

const onto = (teamId: string) =>
  Team.rehydrate({
    id: TeamId.of(teamId),
    workspaceId: WorkspaceId.of('ws_1'),
    key: TeamKey.of('platform'),
    name: TeamName.of('Platform'),
    members: [UserId.of('user_leon')],
    version: 0,
  });

const offered = (teamId = 'team_1') =>
  Invite.offer({
    id: InviteId.of('invite_1'),
    workspaceId: onto(teamId).workspaceId,
    teamId: onto(teamId).id,
    email: EmailAddress.of('ada@example.com'),
    tokenHash: TokenHash.of('a'.repeat(64)),
    invitedBy: UserId.of('user_leon'),
    now: new Date('2026-09-12T09:00:00.000Z'),
  });

const revoking = (over: { allowed?: boolean; invite?: Invite | null } = {}) => {
  const save = vi.fn(async (_: Invite) => {});

  const handler = new RevokeInviteHandler(
    {
      administeredBy: async () => (over.allowed === false ? null : {}),
    } as unknown as TeamAdministration,
    {
      find: async () => (over.invite === undefined ? offered() : over.invite),
      save,
    } as unknown as InviteRepository,
    { now: () => NOW } as ClockPort,
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

  it('refuses with a conflict where the invite was accepted while it was being revoked', async () => {
    const { handler, save } = revoking();
    save.mockImplementationOnce(async () => {
      throw new InviteMovedOnError('invite_1');
    });

    await expect(handler.execute(revoke)).rejects.toMatchObject({
      kind: 'conflict',
    });
  });
});
