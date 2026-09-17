import { RevealVaultKeyHandler } from '@configuration/application/commands/handlers/reveal-vault-key.handler';
import { RevealVaultKeyCommand } from '@configuration/application/commands/reveal-vault-key.command';
import type { TeamsPort } from '@configuration/application/ports/teams.port';
import type { TeamVault } from '@configuration/application/services/team-vault.service';
import { VaultKey } from '@configuration/domain/value-objects/vault-key.vo';
import { UseCaseFault } from '@shared-kernel/application/errors/use-case.fault';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const ROLES: Record<string, 'owner' | 'admin' | 'member'> = {
  owner_1: 'owner',
  admin_1: 'admin',
  member_1: 'member',
};

const revealing = () => {
  const teams: TeamsPort = {
    find: vi.fn(),
    inWorkspace: vi.fn(),
    viewedBy: async (teamId: string, viewer: UserId) => {
      const role = ROLES[viewer.value];

      return role
        ? {
            teamId: TeamId.of(teamId),
            workspaceId: WorkspaceId.of('ws_1'),
            connected: false,
            viewer,
            administers: role !== 'member',
          }
        : null;
    },
  };
  const vault = {
    revealKey: async (teamId: TeamId) =>
      VaultKey.of(`vault-key-for-${teamId.value}`),
  } as unknown as TeamVault;

  return new RevealVaultKeyHandler(teams, vault);
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
