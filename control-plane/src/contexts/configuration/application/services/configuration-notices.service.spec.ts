import type {
  TeamProfile,
  TeamsPort,
} from '@configuration/application/ports/teams.port';
import { ConfigurationNotices } from '@configuration/application/services/configuration-notices.service';
import type { ReadConfiguration } from '@configuration/application/services/read-configuration.service';
import { ConfigurationHome } from '@configuration/domain/aggregates/configuration-home.aggregate';
import type { ConfigurationHomeRepository } from '@configuration/domain/repositories/configuration-home.repository';
import { InvalidRepositoryError } from '@shared-kernel/domain/exceptions/invalid-repository.error';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

const team = (id: string): TeamProfile => ({
  teamId: TeamId.of(id),
  workspaceId: WORKSPACE,
  connected: true,
});

const noticing = (
  installed: readonly TeamProfile[],
  homes: Record<string, ConfigurationHome> = {},
) => {
  const teams = {
    find: vi.fn(),
    viewedBy: vi.fn(),
    inWorkspace: vi.fn(async () => installed),
  } satisfies TeamsPort;
  const reading = { read: vi.fn(async (_team: TeamProfile) => null) };

  return {
    notices: new ConfigurationNotices(
      teams,
      {
        find: async (teamId) => homes[teamId.value] ?? null,
        save: vi.fn(),
      } satisfies ConfigurationHomeRepository,
      reading as unknown as ReadConfiguration,
    ),
    teams,
    reading,
  };
};

const pinned = (id: string, repository: string) =>
  ConfigurationHome.unpinned(WORKSPACE, TeamId.of(id)).keptInto(
    Repository.of(repository),
  );

describe('ConfigurationNotices', () => {
  it('reads again for each team on that installation that reads the repository touched', async () => {
    const { notices, teams, reading } = noticing(
      [team('team_1'), team('team_2'), team('team_3')],
      {
        team_1: pinned('team_1', 'acme/api'),
        team_2: pinned('team_2', 'acme/other'),
      },
    );

    await notices.touched({ workspaceId: WORKSPACE, repository: 'acme/api' });

    expect(teams.inWorkspace).toHaveBeenCalledWith(WORKSPACE);
    expect(
      reading.read.mock.calls.map(
        ([each]) => (each as TeamProfile).teamId.value,
      ),
    ).toEqual(['team_1', 'team_3']);
  });

  it('reads nothing where no team is on that installation', async () => {
    const { notices, reading } = noticing([]);

    await notices.touched({ workspaceId: WORKSPACE, repository: 'acme/api' });

    expect(reading.read).not.toHaveBeenCalled();
  });

  it('refuses a repository named as nothing of the kind', async () => {
    const { notices, reading } = noticing([team('team_1')]);

    await expect(
      notices.touched({
        workspaceId: WORKSPACE,
        repository: 'not a repository',
      }),
    ).rejects.toThrow(InvalidRepositoryError);
    expect(reading.read).not.toHaveBeenCalled();
  });
});
