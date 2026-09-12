import type { ClockPort } from '@application/ports/clock.port';
import type { DomainEventDispatcher } from '@application/ports/domain-event-dispatcher.port';
import type { IntegrationReaderPort } from '@application/ports/integration-reader.port';
import type { RepositoryCatalogPort } from '@application/ports/repository-catalog.port';
import type { RepositoryContentsPort } from '@application/ports/repository-contents.port';
import type { ApplyLines } from '@application/services/apply-lines.service';
import { ConfigurationTarget } from '@application/services/configuration-target.service';
import { HeldConfiguration } from '@application/services/held-configuration.service';
import { ReadConfiguration } from '@application/services/read-configuration.service';
import { Team } from '@domain/aggregates/team.aggregate';
import type { TeamConfiguration } from '@domain/aggregates/team-configuration.aggregate';
import { Workspace } from '@domain/aggregates/workspace.aggregate';
import { ConfigurationMoved } from '@domain/events/configuration-moved.event';
import type { TeamRepository } from '@domain/repositories/team.repository';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import { ConfigurationProblem } from '@domain/value-objects/configuration-problem.vo';
import { Connection } from '@domain/value-objects/connection.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { TeamKey } from '@domain/value-objects/team-key.vo';
import { TeamName } from '@domain/value-objects/team-name.vo';
import { TeamRole } from '@domain/value-objects/team-role.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { WorkspaceName } from '@domain/value-objects/workspace-name.vo';
import { WorkspaceRole } from '@domain/value-objects/workspace-role.vo';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-03T08:00:00.000Z');
const clock: ClockPort = { now: () => NOW, sleep: async () => {} };

const OWNER = UserId.of('user_1');

const TEAM = Team.rehydrate({
  id: TeamId.of('team_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  key: TeamKey.of('platform'),
  name: TeamName.of('Platform'),
  members: [{ userId: OWNER, role: TeamRole.owner }],
});

const pinned = (repository: string) =>
  TEAM.keepsConfigurationIn(Repository.of(repository));

const workspace = (over: { connected?: boolean } = {}) => {
  let held = Workspace.rehydrate({
    id: WorkspaceId.of('ws_1'),
    name: WorkspaceName.of('Acme'),
    slug: WorkspaceSlug.of('acme'),
    members: [{ userId: OWNER, role: WorkspaceRole.owner }],
    teams: [],
  });

  if (over.connected !== false) {
    held = held.connectedTo(Connection.of('github', '42'), OWNER);
  }

  return held;
};

const CONFIG = { path: '.spotlight/config.yml', text: 'version: 1' };

const reading = (
  over: {
    catalog?: readonly string[];
    /** Which repositories hold anything under the configuration directory. */
    holding?: readonly string[];
    files?: readonly { path: string; text: string }[];
    problems?: readonly ConfigurationProblem[];
    strandings?: readonly ConfigurationProblem[];
    head?: string | null;
  } = {},
) => {
  const holding = over.holding ?? ['acme/api'];

  const contents = {
    headOf: vi.fn(async () =>
      over.head === undefined ? 'a1b2c3d' : over.head,
    ),
    under: vi.fn(async ({ repository }: { repository: Repository }) =>
      holding.includes(repository.value) ? (over.files ?? [CONFIG]) : [],
    ),
    read: vi.fn(async () => null),
  } as unknown as RepositoryContentsPort;

  const config = {
    findFor: vi.fn(async () => null),
    save: vi.fn(async () => {}),
  } as unknown as TeamConfigurationRepository;

  const read = vi.fn((_files: readonly { path: string }[]) => ({
    integrations: [],
    problems: over.problems ?? [],
  }));
  const apply = vi.fn(
    async (_teamId: unknown, _files: readonly { path: string }[]) =>
      over.strandings ?? [],
  );

  const saved = vi.fn(async (_team: Team) => {});
  const dispatch = vi.fn(async (_events: readonly unknown[]) => {});

  const service = new ReadConfiguration(
    {
      list: vi.fn(async () =>
        (over.catalog ?? ['acme/api']).map((fullName) => ({ fullName })),
      ),
    } as unknown as RepositoryCatalogPort,
    new ConfigurationTarget(config),
    new HeldConfiguration(contents),
    { read } as unknown as IntegrationReaderPort,
    { apply } as unknown as ApplyLines,
    { save: saved } as unknown as TeamRepository,
    config,
    { dispatch } as unknown as DomainEventDispatcher,
    clock,
    { forTeam: settling } as never,
  );

  return { service, config, contents, read, apply, settling, saved, dispatch };
};

const settling = vi.fn(async () => {});

describe('ReadConfiguration', () => {
  it('reads it and writes down what was found', async () => {
    const { service, config } = reading();

    expect(await service.read(workspace(), TEAM)).toEqual({
      repository: 'acme/api',
      sha: 'a1b2c3d',
      problems: [],
    });

    const [written] = (config.save as never as { mock: { calls: unknown[][] } })
      .mock.calls[0] as [TeamConfiguration];

    expect(written.teamId.value).toBe('team_1');
    expect(written.repository.value).toBe('acme/api');
    expect(written.commit.value).toBe('a1b2c3d');
    expect(written.files.map((each) => each.path)).toEqual([CONFIG.path]);
    expect(written.readAt).toBe(NOW);
  });

  // Two steps at once: the setup pull request is merged when its files can be
  // read, and the tools chosen are the ones those files listen to.
  it('looks at whether that was the last step', async () => {
    const { service, settling } = reading();

    await service.read(workspace(), TEAM);

    expect(settling).toHaveBeenCalled();
  });

  // Read at a commit rather than a branch, so what was read is a fact after.
  it('reads it at the commit the repository stands at', async () => {
    const { service, contents } = reading();

    await service.read(workspace(), TEAM);

    expect(contents.under).toHaveBeenCalledWith(
      expect.objectContaining({ ref: 'a1b2c3d', path: '.spotlight' }),
    );
  });

  describe('finding the repository that holds it', () => {
    it('reads the one somebody pinned, and asks no further', async () => {
      const { service, contents } = reading({
        catalog: ['acme/other', 'acme/api'],
      });

      const read = await service.read(workspace(), pinned('acme/pinned'));

      expect(read?.repository).toBe('acme/pinned');
      expect(contents.under).toHaveBeenCalledTimes(1);
    });

    // Stable rather than clever, so the answer does not change under a
    // workspace that never chose one.
    it('takes the first connected one holding any, where nobody pinned', async () => {
      const { service } = reading({
        catalog: ['acme/empty', 'acme/api', 'acme/also'],
        holding: ['acme/api', 'acme/also'],
      });

      expect((await service.read(workspace(), TEAM))?.repository).toBe(
        'acme/api',
      );
    });

    it('reads nothing where no connected repository holds any', async () => {
      const { service, config } = reading({
        catalog: ['acme/empty'],
        holding: [],
      });

      expect(await service.read(workspace(), TEAM)).toBeNull();
      expect(config.save).not.toHaveBeenCalled();
    });

    it('reads nothing where the workspace reaches no host', async () => {
      const { service, config } = reading();

      expect(
        await service.read(workspace({ connected: false }), TEAM),
      ).toBeNull();
      expect(config.save).not.toHaveBeenCalled();
    });

    it('reads nothing where the pinned repository stands nowhere', async () => {
      const { service } = reading({ head: null });

      expect(await service.read(workspace(), pinned('acme/gone'))).toBeNull();
    });
  });

  // Each reader gets its own directory, or every line reads as a broken
  // integration and every integration as a broken line.
  it('gives each reader only its own directory', async () => {
    const integration = {
      path: '.spotlight/integrations/linear.yml',
      text: 'source: linear',
    };
    const line = { path: '.spotlight/lines/default.yml', text: 'key: default' };
    const { service, read, apply, config } = reading({
      files: [integration, line],
    });

    await service.read(workspace(), TEAM);

    const readFiles = read.mock.calls[0]?.[0] ?? [];
    const appliedFiles = apply.mock.calls[0]?.[1] ?? [];

    expect(readFiles.map((each) => each.path)).toEqual([integration.path]);
    expect(appliedFiles.map((each) => each.path)).toEqual([line.path]);

    // What is written down is still the whole tree, so a delivery can read it.
    const [written] = (config.save as never as { mock: { calls: unknown[][] } })
      .mock.calls[0] as [TeamConfiguration];

    expect(written.files.map((each) => each.path)).toEqual([
      integration.path,
      line.path,
    ]);
  });

  describe('a move under way', () => {
    const moving = () => {
      const underWay = pinned('acme/old').movesConfigurationTo(
        Repository.of('acme/new'),
        null,
      );
      underWay.pullEvents();

      return underWay;
    };

    it('goes on reading where it did until the destination holds configuration', async () => {
      const { service, saved, dispatch } = reading({ holding: ['acme/old'] });

      expect((await service.read(workspace(), moving()))?.repository).toBe(
        'acme/old',
      );
      expect(saved).not.toHaveBeenCalled();
      expect(dispatch).not.toHaveBeenCalled();
    });

    it('lands once the pull request carrying it has merged, and reads from there', async () => {
      const { service, saved, dispatch } = reading({
        holding: ['acme/old', 'acme/new'],
      });

      expect((await service.read(workspace(), moving()))?.repository).toBe(
        'acme/new',
      );

      const [landed] = saved.mock.calls[0] as [Team];
      expect(landed.configRepository?.value).toBe('acme/new');
      expect(landed.movingConfigurationTo).toBeNull();
      expect(dispatch).toHaveBeenCalledWith([expect.any(ConfigurationMoved)]);
    });
  });

  describe('what is wrong with it', () => {
    // Told about while looking at it, rather than at midnight.
    it('writes down what would not read, and answers with it', async () => {
      const broken = ConfigurationProblem.of({
        path: '.spotlight/integrations/linear.yml',
        at: 'the file',
        reason: 'is not YAML',
      });
      const { service, config } = reading({ problems: [broken] });

      expect((await service.read(workspace(), TEAM))?.problems).toEqual([
        broken,
      ]);
      const [written] = (
        config.save as never as { mock: { calls: unknown[][] } }
      ).mock.calls[0] as [TeamConfiguration];

      expect(written.problems.map((each) => each.reason)).toEqual([
        broken.reason,
      ]);
    });

    it('carries what could not be applied without stranding work', async () => {
      const stranded = ConfigurationProblem.of({
        path: '.spotlight/lines/default.yml',
        at: 'stations',
        reason: 'would remove Code Review (2 standing there)',
      });
      const { service } = reading({ strandings: [stranded] });

      expect((await service.read(workspace(), TEAM))?.problems).toEqual([
        stranded,
      ]);
    });

    // A file that will not read leaves the last one that did still running.
    it('writes the files down even where some of them would not read', async () => {
      const { service, config } = reading({
        problems: [
          ConfigurationProblem.of({ path: 'x', at: 'y', reason: 'z' }),
        ],
      });

      await service.read(workspace(), TEAM);

      const [written] = (
        config.save as never as { mock: { calls: unknown[][] } }
      ).mock.calls[0] as [TeamConfiguration];

      expect(written.files.map((each) => each.path)).toEqual([CONFIG.path]);
    });
  });
});
