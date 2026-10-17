import { RevokeInviteHandler } from '@identity/application/commands/handlers/revoke-invite.handler';
import { RevokeInviteCommand } from '@identity/application/commands/revoke-invite.command';
import { WorkspaceAdministration } from '@identity/application/services/workspace-administration.service';
import { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import { WorkspaceInvite } from '@identity/domain/aggregates/workspace-invite.aggregate';
import { InviteVersionConflictError } from '@identity/domain/exceptions/invite-version-conflict.error';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import type { WorkspaceInviteRepository } from '@identity/domain/repositories/workspace-invite.repository';
import { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import { InviteId } from '@identity/domain/value-objects/invite-id.vo';
import { InviteTerms } from '@identity/domain/value-objects/invite-terms.vo';
import { WorkspaceName } from '@identity/domain/value-objects/workspace-name.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-13T09:00:00.000Z');
const LEON = UserId.of('user_leon');

const workspace = (role: WorkspaceRole) =>
  Workspace.rehydrate({
    id: WorkspaceId.of('ws_1'),
    name: WorkspaceName.of('Acme'),
    slug: WorkspaceSlug.of('acme'),
    members: [
      { userId: UserId.of('user_owner'), role: WorkspaceRole.owner },
      { userId: LEON, role },
    ],
    version: 0,
  });

const offered = (workspaceId = 'ws_1') =>
  WorkspaceInvite.offer({
    id: InviteId.of('invite_1'),
    workspaceId: WorkspaceId.of(workspaceId),
    email: EmailAddress.of('ada@example.com'),
    terms: InviteTerms.of(WorkspaceRole.member, []),
    tokenHash: TokenHash.of('a'.repeat(64)),
    invitedBy: LEON,
    now: new Date('2026-09-12T09:00:00.000Z'),
  });

const revoking = (
  over: { role?: WorkspaceRole; invite?: WorkspaceInvite | null } = {},
) => {
  const save = vi.fn(async (_: WorkspaceInvite) => {});

  const handler = new RevokeInviteHandler(
    new WorkspaceAdministration({
      findBySlug: async () => workspace(over.role ?? WorkspaceRole.admin),
    } as unknown as WorkspaceRepository),
    {
      find: async () => (over.invite === undefined ? offered() : over.invite),
      save,
    } as unknown as WorkspaceInviteRepository,
    { now: () => NOW } as ClockPort,
  );

  return { handler, save };
};

const revoke = new RevokeInviteCommand('acme', 'invite_1', 'user_leon');

describe('RevokeInviteHandler', () => {
  it('takes the invite back, so the link stops working', async () => {
    const { handler, save } = revoking();

    await expect(handler.execute(revoke)).resolves.toBe(true);
    expect(save.mock.calls[0]?.[0]).toMatchObject({ revokedAt: NOW });
    expect(save.mock.calls[0]?.[0].pullEvents()).toMatchObject([
      { kind: 'workspace-invite.offered' },
      { kind: 'workspace-invite.revoked', by: LEON },
    ]);
  });

  it('writes and records nothing for an invite already taken back', async () => {
    const taken = WorkspaceInvite.rehydrate({
      ...offered().revoke(UserId.of('user_owner'), NOW),
      version: 2,
    });
    const { handler, save } = revoking({ invite: taken });

    await expect(handler.execute(revoke)).resolves.toBe(true);
    expect(save).not.toHaveBeenCalled();
  });

  it('is nothing to somebody who may not invite to this workspace', async () => {
    const { handler, save } = revoking({ role: WorkspaceRole.member });

    await expect(handler.execute(revoke)).resolves.toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it('is nothing to an invite that is not there', async () => {
    const { handler, save } = revoking({ invite: null });

    await expect(handler.execute(revoke)).resolves.toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it('is nothing to an invite of another workspace', async () => {
    const { handler, save } = revoking({ invite: offered('ws_2') });

    await expect(handler.execute(revoke)).resolves.toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it('refuses with a conflict where the invite was accepted while it was being revoked', async () => {
    const { handler, save } = revoking();
    save.mockImplementationOnce(async () => {
      throw new InviteVersionConflictError('invite_1');
    });

    await expect(handler.execute(revoke)).rejects.toMatchObject({
      kind: 'conflict',
    });
  });
});
