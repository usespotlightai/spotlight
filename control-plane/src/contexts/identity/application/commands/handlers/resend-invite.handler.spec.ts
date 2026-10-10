import { ResendInviteHandler } from '@identity/application/commands/handlers/resend-invite.handler';
import { ResendInviteCommand } from '@identity/application/commands/resend-invite.command';
import type {
  InviteMailPort,
  InviteToSend,
} from '@identity/application/ports/invite-mail.port';
import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import { InviteSending } from '@identity/application/services/invite-sending.service';
import { WorkspaceAdministration } from '@identity/application/services/workspace-administration.service';
import { Team } from '@identity/domain/aggregates/team.aggregate';
import { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import { WorkspaceInvite } from '@identity/domain/aggregates/workspace-invite.aggregate';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import type { WorkspaceInviteRepository } from '@identity/domain/repositories/workspace-invite.repository';
import { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import { InviteId } from '@identity/domain/value-objects/invite-id.vo';
import { InviteTerms } from '@identity/domain/value-objects/invite-terms.vo';
import { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import { TeamName } from '@identity/domain/value-objects/team-name.vo';
import { WorkspaceName } from '@identity/domain/value-objects/workspace-name.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TokenMintPort } from '@shared-kernel/application/ports/token-mint.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-10-01T09:00:00.000Z');
const LEON = UserId.of('user_leon');
const ACME = WorkspaceId.of('ws_1');

const workspace = (role = WorkspaceRole.owner) =>
  Workspace.rehydrate({
    id: ACME,
    name: WorkspaceName.of('Acme'),
    slug: WorkspaceSlug.of('acme'),
    members: role.isOwner
      ? [{ userId: LEON, role }]
      : [
          { userId: UserId.of('user_owner'), role: WorkspaceRole.owner },
          { userId: LEON, role },
        ],
    version: 0,
  });

const PLATFORM = Team.rehydrate({
  id: TeamId.of('team_1'),
  workspaceId: ACME,
  key: TeamKey.of('platform'),
  name: TeamName.of('Platform'),
  members: [LEON],
  version: 0,
});

const standing = (
  over: { workspaceId?: WorkspaceId; revoked?: boolean } = {},
) => {
  const offered = WorkspaceInvite.offer({
    id: InviteId.of('invite_1'),
    workspaceId: over.workspaceId ?? ACME,
    email: EmailAddress.of('ada@example.com'),
    terms: InviteTerms.of(WorkspaceRole.admin, [
      TeamId.of('team_1'),
      TeamId.of('team_gone'),
    ]),
    tokenHash: TokenHash.of('a'.repeat(64)),
    invitedBy: UserId.of('user_grace'),
    now: new Date('2026-09-01T09:00:00.000Z'),
  });
  const invite = over.revoked
    ? offered.revoked(UserId.of('user_leon'), NOW)
    : offered;

  return WorkspaceInvite.rehydrate({ ...invite, version: 1 });
};

const resending = (
  over: { role?: WorkspaceRole; invite?: WorkspaceInvite | null } = {},
) => {
  const save = vi.fn(async (_: WorkspaceInvite) => {});
  const send = vi.fn(async (_: InviteToSend) => {});

  const handler = new ResendInviteHandler(
    new WorkspaceAdministration({
      findBySlug: async () => workspace(over.role),
    } as unknown as WorkspaceRepository),
    {
      find: async () => (over.invite === undefined ? standing() : over.invite),
      save,
    } as unknown as WorkspaceInviteRepository,
    { ofWorkspace: async () => [PLATFORM] } as unknown as TeamRepository,
    new InviteSending(
      {
        find: async (id: UserId) => ({
          id: id.value,
          name: 'Leon',
          image: null,
        }),
      } as unknown as PersonReaderPort,
      { send } as InviteMailPort,
      { warn: vi.fn() } as unknown as LoggerPort,
    ),
    {
      mint: () => ({ token: 'fresh', hash: 'f'.repeat(64) }),
    } as unknown as TokenMintPort,
    { now: () => NOW } as ClockPort,
  );

  return { handler, save, send };
};

const resend = new ResendInviteCommand('acme', 'invite_1', 'user_leon');

describe('ResendInviteHandler', () => {
  it('renews a run-out invite with a fresh link and two more weeks, and sends it', async () => {
    const { handler, save, send } = resending();

    await expect(handler.execute(resend)).resolves.toEqual({
      id: 'invite_1',
      email: 'ada@example.com',
      role: 'admin',
      teams: [{ id: 'team_1', name: 'Platform' }],
      invitedBy: { id: 'user_leon', name: 'Leon', image: null },
      invitedAt: NOW.toISOString(),
      expiresAt: '2026-10-15T09:00:00.000Z',
    });
    expect(save.mock.calls[0]?.[0].tokenHash.value).toBe('f'.repeat(64));
    expect(send).toHaveBeenCalledWith({
      to: 'ada@example.com',
      token: 'fresh',
      workspaceName: 'Acme',
      teamNames: ['Platform'],
      invitedBy: 'Leon',
    });
  });

  it('lets another admin send it again, on its terms still standing, as its inviter now', async () => {
    const { handler, save, send } = resending({ role: WorkspaceRole.admin });

    await expect(handler.execute(resend)).resolves.toMatchObject({
      role: 'admin',
      teams: [{ id: 'team_1', name: 'Platform' }],
      invitedBy: { id: 'user_leon' },
    });
    expect(save.mock.calls[0]?.[0].invitedBy).toEqual(LEON);
    expect(save.mock.calls[0]?.[0].terms.teams).toEqual([TeamId.of('team_1')]);
    expect(save.mock.calls[0]?.[0].pullEvents()).toMatchObject([
      { kind: 'workspace-invite.offered', again: true, invitedBy: LEON },
    ]);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('refuses an invite that was taken back, and sends nothing', async () => {
    const { handler, save, send } = resending({
      invite: standing({ revoked: true }),
    });

    await expect(handler.execute(resend)).rejects.toMatchObject({
      kind: 'conflict',
    });
    expect(save).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('is nothing to somebody who may not invite', async () => {
    const { handler, send } = resending({ role: WorkspaceRole.member });

    await expect(handler.execute(resend)).resolves.toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it('is nothing to an invite of another workspace, or none', async () => {
    await expect(
      resending({
        invite: standing({ workspaceId: WorkspaceId.of('ws_2') }),
      }).handler.execute(resend),
    ).resolves.toBeNull();
    await expect(
      resending({ invite: null }).handler.execute(resend),
    ).resolves.toBeNull();
  });
});
