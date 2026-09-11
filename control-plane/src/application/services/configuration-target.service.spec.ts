import { ConfigurationTarget } from '@application/services/configuration-target.service';
import { Team } from '@domain/aggregates/team.aggregate';
import type { Workspace } from '@domain/aggregates/workspace.aggregate';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import { Connection } from '@domain/value-objects/connection.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { TeamKey } from '@domain/value-objects/team-key.vo';
import { TeamName } from '@domain/value-objects/team-name.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const workspace = (connected = true) =>
  ({
    connectionTo: () => (connected ? Connection.of('github', '42') : null),
  }) as unknown as Workspace;

const team = (over: { kept?: string | null; moving?: string } = {}) =>
  Team.rehydrate({
    id: TeamId.of('team_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    key: TeamKey.of('platform'),
    name: TeamName.of('Platform'),
    members: [{ userId: UserId.of('user_1'), role: 'owner' }],
    configRepository:
      over.kept === null ? null : Repository.of(over.kept ?? 'acme/kept'),
    movingConfigurationTo: over.moving ? Repository.of(over.moving) : null,
  });

const targeting = (appliedRepo: string | null) => {
  const configurations = {
    findFor: vi.fn(async () =>
      appliedRepo ? { repository: Repository.of(appliedRepo) } : null,
    ),
  } as unknown as TeamConfigurationRepository;

  return new ConfigurationTarget(configurations);
};

describe('ConfigurationTarget', () => {
  describe('where a team’s changes are written', () => {
    // Reading takes where it keeps it outright, so writing does too: the two
    // cannot disagree about which repository it is.
    it('writes where the team keeps its configuration, over where it was last read', async () => {
      const into = await targeting('acme/applied').of(workspace(), team());

      expect(into?.repository.value).toBe('acme/kept');
    });

    it('writes where a move is going while it is under way', async () => {
      const into = await targeting('acme/kept').of(
        workspace(),
        team({ moving: 'acme/new' }),
      );

      expect(into?.repository.value).toBe('acme/new');
    });

    it('writes where the fallback rule last found it, where it keeps it nowhere', async () => {
      const into = await targeting('acme/applied').of(
        workspace(),
        team({ kept: null }),
      );

      expect(into?.repository.value).toBe('acme/applied');
    });

    it('is nothing where there is no repository to write to', async () => {
      expect(
        await targeting(null).of(workspace(), team({ kept: null })),
      ).toBeNull();
    });

    it('is nothing where the workspace reaches no GitHub', async () => {
      expect(
        await targeting('acme/applied').of(workspace(false), team()),
      ).toBeNull();
    });
  });

  describe('reaching a repository by name', () => {
    it('reaches it through the workspace’s installation', () => {
      const into = targeting(null).at(workspace(), Repository.of('acme/new'));

      expect(into?.installation.value).toBe('42');
      expect(into?.repository.value).toBe('acme/new');
    });

    it('is nothing where the workspace reaches no GitHub', () => {
      expect(
        targeting(null).at(workspace(false), Repository.of('acme/new')),
      ).toBeNull();
    });
  });
});
