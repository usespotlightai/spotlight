import type {
  TeamProfile,
  TeamsPort,
} from '@configuration/application/ports/teams.port';
import { ConfigurationProposals } from '@configuration/application/services/configuration-proposals.service';
import { ConfigurationTarget } from '@configuration/application/services/configuration-target.service';
import { HeldConfiguration } from '@configuration/application/services/held-configuration.service';
import type { PendingConfiguration } from '@configuration/application/services/pending-configuration.service';
import type { WriteConfiguration } from '@configuration/application/services/write-configuration.service';
import { ConfigurationHome } from '@configuration/domain/aggregates/configuration-home.aggregate';
import type { TeamConfigurationRepository } from '@configuration/domain/repositories/team-configuration.repository';
import type { RepositoryContentsPort } from '@github/application/ports/repository-contents.port';
import { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { Proposal } from '@work/application/ports/configuration-proposals.port';
import { describe, expect, it, vi } from 'vitest';

const TEAM = TeamId.of('team_1');
const INTO = Repository.of('acme/api');

const SEEDING: Proposal = {
  title: 'Set up Spotlight',
  body: 'Lines.',
  files: [
    ConfigurationFile.of('.spotlight/lines/delivery/line.yml', 'version: 1'),
  ],
};

const seeding = (
  over: {
    already?: readonly { path: string; text: string }[];
    head?: string | null;
    installed?: boolean;
    pinned?: boolean;
  } = {},
) => {
  const team: TeamProfile = {
    teamId: TEAM,
    workspaceId: WorkspaceId.of('ws_1'),
    connected: over.installed !== false,
  };
  const contents = {
    headOf: vi.fn(async () =>
      over.head === undefined ? 'a1b2c3d' : over.head,
    ),
    under: vi.fn(async () => over.already ?? []),
    read: vi.fn(async () => null),
  } as unknown as RepositoryContentsPort;
  const homes = {
    find: async () =>
      over.pinned === false
        ? null
        : ConfigurationHome.unpinned(team.workspaceId, TEAM).keptInto(INTO),
    save: vi.fn(),
  };
  const writeInto = vi.fn(async () => ({
    url: 'https://github.com/acme/api/pull/1',
  }));

  return {
    writeInto,
    service: new ConfigurationProposals(
      {
        find: async () => team,
        viewedBy: vi.fn(),
        inWorkspace: vi.fn(),
      } satisfies TeamsPort,
      homes,
      new ConfigurationTarget({} as TeamConfigurationRepository, homes),
      new HeldConfiguration(contents),
      {} as PendingConfiguration,
      { writeInto } as unknown as WriteConfiguration,
    ),
  };
};

describe('ConfigurationProposals', () => {
  describe('seeding a team’s first configuration', () => {
    it('opens a pull request into the repository the team keeps it in', async () => {
      const { service, writeInto } = seeding();

      expect(await service.seed(TEAM, SEEDING)).toEqual({
        url: 'https://github.com/acme/api/pull/1',
      });

      const [into, writing] = writeInto.mock.calls[0] as never as [
        { repository: Repository },
        Proposal,
      ];
      expect(into.repository).toEqual(INTO);
      expect(writing).toEqual(SEEDING);
    });

    it('writes nothing where the repository already has configuration', async () => {
      const { service, writeInto } = seeding({
        already: [
          { path: '.spotlight/lines/delivery/line.yml', text: 'version: 1' },
        ],
      });

      expect(await service.seed(TEAM, SEEDING)).toBeNull();
      expect(writeInto).not.toHaveBeenCalled();
    });

    it('writes nothing until a repository is chosen', async () => {
      const { service, writeInto } = seeding({ pinned: false });

      expect(await service.seed(TEAM, SEEDING)).toBeNull();
      expect(writeInto).not.toHaveBeenCalled();
    });

    it('writes nothing where the workspace reaches no host', async () => {
      const { service, writeInto } = seeding({ installed: false });

      expect(await service.seed(TEAM, SEEDING)).toBeNull();
      expect(writeInto).not.toHaveBeenCalled();
    });

    it('writes nothing where the repository stands nowhere', async () => {
      const { service, writeInto } = seeding({ head: null });

      expect(await service.seed(TEAM, SEEDING)).toBeNull();
      expect(writeInto).not.toHaveBeenCalled();
    });

    it('writes nothing where it is given no files', async () => {
      const { service, writeInto } = seeding();

      expect(await service.seed(TEAM, { ...SEEDING, files: [] })).toBeNull();
      expect(writeInto).not.toHaveBeenCalled();
    });
  });
});
