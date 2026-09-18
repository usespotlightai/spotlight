import type { TeamProfile } from '@configuration/application/ports/teams.port';
import { ConfigurationTarget } from '@configuration/application/services/configuration-target.service';
import { ConfigurationHome } from '@configuration/domain/aggregates/configuration-home.aggregate';
import type { ConfigurationHomeRepository } from '@configuration/domain/repositories/configuration-home.repository';
import type { TeamConfigurationRepository } from '@configuration/domain/repositories/team-configuration.repository';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const TEAM = TeamId.of('team_1');

const team = (installed = true): TeamProfile => ({
  teamId: TEAM,
  workspaceId: WORKSPACE,
  connected: installed,
});

const home = (over: { kept?: string | null; moving?: string } = {}) =>
  ConfigurationHome.rehydrate({
    workspaceId: WORKSPACE,
    teamId: TEAM,
    keptIn: over.kept === null ? null : Repository.of(over.kept ?? 'acme/kept'),
    movingTo: over.moving ? Repository.of(over.moving) : null,
    version: 1,
  });

const targeting = (
  appliedRepo: string | null,
  held: ConfigurationHome | null = home(),
) => {
  const configurations = {
    findFor: vi.fn(async () =>
      appliedRepo ? { repository: Repository.of(appliedRepo) } : null,
    ),
  } as unknown as TeamConfigurationRepository;
  const homes: ConfigurationHomeRepository = {
    find: async () => held,
    save: vi.fn(),
  };

  return new ConfigurationTarget(configurations, homes);
};

describe('ConfigurationTarget', () => {
  describe('where a team’s changes are written', () => {
    it('writes where the team keeps its configuration, over where it was last read', async () => {
      const into = await targeting('acme/applied').of(team());

      expect(into?.repository.value).toBe('acme/kept');
    });

    it('writes where a move is going while it is under way', async () => {
      const into = await targeting(
        'acme/kept',
        home({ moving: 'acme/new' }),
      ).of(team());

      expect(into?.repository.value).toBe('acme/new');
    });

    it('writes where the fallback rule last found it, where it keeps it nowhere', async () => {
      const into = await targeting('acme/applied', home({ kept: null })).of(
        team(),
      );

      expect(into?.repository.value).toBe('acme/applied');
    });

    it('writes where it was last found for a team nobody has pinned yet', async () => {
      const into = await targeting('acme/applied', null).of(team());

      expect(into?.repository.value).toBe('acme/applied');
    });

    it('is nothing where there is no repository to write to', async () => {
      expect(await targeting(null, home({ kept: null })).of(team())).toBeNull();
    });

    it('is nothing where the workspace reaches no GitHub', async () => {
      expect(await targeting('acme/applied').of(team(false))).toBeNull();
    });
  });

  describe('reaching a repository by name', () => {
    it('reaches it through the team’s installation', () => {
      const into = targeting(null).at(team(), Repository.of('acme/new'));

      expect(into?.workspaceId).toEqual(WORKSPACE);
      expect(into?.repository.value).toBe('acme/new');
    });

    it('is nothing where the workspace reaches no GitHub', () => {
      expect(
        targeting(null).at(team(false), Repository.of('acme/new')),
      ).toBeNull();
    });
  });
});
