import type {
  TeamStanding,
  TeamsPort,
} from '@configuration/application/ports/teams.port';
import type {
  ConfigurationRepo,
  ConfigurationTarget,
} from '@configuration/application/services/configuration-target.service';
import {
  type ConfigurationChange,
  type ProposalTarget,
  ProposeConfigurationChange,
} from '@configuration/application/services/propose-configuration-change.service';
import type {
  WriteConfiguration,
  Writing,
} from '@configuration/application/services/write-configuration.service';
import { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const TEAM: TeamStanding = {
  teamId: TeamId.of('team_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  connected: true,
  viewer: UserId.of('user_1'),
  administers: true,
};

const INTO: ConfigurationRepo = {
  workspaceId: WorkspaceId.of('ws_1'),
  repository: Repository.of('acme/api'),
};

interface Over {
  team?: TeamStanding | null;
  into?: ConfigurationRepo | null;
}

const proposing = (over: Over = {}) => {
  const written: { into: ConfigurationRepo; writing: Writing }[] = [];

  const teams: TeamsPort = {
    find: async () => null,
    inWorkspace: async () => [],
    viewedBy: async () => (over.team === undefined ? TEAM : over.team),
  };

  const target = {
    of: async () => (over.into === undefined ? INTO : over.into),
  } as unknown as ConfigurationTarget;

  const writing = {
    writeInto: async (into: ConfigurationRepo, asked: Writing) => {
      written.push({ into, writing: asked });
      return { url: 'https://github.com/acme/api/pull/9' };
    },
  } as unknown as WriteConfiguration;

  return {
    service: new ProposeConfigurationChange(teams, target, writing),
    written,
  };
};

const configurationChange = (
  over: Partial<ConfigurationChange> = {},
): ConfigurationChange => ({
  teamId: 'team_1',
  viewerId: 'user_1',
  title: 'Listen to Sentry',
  body: 'Sentry, written down.',
  written: async () => ({
    files: [ConfigurationFile.of('.spotlight/integrations/sentry.yml', 'x')],
  }),
  ...over,
});

describe('ProposeConfigurationChange', () => {
  it('writes what the change writes, where the team keeps its configuration', async () => {
    const { service, written } = proposing();
    let targeted: ProposalTarget | undefined;

    await expect(
      service.propose(
        configurationChange({
          written: async (target) => {
            targeted = target;
            return {
              files: [
                ConfigurationFile.of('.spotlight/integrations/sentry.yml', 'x'),
              ],
            };
          },
        }),
      ),
    ).resolves.toEqual({ url: 'https://github.com/acme/api/pull/9' });

    expect(targeted).toEqual({ team: TEAM, into: INTO });
    expect(written).toEqual([
      {
        into: INTO,
        writing: {
          title: 'Listen to Sentry',
          body: 'Sentry, written down.',
          files: [
            ConfigurationFile.of('.spotlight/integrations/sentry.yml', 'x'),
          ],
        },
      },
    ]);
  });

  it('writes a change that only takes files away', async () => {
    const { service, written } = proposing();

    await service.propose(
      configurationChange({
        written: async () => ({
          files: [],
          removes: ['.spotlight/integrations/linear.yml'],
        }),
      }),
    );

    expect(written[0]?.writing.removes).toEqual([
      '.spotlight/integrations/linear.yml',
    ]);
  });

  it('says nothing, and writes nothing, where the change writes nothing', async () => {
    const { service, written } = proposing();

    await expect(
      service.propose(
        configurationChange({ written: async () => ({ files: [] }) }),
      ),
    ).resolves.toBeNull();
    expect(written).toEqual([]);
  });

  it('says nothing, and writes nothing, where the caller is not of the team', async () => {
    const { service, written } = proposing({ team: null });

    await expect(service.propose(configurationChange())).resolves.toBeNull();
    expect(written).toEqual([]);
  });

  it('says nothing, and writes nothing, where the team keeps no configuration repository', async () => {
    const { service, written } = proposing({ into: null });

    await expect(service.propose(configurationChange())).resolves.toBeNull();
    expect(written).toEqual([]);
  });
});
