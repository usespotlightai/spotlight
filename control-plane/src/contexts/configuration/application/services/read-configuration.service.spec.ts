import type { IntegrationReaderPort } from '@configuration/application/ports/integration-reader.port';
import type { LinesPort } from '@configuration/application/ports/lines.port';
import type {
  SkillFolder,
  SkillReaderPort,
} from '@configuration/application/ports/skill-reader.port';
import type { TeamProfile } from '@configuration/application/ports/teams.port';
import { VaultProblems } from '@configuration/application/rendering/vault-problems';
import { HeldConfiguration } from '@configuration/application/services/held-configuration.service';
import { ReadConfiguration } from '@configuration/application/services/read-configuration.service';
import type { TeamVault } from '@configuration/application/services/team-vault.service';
import { ConfigurationHome } from '@configuration/domain/aggregates/configuration-home.aggregate';
import { TeamConfiguration } from '@configuration/domain/aggregates/team-configuration.aggregate';
import { Skill } from '@configuration/domain/entities/skill.entity';
import { ConfigurationMoved } from '@configuration/domain/events/configuration-moved.event';
import { ConfigurationRead } from '@configuration/domain/events/configuration-read.event';
import { ConfigurationHomeMovedOnError } from '@configuration/domain/exceptions/configuration-home-moved-on.error';
import type {
  Keeping,
  TeamConfigurationRepository,
} from '@configuration/domain/repositories/team-configuration.repository';
import { Commit } from '@configuration/domain/value-objects/commit.vo';
import { SkillKey } from '@configuration/domain/value-objects/skill-key.vo';
import { ToolName } from '@configuration/domain/value-objects/tool-name.vo';
import type { VaultRefusal } from '@configuration/domain/value-objects/vault.vo';
import type { RepositoryCatalogPort } from '@github/application/ports/repository-catalog.port';
import type { RepositoryContentsPort } from '@github/application/ports/repository-contents.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-03T08:00:00.000Z');
const clock: ClockPort = { now: () => NOW, sleep: async () => {} };

const TEAM: TeamProfile = {
  teamId: TeamId.of('team_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  connected: true,
};

const UNREACHABLE: TeamProfile = { ...TEAM, connected: false };

const pinned = (repository: string) =>
  ConfigurationHome.rehydrate({
    workspaceId: TEAM.workspaceId,
    teamId: TEAM.teamId,
    keptIn: Repository.of(repository),
    movingTo: null,
    version: 1,
  });

const CONFIG = { path: '.spotlight/config.yml', text: 'version: 1' };

const reading = (
  over: {
    catalog?: readonly string[];
    holding?: readonly string[];
    files?: readonly { path: string; text: string }[];
    problems?: readonly ConfigurationProblem[];
    skillProblems?: readonly ConfigurationProblem[];
    skills?: readonly SkillFolder[];
    sealing?: VaultRefusal;
    strandings?: readonly ConfigurationProblem[];
    stations?: Awaited<ReturnType<LinesPort['plan']>>['stations'];
    home?: ConfigurationHome | null;
    homesInTurn?: (ConfigurationHome | null)[];
    saveHome?: (home: ConfigurationHome) => Promise<void>;
    head?: string | null;
    kept?: Keeping;
    standing?: TeamConfiguration | null;
    clock?: ClockPort;
    log?: string[];
  } = {},
) => {
  const holding = over.holding ?? ['acme/api'];

  const contents = {
    headOf: vi.fn(async () => {
      over.log?.push('head');
      return over.head === undefined ? 'a1b2c3d' : over.head;
    }),
    under: vi.fn(async ({ repository }: { repository: Repository }) =>
      holding.includes(repository.value) ? (over.files ?? [CONFIG]) : [],
    ),
    read: vi.fn(async () => null),
  } as unknown as RepositoryContentsPort;

  const config = {
    findFor: vi.fn(async () => over.standing ?? null),
    save: vi.fn(async () => over.kept ?? 'kept'),
  } as unknown as TeamConfigurationRepository;

  const read = vi.fn((_files: readonly { path: string }[]) => ({
    integrations: [],
    problems: over.problems ?? [],
  }));
  const readSkills = vi.fn((_files: readonly { path: string }[]) => ({
    skills: over.skills ?? [],
    problems: over.skillProblems ?? [],
  }));
  const plan = vi.fn(
    async (_teamId: unknown, _files: readonly { path: string }[]) => ({
      stations: over.stations ?? [],
      problems: over.strandings ?? [],
    }),
  );

  const saved = vi.fn(
    over.saveHome ?? (async (_home: ConfigurationHome) => {}),
  );

  const service = new ReadConfiguration(
    {
      list: vi.fn(async () =>
        (over.catalog ?? ['acme/api']).map((fullName) => ({ fullName })),
      ),
    } as unknown as RepositoryCatalogPort,
    new HeldConfiguration(contents),
    { read } as unknown as IntegrationReaderPort,
    { read: readSkills } as unknown as SkillReaderPort,
    {
      open: vi.fn(async () =>
        over.sealing
          ? { opened: false, refusal: over.sealing }
          : { opened: true, vault: { names: [] } },
      ),
    } as unknown as TeamVault,
    { plan, offersBuiltIn: () => false } satisfies LinesPort,
    {
      find: async () =>
        over.homesInTurn
          ? (over.homesInTurn.shift() ?? null)
          : (over.home ?? null),
      save: saved,
    },
    config,
    over.clock ?? clock,
    { run: (work) => work() },
  );

  return {
    service,
    config,
    contents,
    read,
    readSkills,
    plan,
    saved,
  };
};

describe('ReadConfiguration', () => {
  it('warns of a skill whose secrets the vault lacks, and of a tool it brings that nothing offers', async () => {
    const { service } = reading({
      files: [CONFIG, { path: '.spotlight/secrets.vault', text: 'sealed' }],
      skills: [
        {
          skill: Skill.defined({
            key: SkillKey.of('grafana-dashboards'),
            description: 'Reading dashboards.',
            instructions: 'Search them.',
            secrets: [
              {
                name: SecretName.of('GRAFANA_TOKEN'),
                description: 'Read-only token',
              },
            ],
            tools: [ToolName.of('grafana.search')],
          }),
          files: [
            { path: 'SKILL.md', text: '---\nname: grafana-dashboards\n---\n' },
          ],
        },
      ],
    });

    const read = await service.read(TEAM);

    expect(read?.problems.map((each) => each.at)).toEqual([
      'secrets.GRAFANA_TOKEN',
      'tools.0',
    ]);
  });

  it('warns of a skill that writes a secret into any file a run reads', async () => {
    const { service } = reading({
      skills: [
        {
          skill: Skill.defined({
            key: SkillKey.of('grafana-dashboards'),
            description: 'Reading dashboards.',
            instructions: 'Search them.',
          }),
          files: [
            { path: 'SKILL.md', text: '---\nname: grafana-dashboards\n---\n' },
            {
              path: 'examples/search.md',
              text: `curl -H "Authorization: \${{ secrets.GRAFANA_TOKEN }}"`,
            },
          ],
        },
      ],
    });

    const read = await service.read(TEAM);

    expect(
      read?.problems.map((each) => `${each.path} ${each.at}: ${each.reason}`),
    ).toEqual([
      '.spotlight/skills/grafana-dashboards/SKILL.md the file: writes a secret into what a run reads, and a run is never given one: reach for it through a tool instead',
    ]);
  });

  it('warns of what a line gives that the team neither offers nor keeps, where it is written', async () => {
    const station = {
      path: '.spotlight/lines/default/stations/implementation.md',
      tools: [ToolName.of('linear.close')],
      skills: [SkillKey.of('frontend')],
    };
    const { service } = reading({ stations: [station] });

    const read = await service.read(TEAM);

    expect(read?.problems.map((each) => `${each.path} ${each.at}`)).toEqual([
      '.spotlight/lines/default/stations/implementation.md tools.0',
      '.spotlight/lines/default/stations/implementation.md skills.0',
    ]);
  });

  it('reads it and writes down what was found', async () => {
    const { service, config } = reading();

    expect(await service.read(TEAM)).toEqual({
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

  it('says it read it, so setup can settle and lines can be applied', async () => {
    const { service, config } = reading();

    await service.read(TEAM);

    const [written] = (config.save as never as { mock: { calls: unknown[][] } })
      .mock.calls[0] as [TeamConfiguration];

    expect(written.pullEvents()).toEqual([expect.any(ConfigurationRead)]);
  });

  it('keeps what it listens to, so reading it back needs no second read', async () => {
    const { service, config, read } = reading();
    read.mockReturnValueOnce({
      integrations: [
        {
          source: 'linear',
          path: '.spotlight/integrations/linear.yml',
          name: 'Linear',
          connects: true,
          credentials: [],
          offers: [],
        },
      ] as never,
      problems: [],
    });

    await service.read(TEAM);

    const [written] = (config.save as never as { mock: { calls: unknown[][] } })
      .mock.calls[0] as [TeamConfiguration];

    expect(
      written.integrations.map((each) => [each.source, each.connectable]),
    ).toEqual([['linear', true]]);
  });

  it('reads it at the commit the repository stands at', async () => {
    const { service, contents } = reading();

    await service.read(TEAM);

    expect(contents.under).toHaveBeenCalledWith(
      expect.objectContaining({ ref: 'a1b2c3d', path: '.spotlight' }),
    );
  });

  describe('finding the repository that holds it', () => {
    it('reads the one somebody pinned, and asks no further', async () => {
      const { service, contents } = reading({
        catalog: ['acme/other', 'acme/api'],
        home: pinned('acme/pinned'),
      });

      const read = await service.read(TEAM);

      expect(read?.repository).toBe('acme/pinned');
      expect(contents.under).toHaveBeenCalledTimes(1);
    });

    it('takes the first connected one holding any, where nobody pinned', async () => {
      const { service } = reading({
        catalog: ['acme/empty', 'acme/api', 'acme/also'],
        holding: ['acme/api', 'acme/also'],
      });

      expect((await service.read(TEAM))?.repository).toBe('acme/api');
    });

    it('reads nothing where no connected repository holds any', async () => {
      const { service, config } = reading({
        catalog: ['acme/empty'],
        holding: [],
      });

      expect(await service.read(TEAM)).toBeNull();
      expect(config.save).not.toHaveBeenCalled();
    });

    it('reads nothing where the workspace reaches no host', async () => {
      const { service, config } = reading();

      expect(await service.read(UNREACHABLE)).toBeNull();
      expect(config.save).not.toHaveBeenCalled();
    });

    it('reads nothing where the pinned repository stands nowhere', async () => {
      const { service } = reading({ head: null, home: pinned('acme/gone') });

      expect(await service.read(TEAM)).toBeNull();
    });
  });

  it('gives each reader only its own directory', async () => {
    const integration = {
      path: '.spotlight/integrations/linear.yml',
      text: 'source: linear',
    };
    const line = {
      path: '.spotlight/lines/default/line.yml',
      text: 'key: default',
    };
    const { service, read, plan, config } = reading({
      files: [integration, line],
    });

    await service.read(TEAM);

    const readFiles = read.mock.calls[0]?.[0] ?? [];
    const appliedFiles = plan.mock.calls[0]?.[1] ?? [];

    expect(readFiles.map((each) => each.path)).toEqual([integration.path]);
    expect(appliedFiles.map((each) => each.path)).toEqual([line.path]);

    const [written] = (config.save as never as { mock: { calls: unknown[][] } })
      .mock.calls[0] as [TeamConfiguration];

    expect(written.files.map((each) => each.path)).toEqual([
      integration.path,
      line.path,
    ]);
  });

  it('reads the skills among every file, and writes down what is wrong with them', async () => {
    const skill = {
      path: '.spotlight/skills/ours/SKILL.md',
      text: '# Ours',
    };
    const broken = ConfigurationProblem.of({
      path: skill.path,
      at: 'the file',
      reason: 'opens with no frontmatter',
    });
    const { service, readSkills, config } = reading({
      files: [CONFIG, skill],
      skillProblems: [broken],
    });

    expect((await service.read(TEAM))?.problems).toEqual([broken]);
    expect(
      (readSkills.mock.calls[0]?.[0] ?? []).map((each) => each.path),
    ).toEqual([CONFIG.path, skill.path]);

    const [written] = (config.save as never as { mock: { calls: unknown[][] } })
      .mock.calls[0] as [TeamConfiguration];

    expect(written.problems).toEqual([broken]);
  });

  it('writes down a secrets vault Spotlight cannot open', async () => {
    const vault = {
      path: '.spotlight/secrets.vault',
      text: '-----BEGIN AGE ENCRYPTED FILE-----',
    };
    const { service } = reading({
      files: [CONFIG, vault],
      sealing: { because: 'not-for-this-key' },
    });

    expect((await service.read(TEAM))?.problems).toEqual([
      VaultProblems.problem({ because: 'not-for-this-key' }),
    ]);
    expect(VaultProblems.problem({ because: 'not-for-this-key' }).path).toBe(
      vault.path,
    );
  });

  describe('a move under way', () => {
    const moving = () => {
      const underWay = pinned('acme/old').movesTo(
        Repository.of('acme/new'),
        null,
      );
      underWay.pullEvents();

      return underWay;
    };

    it('goes on reading where it did until the destination holds configuration', async () => {
      const { service, saved } = reading({
        holding: ['acme/old'],
        home: moving(),
      });

      expect((await service.read(TEAM))?.repository).toBe('acme/old');
      expect(saved).not.toHaveBeenCalled();
    });

    it('lands once the pull request carrying it has merged, and reads from there', async () => {
      const { service, saved } = reading({
        holding: ['acme/old', 'acme/new'],
        home: moving(),
      });

      expect((await service.read(TEAM))?.repository).toBe('acme/new');

      const [landed] = saved.mock.calls[0] as [ConfigurationHome];
      expect(landed.keptIn?.value).toBe('acme/new');
      expect(landed.movingTo).toBeNull();
      expect(landed.pullEvents()).toEqual([expect.any(ConfigurationMoved)]);
    });
  });

  describe('a move under way, while the home is written by another', () => {
    const moving = () => {
      const underWay = pinned('acme/old').movesTo(
        Repository.of('acme/new'),
        null,
      );
      underWay.pullEvents();

      return underWay;
    };

    it('reads the home again and lands the move on its second try', async () => {
      let tries = 0;
      const { service, saved } = reading({
        holding: ['acme/old', 'acme/new'],
        homesInTurn: [moving(), moving()],
        saveHome: async () => {
          tries += 1;
          if (tries === 1) {
            throw new ConfigurationHomeMovedOnError('team_1');
          }
        },
      });

      expect((await service.read(TEAM))?.repository).toBe('acme/new');
      expect(saved).toHaveBeenCalledTimes(2);
    });

    it('leaves the move for the next read, reading from the home as it now stands, where it keeps changing', async () => {
      const { service, saved } = reading({
        holding: ['acme/old', 'acme/new', 'acme/elsewhere'],
        homesInTurn: [moving(), moving(), pinned('acme/elsewhere')],
        saveHome: async () => {
          throw new ConfigurationHomeMovedOnError('team_1');
        },
      });

      expect((await service.read(TEAM))?.repository).toBe('acme/elsewhere');
      expect(saved).toHaveBeenCalledTimes(2);
    });
  });

  describe('readings that overlap', () => {
    it('begins its reading before it asks where the repository stands', async () => {
      const log: string[] = [];
      let tick = 0;
      const { service, config } = reading({
        log,
        clock: {
          now: () => {
            log.push('now');
            tick += 1;
            return new Date(NOW.getTime() + tick * 1000);
          },
          sleep: async () => {},
        },
      });

      await service.read(TEAM);

      const [written] = (
        config.save as never as { mock: { calls: unknown[][] } }
      ).mock.calls[0] as [TeamConfiguration];

      expect(log.slice(0, 2)).toEqual(['now', 'head']);
      expect(written.begunAt.getTime()).toBeLessThan(written.readAt.getTime());
    });

    it('answers with the newer reading where one begun later was kept first', async () => {
      const newer = TeamConfiguration.rehydrate({
        teamId: TEAM.teamId,
        repository: Repository.of('acme/api'),
        commit: Commit.of('b2c3d4e'),
        files: [],
        problems: [],
        integrations: [],
        begunAt: NOW,
        readAt: NOW,
      });
      const { service } = reading({ kept: 'superseded', standing: newer });

      expect(await service.read(TEAM)).toEqual({
        repository: 'acme/api',
        sha: 'b2c3d4e',
        problems: [],
      });
    });
  });

  describe('what is wrong with it', () => {
    it('writes down what would not read, and answers with it', async () => {
      const broken = ConfigurationProblem.of({
        path: '.spotlight/integrations/linear.yml',
        at: 'the file',
        reason: 'is not YAML',
      });
      const { service, config } = reading({ problems: [broken] });

      expect((await service.read(TEAM))?.problems).toEqual([broken]);
      const [written] = (
        config.save as never as { mock: { calls: unknown[][] } }
      ).mock.calls[0] as [TeamConfiguration];

      expect(written.problems.map((each) => each.reason)).toEqual([
        broken.reason,
      ]);
    });

    it('carries what could not be applied without stranding work', async () => {
      const stranded = ConfigurationProblem.of({
        path: '.spotlight/lines/default/line.yml',
        at: 'stations',
        reason: 'would remove Code Review (2 standing there)',
      });
      const { service } = reading({ strandings: [stranded] });

      expect((await service.read(TEAM))?.problems).toEqual([stranded]);
    });

    it('writes the files down even where some of them would not read', async () => {
      const { service, config } = reading({
        problems: [
          ConfigurationProblem.of({ path: 'x', at: 'y', reason: 'z' }),
        ],
      });

      await service.read(TEAM);

      const [written] = (
        config.save as never as { mock: { calls: unknown[][] } }
      ).mock.calls[0] as [TeamConfiguration];

      expect(written.files.map((each) => each.path)).toEqual([CONFIG.path]);
    });
  });
});
