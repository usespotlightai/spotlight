import { RevealVaultKeyHandler } from '@application/commands/handlers/reveal-vault-key.handler';
import { RevealVaultKeyCommand } from '@application/commands/reveal-vault-key.command';
import { UseCaseFault } from '@application/errors/use-case.fault';
import type { ConnectionAuthorization } from '@application/services/connection-authorization.service';
import type { TeamVault } from '@application/services/team-vault.service';
import { Workspace } from '@domain/aggregates/workspace.aggregate';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { VaultKey } from '@domain/value-objects/vault-key.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { WorkspaceName } from '@domain/value-objects/workspace-name.vo';
import { WorkspaceRole } from '@domain/value-objects/workspace-role.vo';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';
import { describe, expect, it } from 'vitest';

const WORKSPACE = Workspace.rehydrate({
  id: WorkspaceId.of('ws_1'),
  name: WorkspaceName.of('Acme'),
  slug: WorkspaceSlug.of('acme'),
  members: [
    { userId: UserId.of('owner_1'), role: WorkspaceRole.owner },
    { userId: UserId.of('admin_1'), role: WorkspaceRole.admin },
    { userId: UserId.of('member_1'), role: WorkspaceRole.member },
  ],
  teams: [TeamId.of('team_1')],
});

const revealing = () => {
  const authorization = {
    memberOf: async (_teamId: string, viewerId: string) =>
      WORKSPACE.holds(UserId.of(viewerId))
        ? { workspace: WORKSPACE, by: UserId.of(viewerId) }
        : null,
  } as unknown as ConnectionAuthorization;
  const vault = {
    revealKey: async (teamId: TeamId) =>
      VaultKey.of(`vault-key-for-${teamId.value}`),
  } as unknown as TeamVault;

  return new RevealVaultKeyHandler(authorization, vault);
};

const reveal = (viewerId: string) =>
  revealing().execute(new RevealVaultKeyCommand('team_1', viewerId));

describe('RevealVaultKeyHandler', () => {
  it('reveals the team’s vault key to an owner or an admin', async () => {
    await expect(reveal('owner_1')).resolves.toEqual({
      key: 'vault-key-for-team_1',
    });
    await expect(reveal('admin_1')).resolves.toEqual({
      key: 'vault-key-for-team_1',
    });
  });

  it('says nothing to someone who is not of the team', async () => {
    await expect(reveal('stranger_1')).resolves.toBeNull();
  });

  it('refuses a member who is neither owner nor admin', async () => {
    const refused = reveal('member_1');

    await expect(refused).rejects.toBeInstanceOf(UseCaseFault);
    await expect(refused).rejects.toMatchObject({ kind: 'not-allowed' });
  });
});
