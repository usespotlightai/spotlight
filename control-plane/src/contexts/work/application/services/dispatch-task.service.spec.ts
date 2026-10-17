import type {
  CatalogGiving,
  CatalogNamed,
} from '@catalog/application/contracts/catalog.contract';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { InputSchema } from '@shared-kernel/domain/value-objects/input-schema.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { HarnessProfileShape } from '@work/application/contracts/harness-profile.contract';
import {
  RunSpecContract,
  type RunSpecShape,
} from '@work/application/contracts/run-spec.contract';
import type { ReadySkillFolder } from '@work/application/dto/ready-skill.dto';
import type { BuiltInSkillsPort } from '@work/application/ports/built-in-skills.port';
import type {
  HarnessLaunchPort,
  SkillsHome,
} from '@work/application/ports/harness-launch.port';
import type {
  BriefingPlace,
  BriefingSelection,
  TouchedFile,
} from '@work/application/ports/team-memories.port';
import { DispatchTask } from '@work/application/services/dispatch-task.service';
import { StationCatalog } from '@work/application/services/station-catalog.service';
import type { StationSkills } from '@work/application/services/station-skills.service';
import type { TeamIntegrations } from '@work/application/services/team-integrations.service';
import type { TouchedFiles } from '@work/application/services/touched-files';
import { Line } from '@work/domain/aggregates/line.aggregate';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import type {
  RunExtras,
  RunRepository,
} from '@work/domain/repositories/run.repository';
import {
  HANDING_OVER,
  OPENING_PULL_REQUESTS,
  USING_TOOLS,
} from '@work/domain/services/built-in-skills';
import type { HarnessCatalog } from '@work/domain/services/harness-catalog';
import { AgentPrompt } from '@work/domain/value-objects/agent-prompt.vo';
import { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import { Effort } from '@work/domain/value-objects/effort.vo';
import { Harness } from '@work/domain/value-objects/harness.vo';
import { HarnessCommand } from '@work/domain/value-objects/harness-command.vo';
import { HarnessName } from '@work/domain/value-objects/harness-name.vo';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { ProfileKey } from '@work/domain/value-objects/profile-key.vo';
import { RepositorySetup } from '@work/domain/value-objects/repository-setup.vo';
import { SkillKey } from '@work/domain/value-objects/skill-key.vo';
import { StationCheck } from '@work/domain/value-objects/station-check.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { Tool } from '@work/domain/value-objects/tool.vo';
import { WayOut } from '@work/domain/value-objects/way-out.vo';
import { WorkedRepository } from '@work/domain/value-objects/worked-repository.vo';
import { Sha256ContentDigest } from '@work/infrastructure/hashing/sha256-content-digest';
import { beforeEach, describe, expect, it } from 'vitest';

const NOW = new Date('2026-08-28T12:00:00.000Z');

const written = (run?: Run): RunSpecShape => {
  if (!run) {
    throw new Error('nothing was queued');
  }
  return RunSpecContract.toWire(run.spec);
};

const DEV = Harness.of({
  id: HarnessId.of('dev'),
  name: HarnessName.of('Dev'),
});

const DEV_EXECUTABLE = 'dev-agent';
const DEV_ARGS = ['--acp'];

const harnesses: HarnessCatalog = {
  all: () => [DEV],
  named: (id: HarnessId) => (id.equals(DEV.id) ? DEV : null),
};

let skillsHome: SkillsHome = {
  directory: '.claude/skills',
  readByHarness: true,
};

const commandFor: HarnessLaunchPort['commandFor'] = (id, chosen) =>
  id.equals(DEV.id)
    ? HarnessCommand.of({
        executable: DEV_EXECUTABLE,
        args: DEV_ARGS,
        env: chosen.model ? { DEV_MODEL: chosen.model.value } : {},
      })
    : null;

const launch: HarnessLaunchPort = {
  skillsFor: () => skillsHome,
  skillHomes: () => ['.claude/skills', '.spotlight/skills'],
  settingFiles: () => ['claude/settings.json', 'codex/config.toml'],
  commandFor,
  preparedFor: (id, chosen) => {
    const command = commandFor(id, chosen);

    return command
      ? {
          command,
          setup: chosen.profile
            ? {
                files: [
                  { path: 'dev/settings.json', text: chosen.profile.key.value },
                ],
                mcpServers: chosen.profile.mcpServers.map((server) => ({
                  name: server.name,
                  command: server.command,
                  args: [...server.args],
                  env: Object.entries(server.env).map(([name, value]) => ({
                    name,
                    value,
                  })),
                })),
                asks: ['execute'],
              }
            : null,
        }
      : null;
  },
  catalogue: () => [],
};

let teamProfiles: Record<string, HarnessProfileShape> = {};

const profiles = {
  named: async (_teamId: TeamId, key: string) => teamProfiles[key] ?? null,
};

const at = (
  id: string,
  name: string,
  position: number,
  harness?: HarnessId,
  passesTo: string[] = [],
  gives: { tools?: string[]; skills?: SkillKey[] } = {},
) =>
  Station.of({
    id: StationId.of(id),
    key: StationKey.of(name.toLowerCase()),
    name: StationName.of(name),
    position,
    color: StationColor.of('#a3a8b0'),
    harness,
    wayOut: WayOut.of({ stations: passesTo.map(StationId.of) }),
    kind:
      position === 0 ? 'backlog' : name === 'Completed' ? 'completed' : 'work',
    tools: (gives.tools ?? []).map((each) => Tool.of(each)),
    skills: gives.skills ?? [],
  });

const stations = [
  at('station_1', 'Backlog', 0, undefined, ['station_2']),
  at('station_2', 'Triage', 1, DEV.id, ['station_3']),
  at('station_3', 'Spec', 2, DEV.id),
  at('station_4', 'Completed', 3),
];

const triage = (gives: { tools?: string[]; skills?: SkillKey[] }) =>
  at('station_2', 'Triage', 1, DEV.id, ['station_3'], gives);

const task = (stationId: string, title = 'Fix the queue') =>
  Task.add({
    line: lineWith(),
    at: StationId.of(stationId),
    title: TaskTitle.of(title),
    rank: TaskRank.of('i'),
    raisedBy: UserId.of('user_1'),
    now: NOW,
    newId: () => 'task_1',
  });

let queued: Run[] = [];
let kept: RunExtras[] = [];

const runs = {
  add: async (run: Run, alongside: RunExtras = {}) => {
    queued.push(run);
    kept.push(alongside);
  },
} as unknown as RunRepository;

const ids: IdGeneratorPort = { generate: () => 'run_1' };

type Worked = string | WorkedRepository;

const worked = (each: Worked): WorkedRepository =>
  typeof each === 'string' ? WorkedRepository.of(Repository.of(each)) : each;

const lineWith = (changed?: Station, repositories: readonly Worked[] = []) =>
  Line.rehydrate({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('default'),
    name: LineName.of('Default'),
    repositories: repositories.map(worked),
    stations: changed
      ? stations.map((each) => (each.equals(changed) ? changed : each))
      : stations,
  });

const SHIPPED_SKILLS: ReadySkillFolder[] = [
  {
    skill: {
      key: HANDING_OVER.value,
      description: 'Passing a task on.',
      tools: [],
    },
    files: [
      { path: 'SKILL.md', text: `---\nname: ${HANDING_OVER.value}\n---\n` },
    ],
  },
  {
    skill: {
      key: OPENING_PULL_REQUESTS.value,
      description: 'Opening a pull request.',
      tools: [],
    },
    files: [
      {
        path: 'SKILL.md',
        text: `---\nname: ${OPENING_PULL_REQUESTS.value}\n---\n`,
      },
    ],
  },
  {
    skill: {
      key: USING_TOOLS.value,
      description: 'Finding and calling tools.',
      tools: [],
    },
    files: [
      { path: 'SKILL.md', text: `---\nname: ${USING_TOOLS.value}\n---\n` },
    ],
  },
];

const SHIPPED: BuiltInSkillsPort = {
  named: (key) => SHIPPED_SKILLS.find((each) => each.skill.key === key) ?? null,
};

let offeredTools: DeclaredTool[] = [];
let offeredAsked: string[] = [];

const integrations = {
  offered: async (_line: unknown, tools: readonly Tool[]) => {
    offeredAsked = tools.map((each) => each.value);
    return offeredTools;
  },
} as unknown as TeamIntegrations;

let keptSkills: ReadySkillFolder[] = [];

const teamSkills = {
  readyAt: async (_line: Line, station: Station) =>
    keptSkills.filter((each) =>
      station.skills.some((key) => key.value === each.skill.key),
    ),
} as unknown as StationSkills;

const toolsGiven = (run?: Run) =>
  (run ? (RunSpecContract.toWire(run.spec).manifest ?? []) : []).map(
    (each) => each.name,
  );

const tracing = {
  for: (taskId: { value: string }, runId: { value: string }) =>
    `trace:${taskId.value}:${runId.value}`,
  forChat: (chatId: { value: string }, runId: { value: string }) =>
    `trace:${chatId.value}:${runId.value}`,
  forSearch: (searchId: { value: string }, runId: { value: string }) =>
    `trace:${searchId.value}:${runId.value}`,
};

let catalogGiving: CatalogGiving = { tools: [], skills: [], denied: [] };
let catalogAsked: CatalogNamed[] = [];

const catalog = new StationCatalog({
  givenTo: async (_workspace, named) => {
    catalogAsked.push(named);
    return catalogGiving;
  },
  call: async () => ({ kind: 'answered', output: null }),
});

const WEB_SEARCH = {
  id: 'catalog.web-search@1.1.0',
  description: 'Search the web.',
  inputs: [
    {
      name: 'query',
      schema: { type: 'string' },
      description: null,
      required: true,
      defaulted: false,
      piped: false,
    },
  ],
};

let briefedAt: BriefingPlace[] = [];
let remembered: BriefingSelection = { briefed: [], cut: [], folder: null };
let touchedOnTask: TouchedFile[] = [];
let memoryFails = false;

const dispatch = async (
  station: Station,
  given?: Task,
  repositories?: readonly Worked[],
) => {
  const service = new DispatchTask(
    runs,
    ids,
    harnesses,
    launch,
    tracing,
    SHIPPED,
    teamSkills,
    integrations,
    { ofTask: async () => [] },
    catalog,
    profiles,
    {
      forBriefing: async (place: BriefingPlace) => {
        briefedAt.push(place);
        if (memoryFails) {
          throw new Error('memory is down');
        }
        return remembered;
      },
    },
    { onTask: async () => touchedOnTask } as unknown as TouchedFiles,
    {
      debug: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    },
    { inSavepoint: (work) => work() },
    new Sha256ContentDigest(),
  );
  const working = given ?? task(station.id.value);
  const line = lineWith(station, repositories);
  const runId = await service.runIdFor({ task: working, line });

  if (runId) {
    await service.enqueue({
      task: working.assignRun(runId, line),
      line,
      runId,
    });
  }

  return runId;
};

describe('DispatchTask', () => {
  beforeEach(() => {
    briefedAt = [];
    remembered = { briefed: [], cut: [], folder: null };
    touchedOnTask = [];
    queued = [];
    kept = [];
    catalogGiving = { tools: [], skills: [], denied: [] };
    catalogAsked = [];
  });

  describe('what it gives from the catalog', () => {
    it('asks the catalog only for what the station names from it', async () => {
      await dispatch(
        triage({
          tools: ['pull-request', 'catalog.web-search@1.1.0'],
          skills: [SkillKey.of('catalog.research@1.0.0')],
        }),
      );

      expect(catalogAsked).toEqual([
        {
          tools: ['catalog.web-search@1.1.0'],
          skills: ['catalog.research@1.0.0'],
        },
      ]);
    });

    it('asks it nothing where the station names nothing from it', async () => {
      await dispatch(triage({ tools: ['pull-request'] }));

      expect(catalogAsked).toEqual([]);
    });

    it('names a catalog tool without its version, and pins the version in the run', async () => {
      catalogGiving = { tools: [WEB_SEARCH], skills: [], denied: [] };

      await dispatch(triage({ tools: ['catalog.web-search@1.1.0'] }));

      expect(toolsGiven(queued[0])).toEqual(['catalog.web-search']);
      expect(written(queued[0]).catalog).toEqual(['catalog.web-search@1.1.0']);
      expect(queued[0]?.state).toBe('queued');
    });

    it('lays a catalog skill in its own folder and gives the tools it brings', async () => {
      catalogGiving = {
        tools: [WEB_SEARCH],
        skills: [
          {
            id: 'catalog.research@1.0.0',
            description: 'Research on the web.',
            files: [{ path: 'SKILL.md', text: '---\nname: research\n---\n' }],
            tools: [WEB_SEARCH.id],
          },
        ],
        denied: [],
      };

      await dispatch(
        triage({ skills: [SkillKey.of('catalog.research@1.0.0')] }),
      );

      expect(written(queued[0]).skills?.map((each) => each.path)).toContain(
        '.claude/skills/spotlight-catalog-research/SKILL.md',
      );
      expect(toolsGiven(queued[0])).toEqual(['catalog.web-search']);
    });

    it('fails the run as entitlement_lapsed, rather than running without it, when the plan has lapsed', async () => {
      catalogGiving = {
        tools: [],
        skills: [],
        denied: [
          {
            id: WEB_SEARCH.id,
            reason: 'lapsed',
            because:
              'catalog.web-search@1.1.0 needs the Team plan, and this workspace’s Team plan lapsed at 2026-09-01T00:00:00.000Z',
          },
        ],
      };

      await dispatch(triage({ tools: ['catalog.web-search@1.1.0'] }));

      expect(queued[0]?.state).toBe('failed');
      expect(queued[0]?.outcome?.message).toBe(
        'entitlement_lapsed: catalog.web-search@1.1.0 needs the Team plan, and this workspace’s Team plan lapsed at 2026-09-01T00:00:00.000Z',
      );
      expect(queued[0]?.pullEvents().map((each) => each.kind)).toEqual([
        'run.completed',
      ]);
    });
  });

  describe('why it refuses a run that the catalog denies an item to', () => {
    it.each([
      ['unknown', 'catalog_item_unknown'],
      ['wrong-kind', 'catalog_item_wrong_kind'],
      ['not-entitled', 'not_entitled'],
      ['lapsed', 'entitlement_lapsed'],
    ] as const)('names a refusal for %s as %s', async (reason, code) => {
      catalogGiving = {
        tools: [],
        skills: [],
        denied: [{ id: WEB_SEARCH.id, reason, because: 'denied here' }],
      };

      await dispatch(triage({ tools: ['catalog.web-search@1.1.0'] }));

      expect(queued[0]?.outcome?.message).toBe(`${code}: denied here`);
    });

    it('names every refusal, each by its own reason', async () => {
      catalogGiving = {
        tools: [],
        skills: [],
        denied: [
          { id: WEB_SEARCH.id, reason: 'lapsed', because: 'lapsed here' },
          {
            id: 'catalog.research@9.0.0',
            reason: 'unknown',
            because: 'unknown here',
          },
        ],
      };

      await dispatch(
        triage({
          tools: ['catalog.web-search@1.1.0'],
          skills: [SkillKey.of('catalog.research@9.0.0')],
        }),
      );

      expect(queued[0]?.outcome?.message).toBe(
        'entitlement_lapsed: lapsed here; catalog_item_unknown: unknown here',
      );
    });
  });

  describe('the codebases a run works in', () => {
    it('names each of the line’s repositories through Spotlight, never GitHub', async () => {
      const station = stations[1] as Station;

      await dispatch(station, undefined, ['acme/widgets']);

      expect(written(queued[0]).checkouts).toEqual([
        {
          remote: 'spotlight:repository',
          path: 'widgets',
          branch: 'spotlight/task_1',
        },
      ]);
    });

    it('checks out every repository the line works, side by side', async () => {
      const station = stations[1] as Station;

      await dispatch(station, undefined, ['acme/api', 'acme/web']);

      expect(written(queued[0]).checkouts).toEqual([
        {
          remote: 'spotlight:repository',
          path: 'api',
          branch: 'spotlight/task_1',
        },
        {
          remote: 'spotlight:repository',
          path: 'web',
          branch: 'spotlight/task_1',
        },
      ]);
    });

    it('checks out only the pull request a task reviews, at its head, on no branch of its own', async () => {
      const station = stations[1] as Station;

      await dispatch(
        station,
        task(station.id.value).reviews(
          PullRequestUrl.of('https://github.com/acme/api/pull/42'),
          { outside: false },
        ),
        ['acme/widgets', 'acme/web'],
      );

      expect(written(queued[0]).checkouts).toEqual([
        {
          remote: 'spotlight:repository',
          path: 'api',
          ref: 'refs/pull/42/head',
          diffOf: 'commits',
        },
      ]);
    });

    it('makes each checkout ready as its repository says', async () => {
      await dispatch(stations[1] as Station, undefined, [
        WorkedRepository.of(Repository.of('acme/api'), {
          setup: RepositorySetup.of('npm ci'),
        }),
        'acme/web',
      ]);

      expect(written(queued[0]).checkouts).toEqual([
        {
          remote: 'spotlight:repository',
          path: 'api',
          branch: 'spotlight/task_1',
          setup: 'npm ci',
        },
        {
          remote: 'spotlight:repository',
          path: 'web',
          branch: 'spotlight/task_1',
        },
      ]);
    });

    it('records the station’s check on the run its change is drafted from, so later edits to the station leave it be', async () => {
      const checking = (diffs: boolean) =>
        Station.of({
          id: StationId.of('station_2'),
          key: StationKey.of('triage'),
          name: StationName.of('Triage'),
          position: 1,
          color: StationColor.of('#a3a8b0'),
          harness: DEV.id,
          wayOut: WayOut.of({ stations: [StationId.of('station_3')] }),
          kind: 'work',
          diffs,
          check: StationCheck.of('npm test'),
        });

      await dispatch(checking(true));
      await dispatch(checking(false));

      expect(written(queued[0]).check).toBe('npm test');
      expect(written(queued[1]).check).toBeUndefined();
    });

    it('places the run in the image the line’s repositories name', async () => {
      await dispatch(stations[1] as Station, undefined, [
        WorkedRepository.of(Repository.of('acme/api'), {
          image: RunnerImage.of('ghcr.io/acme/api:1'),
        }),
      ]);

      expect(queued[0]?.placement.image?.value).toBe('ghcr.io/acme/api:1');
      expect(queued[0]?.placement.clauses).toEqual([]);
    });

    it('asks for no checkout where the line works no repository', async () => {
      await dispatch(stations[1] as Station);

      expect(written(queued[0]).checkouts).toEqual([]);
    });
  });

  describe('the harness profile a station names', () => {
    const careful: HarnessProfileShape = {
      key: 'careful',
      rules: [],
      mcpServers: [],
      native: {},
    };

    const naming = (profile: string) =>
      Station.of({
        id: StationId.of('station_2'),
        key: StationKey.of('triage'),
        name: StationName.of('Triage'),
        position: 1,
        color: StationColor.of('#a3a8b0'),
        harness: DEV.id,
        profile: ProfileKey.of(profile),
        wayOut: WayOut.of({ stations: [StationId.of('station_3')] }),
      });

    beforeEach(() => {
      teamProfiles = { careful };
    });

    it('sets the harness up as the profile says, asking through Spotlight', async () => {
      await dispatch(naming('careful'));

      expect(written(queued[0]).harnessSetup).toEqual({
        files: [{ path: 'dev/settings.json', text: 'careful' }],
        mcpServers: [],
        asks: ['execute'],
      });
    });

    it('hands an MCP server a stand-in for each secret that egress injects, and the run the secrets to fetch', async () => {
      teamProfiles = {
        careful,
        linear: {
          key: 'linear',
          rules: [],
          mcpServers: [
            {
              name: 'linear',
              command: 'npx',
              args: ['-y', 'linear-mcp'],
              env: {
                LINEAR_API_KEY: 'secret.LINEAR_API_KEY',
                LINEAR_TEAM: 'core',
              },
            },
            {
              name: 'linear-again',
              command: 'npx',
              args: [],
              env: { TOKEN: 'secret.LINEAR_API_KEY' },
            },
          ],
          native: {},
        },
      };

      await dispatch(naming('linear'));

      const spec = written(queued[0]);
      expect(spec.harnessSetup?.mcpServers.map((each) => each.env)).toEqual([
        [
          { name: 'LINEAR_API_KEY', value: 'spotlight-egress:LINEAR_API_KEY' },
          { name: 'LINEAR_TEAM', value: 'core' },
        ],
        [{ name: 'TOKEN', value: 'spotlight-egress:LINEAR_API_KEY' }],
      ]);
      expect(spec.injectedSecrets).toEqual(['LINEAR_API_KEY']);
    });

    it('fails the run, saying why, where the team has no such profile', async () => {
      const id = await dispatch(naming('reckless'));

      expect(id).not.toBeNull();
      expect(queued[0]?.state).toBe('failed');
      expect(queued[0]?.outcome?.message).toBe(
        'harness_profile_unknown: Harness profile reckless is not in this team. Station: Triage',
      );
      expect(written(queued[0]).harnessSetup).toBeUndefined();
    });

    it('sets nothing up for a station that names no profile', async () => {
      await dispatch(stations[1] as Station);

      expect(written(queued[0]).harnessSetup).toBeUndefined();
      expect(written(queued[0]).injectedSecrets).toBeUndefined();
      expect(queued[0]?.placement.isAnywhere).toBe(true);
    });
  });

  it('queues a run for the harness the station is worked by', async () => {
    const id = await dispatch(stations[1] as Station);

    expect(id?.value).toBe('run_1');
    expect(queued).toHaveLength(1);
    expect(queued[0]?.harness.value).toBe(DEV.id.value);
  });

  it('hands the run what its station may reach for', async () => {
    await dispatch(triage({ tools: ['pull-request'] }));

    expect(toolsGiven(queued[0])).toEqual(['pull-request']);
  });

  it('hands a station with no tools none', async () => {
    await dispatch(stations[1] as Station);

    expect(toolsGiven(queued[0])).toEqual([]);
  });

  it('queues nothing for a station nothing works', async () => {
    expect(await dispatch(stations[0] as Station)).toBeNull();
    expect(queued).toHaveLength(0);
  });

  it('queues nothing for a harness it no longer knows', async () => {
    const station = at('station_2', 'Triage', 1, HarnessId.of('long-gone'), [
      'station_3',
    ]);

    expect(await dispatch(station)).toBeNull();
    expect(queued).toHaveLength(0);
  });

  it('gives a run the priority of the station it serves', async () => {
    await dispatch(stations[2] as Station);

    expect(queued[0]?.priority.value).toBe(2);
  });

  it('tells the runner what the agent may hand over to', async () => {
    await dispatch(stations[1] as Station);

    expect(written(queued[0])).toMatchObject({
      handover: { options: ['spec', 'review'] },
    });
  });

  it('does not offer a station nothing runs at', async () => {
    await dispatch(stations[1] as Station);

    expect(written(queued[0])).toMatchObject({
      handover: { options: expect.not.arrayContaining(['backlog']) },
    });
  });

  it('does not let the agent hand the task to its own station', async () => {
    await dispatch(stations[1] as Station);

    const spec = written(queued[0]);

    expect(spec.handover.options).not.toContain('triage');
  });

  it('runs the harness the way the harness has to be started', async () => {
    await dispatch(stations[1] as Station);

    const spec = written(queued[0]);

    expect(spec.command.executable).toBe(DEV_EXECUTABLE);
    expect(spec.command.args).toEqual([...DEV_ARGS]);
  });

  it('briefs the agent in the same words it gives the runner', async () => {
    await dispatch(stations[1] as Station);

    const spec = written(queued[0]);

    for (const option of spec.handover.options) {
      expect(spec.briefing).toContain(`"${option}"`);
    }
  });

  it('records on the run the task exactly as it was briefed', async () => {
    const station = stations[1] as Station;
    const worked = task(station.id.value, 'Drain the queue');

    await dispatch(station, worked);

    const run = queued[0] as Run;

    expect(kept[0]?.briefed?.equals(worked.briefed)).toBe(true);
    expect(kept[0]?.briefed?.title).toBe('Drain the queue');
    expect(written(run).briefing).toContain('## Drain the queue');
  });

  it('asks the runner to say where the run started', async () => {
    await dispatch(stations[1] as Station);

    expect(written(queued[0]).startingPoint).toBe(true);
  });

  describe('carrying on where the last run stopped', () => {
    const continuityOf = (at: number) => {
      const run = queued[at];
      if (!run) {
        throw new Error(`nothing was queued at ${at}`);
      }
      return written(run).continuity;
    };

    const worked = (station: Station) =>
      task(station.id.value).recordSession(
        HarnessSession.of('session_1'),
        RunnerId.of('runner_1'),
      );

    it('gives the task the same workspace run after run', async () => {
      const station = stations[1] as Station;

      await dispatch(station);
      await dispatch(station, worked(station));

      expect(continuityOf(0).key).toBe('task-task_1');
      expect(continuityOf(1).key).toBe(continuityOf(0).key);
    });

    it('gives it the same one at the next station', async () => {
      await dispatch(stations[1] as Station);
      await dispatch(stations[2] as Station);

      expect(continuityOf(0).key).toBe('task-task_1');
      expect(continuityOf(1).key).toBe(continuityOf(0).key);
    });

    it('names every skill home and harness setting, so what an earlier station left is cleared', async () => {
      await dispatch(stations[1] as Station);

      expect(written(queued[0]).skillHomes).toEqual([
        '.claude/skills',
        '.spotlight/skills',
      ]);
      expect(written(queued[0]).settingFiles).toEqual([
        'claude/settings.json',
        'codex/config.toml',
      ]);
    });

    it('asks for the conversation the task was last worked in', async () => {
      const station = stations[1] as Station;

      await dispatch(station, worked(station));

      expect(continuityOf(0).sessionId).toBe('session_1');
    });

    it('asks for no conversation when there is nothing to resume', async () => {
      const station = stations[1] as Station;

      await dispatch(station);

      expect(continuityOf(0).sessionId).toBeUndefined();
    });
  });
});

describe('DispatchTask, the skills a run is given', () => {
  const laid = () => (written(queued[0]).skills ?? []).map((each) => each.path);

  beforeEach(() => {
    queued = [];
    kept = [];
    skillsHome = { directory: '.claude/skills', readByHarness: true };
    keptSkills = [];
  });

  it('lays the handover skill where the harness reads skills, and lists none', async () => {
    await dispatch(stations[1] as Station);

    expect(laid()).toEqual(['.claude/skills/spotlight-handover/SKILL.md']);
    expect(written(queued[0]).skills?.[0]?.text).toContain(
      'name: spotlight-handover',
    );
    expect(written(queued[0]).briefing).not.toContain('## Skills');
  });

  it('lays a tool’s skill only for a station given the tool', async () => {
    await dispatch(triage({ tools: ['pull-request'] }));

    expect(laid()).toEqual([
      '.claude/skills/spotlight-handover/SKILL.md',
      '.claude/skills/spotlight-pull-request/SKILL.md',
    ]);
  });

  it('lays the skill of finding and calling tools, and briefs where they come from, where an integration’s tool is described', async () => {
    offeredTools = [
      DeclaredTool.of({
        tool: Tool.of('linear.comment'),
        description: 'Comment on the issue.',
        offeredBy: 'Linear',
      }),
    ];

    await dispatch(triage({ tools: ['linear.comment'] }));
    offeredTools = [];

    expect(laid()).toEqual([
      '.claude/skills/spotlight-handover/SKILL.md',
      '.claude/skills/spotlight-tools/SKILL.md',
    ]);
    expect(written(queued[0]).briefing).toContain(
      'You were given tools from Linear (1).',
    );
  });

  it('lays no skill of finding tools where nothing describes the integration’s tool', async () => {
    offeredTools = [];

    await dispatch(triage({ tools: ['linear.missing'] }));

    expect(laid()).toEqual(['.claude/skills/spotlight-handover/SKILL.md']);
    expect(written(queued[0]).briefing).not.toContain('## Tools');
  });

  it('lists the skills in the briefing where the harness does not read them', async () => {
    skillsHome = { directory: '.spotlight/skills', readByHarness: false };

    await dispatch(stations[1] as Station);

    expect(laid()).toEqual(['.spotlight/skills/spotlight-handover/SKILL.md']);
    expect(written(queued[0]).briefing).toContain(
      '- `.spotlight/skills/spotlight-handover/SKILL.md` — Passing a task on.',
    );
  });
});

describe('DispatchTask, the team’s own skills', () => {
  const laid = () => (written(queued[0]).skills ?? []).map((each) => each.path);
  const OURS = SkillKey.of('our-migrations');

  beforeEach(() => {
    queued = [];
    kept = [];
    skillsHome = { directory: '.claude/skills', readByHarness: true };
    offeredTools = [];
    offeredAsked = [];
    keptSkills = [
      {
        skill: {
          key: OURS.value,
          description: 'Writing a migration here.',
          tools: [],
        },
        files: [
          { path: 'SKILL.md', text: '---\nname: our-migrations\n---\n' },
          { path: 'examples/add-column.md', text: 'Add it.' },
        ],
      },
    ];
  });

  it('lays each one a station names, whole, after Spotlight’s', async () => {
    await dispatch(triage({ skills: [OURS] }));

    expect(laid()).toEqual([
      '.claude/skills/spotlight-handover/SKILL.md',
      '.claude/skills/our-migrations/SKILL.md',
      '.claude/skills/our-migrations/examples/add-column.md',
    ]);
  });

  it('gives the run the tools a skill it lays brings, and the skill of each of Spotlight’s', async () => {
    keptSkills = [
      {
        skill: {
          key: OURS.value,
          description: 'Writing a migration here.',
          tools: ['grafana.search', 'pull-request'],
        },
        files: [{ path: 'SKILL.md', text: `---\nname: ${OURS.value}\n---\n` }],
      },
    ];
    offeredTools = [
      DeclaredTool.of({
        tool: Tool.of('grafana.search'),
        description: 'Search the dashboards.',
      }),
    ];

    await dispatch(triage({ skills: [OURS] }));

    expect(toolsGiven(queued[0])).toEqual(['grafana.search', 'pull-request']);
    expect(
      (written(queued[0]).manifest ?? []).map((each) => each.name),
    ).toEqual(['grafana.search', 'pull-request']);
    expect(laid()).toEqual([
      '.claude/skills/spotlight-handover/SKILL.md',
      '.claude/skills/spotlight-pull-request/SKILL.md',
      '.claude/skills/our-migrations/SKILL.md',
      '.claude/skills/spotlight-tools/SKILL.md',
    ]);
  });

  it('leaves out one the team no longer keeps', async () => {
    keptSkills = [];

    await dispatch(triage({ skills: [OURS] }));

    expect(laid()).toEqual(['.claude/skills/spotlight-handover/SKILL.md']);
  });
});

describe('DispatchTask, the tools a run is told about', () => {
  const manifest = () => written(queued[0]).manifest ?? [];

  beforeEach(() => {
    queued = [];
    kept = [];
    offeredTools = [];
    offeredAsked = [];
  });

  it('describes Spotlight’s own tools, and what they take, without reading the team’s', async () => {
    await dispatch(triage({ tools: ['pull-request'] }));

    expect(manifest().map((each) => each.name)).toEqual(['pull-request']);
    expect(manifest()[0]?.inputs.map((each) => each.name)).toEqual([
      'title',
      'body',
      'repository',
    ]);
    expect(offeredAsked).toEqual(['pull-request']);
  });

  it('describes a tool a team’s integration offers, where the station names it', async () => {
    offeredTools = [
      DeclaredTool.of({
        tool: Tool.of('linear.comment'),
        description: 'Comment on the issue.',
        inputs: [
          {
            name: 'body',
            schema: InputSchema.ofType('string'),
            description: null,
            required: true,
            defaulted: false,
            piped: true,
          },
        ],
      }),
      DeclaredTool.of({
        tool: Tool.of('linear.close'),
        description: 'Close the issue.',
      }),
    ];

    await dispatch(triage({ tools: ['pull-request', 'linear.comment'] }));

    expect(manifest().map((each) => each.name)).toEqual([
      'pull-request',
      'linear.comment',
    ]);
    expect(manifest()[1]).toEqual({
      name: 'linear.comment',
      description: 'Comment on the issue.',
      inputs: [
        {
          name: 'body',
          schema: { type: 'string' },
          required: true,
          defaulted: false,
          piped: true,
        },
      ],
      approval: null,
    });
  });

  it('leaves out a tool nothing describes', async () => {
    await dispatch(triage({ tools: ['linear.missing'] }));

    expect(manifest()).toEqual([]);
    expect(toolsGiven(queued[0])).toEqual([]);
  });

  describe('what the team has learned', () => {
    it('briefs the run with the memories that reach its place, and records them on it', async () => {
      const station = stations[1] as Station;
      remembered = {
        briefed: [
          {
            id: 'memory_1',
            handle: 'M-12',
            kind: 'preference',
            body: 'Name branches after the ticket.',
          },
        ],
        cut: [{ id: 'memory_2', handle: 'M-13' }],
        folder: { path: '.spotlight/memory', layout: [], mirroring: null },
      };
      touchedOnTask = [
        { repository: Repository.of('acme/api'), path: 'src/uploads.ts' },
      ];

      await dispatch(station, undefined, [
        { repository: Repository.of('acme/api') },
      ] as unknown as readonly Worked[]);

      const place = briefedAt.slice(-1)[0];
      expect(place?.stationId).toBe(station.id.value);
      expect(place?.lineId).toBeTruthy();
      expect(place?.repositories.map((each) => each.value)).toContain(
        'acme/api',
      );
      expect(await place?.touched()).toEqual(touchedOnTask);
      const run = queued.slice(-1)[0];
      expect(run?.briefedWith.value).toEqual({
        briefed: [{ id: 'memory_1', handle: 'M-12' }],
        cut: [{ id: 'memory_2', handle: 'M-13' }],
      });
      expect(run?.spec.value.briefing).not.toContain('M-13');
      expect(run?.pullEvents().map((each) => each.kind)).toContain(
        'run.briefed',
      );
      expect(run?.spec.value.briefing).toContain(
        '- **M-12** · preference: Name branches after the ticket.',
      );
    });

    it('still runs, told nothing remembered, when memory cannot be read', async () => {
      const station = stations[1] as Station;
      memoryFails = true;

      await dispatch(station);

      memoryFails = false;
      const run = queued.slice(-1)[0];
      expect(run?.briefedWith.value).toEqual({ briefed: [], cut: [] });
      expect(run?.spec.value.briefing).not.toContain(
        'What the team has learned',
      );
    });
  });

  describe('the station config a run records', () => {
    const triageAt = stations[1] as Station;

    const configOf = async (
      station: Station,
      title?: string,
      repositories?: readonly Worked[],
    ) => {
      queued = [];
      kept = [];
      await dispatch(station, task(station.id.value, title), repositories);
      const config = queued[0]?.configuredAs;

      if (!config) {
        throw new Error('the run recorded no station config');
      }

      return config;
    };

    it('records the resolved values the run was configured with', async () => {
      const config = await configOf(
        triageAt
          .instruct(AgentPrompt.of('Triage carefully.'))
          .atEffort(Effort.of('high')),
        undefined,
        [
          WorkedRepository.of(Repository.of('acme/api'), {
            setup: RepositorySetup.of('npm ci'),
          }),
        ],
      );

      expect(config.parts).toMatchObject({
        prompt: 'Triage carefully.',
        harness: 'dev',
        effort: 'high',
        repositories: [{ name: 'api', setup: 'npm ci' }],
        skills: [],
      });
      expect(config.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    });

    it('gives two runs of an unchanged station the same fingerprint, whatever their tasks say', async () => {
      const first = await configOf(triageAt, 'Fix the queue');
      const second = await configOf(triageAt, 'Rename the widget');

      expect(second.fingerprint).toBe(first.fingerprint);
    });

    it('gives a new fingerprint when any part of the station changes', async () => {
      const before = await configOf(triageAt);
      const changed = [
        await configOf(triageAt.instruct(AgentPrompt.of('Be brief.'))),
        await configOf(triageAt.atEffort(Effort.of('xhigh'))),
        await configOf(triage({ tools: ['pull-request'] })),
        await configOf(triageAt, undefined, [
          WorkedRepository.of(Repository.of('acme/api'), {
            setup: RepositorySetup.of('make deps'),
          }),
        ]),
      ];

      expect(new Set(changed.map((each) => each.fingerprint)).size).toBe(4);
      expect(changed.map((each) => each.fingerprint)).not.toContain(
        before.fingerprint,
      );
    });

    it('keeps a digest of each MCP server env value, never the value', async () => {
      teamProfiles = {
        tokened: {
          key: 'tokened',
          rules: [],
          mcpServers: [
            {
              name: 'tracker',
              command: 'npx',
              args: [],
              env: { TRACKER_TOKEN: 'plain-token-value' },
            },
          ],
          native: {},
        },
      };

      const config = await configOf(
        Station.of({
          id: StationId.of('station_2'),
          key: StationKey.of('triage'),
          name: StationName.of('Triage'),
          position: 1,
          color: StationColor.of('#a3a8b0'),
          harness: DEV.id,
          profile: ProfileKey.of('tokened'),
          wayOut: WayOut.of({ stations: [StationId.of('station_3')] }),
        }),
      );

      expect(JSON.stringify(config.parts)).not.toContain('plain-token-value');
      expect(config.parts.profile?.key).toBe('tokened');
    });

    it('says what changed between two configs', async () => {
      const before = await configOf(triageAt.atEffort(Effort.of('high')));
      const after = await configOf(
        triageAt
          .atEffort(Effort.of('xhigh'))
          .instruct(AgentPrompt.of('Be brief.')),
      );

      expect(after.changesFrom(before)).toEqual([
        { part: 'prompt', name: null, kind: 'added', was: null, now: null },
        {
          part: 'effort',
          name: null,
          kind: 'changed',
          was: 'high',
          now: 'xhigh',
        },
      ]);
    });
  });
});
