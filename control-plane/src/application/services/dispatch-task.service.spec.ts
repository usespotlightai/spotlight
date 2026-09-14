import {
  RunSpecContract,
  type RunSpecShape,
} from '@application/contracts/run-spec.contract';
import type { BuiltInSkillsPort } from '@application/ports/built-in-skills.port';
import type {
  HarnessLaunchPort,
  SkillsHome,
} from '@application/ports/harness-launch.port';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { SkillFolder } from '@application/ports/skill-reader.port';
import { DispatchTask } from '@application/services/dispatch-task.service';
import type { TeamIntegrations } from '@application/services/team-integrations.service';
import type { TeamSkills } from '@application/services/team-skills.service';
import { Line } from '@domain/aggregates/line.aggregate';
import type { Run } from '@domain/aggregates/run.aggregate';
import { Task } from '@domain/aggregates/task.aggregate';
import { DeclaredTool } from '@domain/entities/declared-tool.entity';
import { Harness } from '@domain/entities/harness.entity';
import { Skill } from '@domain/entities/skill.entity';
import { Station } from '@domain/entities/station.entity';
import type { HarnessRepository } from '@domain/repositories/harness.repository';
import type { RunRepository } from '@domain/repositories/run.repository';
import {
  HANDING_OVER,
  OPENING_PULL_REQUESTS,
} from '@domain/services/built-in-skills';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { HarnessCommand } from '@domain/value-objects/harness-command.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { HarnessName } from '@domain/value-objects/harness-name.vo';
import { HarnessSession } from '@domain/value-objects/harness-session.vo';
import { LineId } from '@domain/value-objects/line-id.vo';
import { LineKey } from '@domain/value-objects/line-key.vo';
import { LineName } from '@domain/value-objects/line-name.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { RunnerId } from '@domain/value-objects/runner-id.vo';
import { SkillKey } from '@domain/value-objects/skill-key.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationKey } from '@domain/value-objects/station-key.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TaskRank } from '@domain/value-objects/task-rank.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';
import { Tool } from '@domain/value-objects/tool.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WayOut } from '@domain/value-objects/way-out.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { beforeEach, describe, expect, it } from 'vitest';

const NOW = new Date('2026-08-28T12:00:00.000Z');

const written = (run?: Run): RunSpecShape =>
  RunSpecContract.from(run?.spec.value) as RunSpecShape;

const DEV = Harness.of({
  id: HarnessId.of('dev'),
  name: HarnessName.of('Dev'),
});

const DEV_EXECUTABLE = 'dev-agent';
const DEV_ARGS = ['--acp'];

const harnesses: HarnessRepository = {
  all: () => [DEV],
  named: (id: HarnessId) => (id.equals(DEV.id) ? DEV : null),
};

let skillsHome: SkillsHome = {
  directory: '.claude/skills',
  readByHarness: true,
};

const launch: HarnessLaunchPort = {
  skillsFor: () => skillsHome,
  commandFor: (id, chosen) =>
    id.equals(DEV.id)
      ? HarnessCommand.of({
          executable: DEV_EXECUTABLE,
          args: DEV_ARGS,
          env: chosen.model ? { DEV_MODEL: chosen.model.value } : {},
        })
      : null,
  catalogue: () => [],
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

const task = (stationId: string) =>
  Task.add({
    workspaceId: WorkspaceId.of('ws_1'),
    stationId: StationId.of(stationId),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    raisedBy: UserId.of('user_1'),
    now: NOW,
    newId: () => 'task_1',
  });

let queued: Run[] = [];

const runs = {
  add: async (run: Run) => {
    queued.push(run);
  },
} as unknown as RunRepository;

const ids: IdGeneratorPort = { generate: () => 'run_1' };

const held = (changed?: Station, repositories: string[] = []) =>
  Line.of({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    factoryId: FactoryId.of('factory_1'),
    key: LineKey.of('default'),
    name: LineName.of('Default'),
    repositories: repositories.map((each) => Repository.of(each)),
    stations: changed
      ? stations.map((each) => (each.equals(changed) ? changed : each))
      : stations,
  });

const SHIPPED_SKILLS: SkillFolder[] = [
  {
    skill: Skill.shipped({
      key: HANDING_OVER,
      description: 'Handing a task on.',
      instructions: 'Run spotlight handover.',
    }),
    files: [
      { path: 'SKILL.md', text: `---\nname: ${HANDING_OVER.value}\n---\n` },
    ],
  },
  {
    skill: Skill.shipped({
      key: OPENING_PULL_REQUESTS,
      description: 'Opening a pull request.',
      instructions: 'Run spotlight pull-request.',
    }),
    files: [
      {
        path: 'SKILL.md',
        text: `---\nname: ${OPENING_PULL_REQUESTS.value}\n---\n`,
      },
    ],
  },
];

const SHIPPED: BuiltInSkillsPort = {
  named: (key) =>
    SHIPPED_SKILLS.find((each) => each.skill.key.equals(key)) ?? null,
};

let offeredTools: DeclaredTool[] = [];
let offeredAsked = 0;

const integrations = {
  offered: async () => {
    offeredAsked += 1;
    return offeredTools;
  },
} as unknown as TeamIntegrations;

let keptSkills: SkillFolder[] = [];

const teamSkills = {
  readyAt: async (_line: Line, station: Station) =>
    keptSkills.filter((each) =>
      station.skills.some((key) => key.equals(each.skill.key)),
    ),
} as unknown as TeamSkills;

const toolsGiven = (run?: Run) => RunSpecContract.toolsGiven(run?.spec.value);

const tracing = {
  for: (taskId: { value: string }, runId: { value: string }) =>
    `trace:${taskId.value}:${runId.value}`,
};

const dispatch = (station: Station, standing?: Task, repositories?: string[]) =>
  new DispatchTask(
    runs,
    ids,
    harnesses,
    launch,
    tracing,
    SHIPPED,
    teamSkills,
    integrations,
  ).dispatch({
    task: standing ?? task(station.id.value),
    line: held(station, repositories),
  });

describe('DispatchTask', () => {
  beforeEach(() => {
    queued = [];
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

    it('asks for no checkout where the line works no repository', async () => {
      await dispatch(stations[1] as Station);

      expect(written(queued[0]).checkouts).toEqual([]);
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

  it('gives a run the standing of the station it serves', async () => {
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

  describe('carrying on where the last run stopped', () => {
    const continuityOf = (at: number) => {
      const run = queued[at];
      if (!run) {
        throw new Error(`nothing was queued at ${at}`);
      }
      return written(run).continuity;
    };

    const worked = (station: Station) =>
      task(station.id.value).workedIn(
        HarnessSession.of('session_1'),
        RunnerId.of('runner_1'),
      );

    it('gives the task the same directory for as long as it stands here', async () => {
      const station = stations[1] as Station;

      await dispatch(station);
      await dispatch(station, worked(station));

      expect(continuityOf(0).key).toBe('task_1-station_2');
      expect(continuityOf(1).key).toBe(continuityOf(0).key);
    });

    it('gives it a different one at the next station', async () => {
      await dispatch(stations[1] as Station);
      await dispatch(stations[2] as Station);

      expect(continuityOf(0).key).toBe('task_1-station_2');
      expect(continuityOf(1).key).toBe('task_1-station_3');
    });

    it('keeps the directory, since the conversation lives in it', async () => {
      await dispatch(stations[1] as Station);

      expect(continuityOf(0).keep).toBe(true);
    });

    it('asks for the conversation the task was last worked in', async () => {
      const station = stations[1] as Station;

      await dispatch(station, worked(station));

      expect(continuityOf(0).sessionId).toBe('session_1');
    });

    it('goes back to the runner holding it', async () => {
      const station = stations[1] as Station;

      await dispatch(station, worked(station));

      expect(queued[0]?.targetRunner?.value).toBe('runner_1');
    });

    it('is free to be worked anywhere when there is nothing to resume', async () => {
      const station = stations[1] as Station;

      await dispatch(station);

      expect(queued[0]?.targetRunner).toBeNull();
      expect(continuityOf(0).sessionId).toBeUndefined();
    });
  });
});

describe('DispatchTask, the skills a run is given', () => {
  const laid = () => (written(queued[0]).skills ?? []).map((each) => each.path);

  beforeEach(() => {
    queued = [];
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

  it('lists the skills in the briefing where the harness does not read them', async () => {
    skillsHome = { directory: '.spotlight/skills', readByHarness: false };

    await dispatch(stations[1] as Station);

    expect(laid()).toEqual(['.spotlight/skills/spotlight-handover/SKILL.md']);
    expect(written(queued[0]).briefing).toContain(
      '- `.spotlight/skills/spotlight-handover/SKILL.md` — Handing a task on.',
    );
  });
});

describe('DispatchTask, the team’s own skills', () => {
  const laid = () => (written(queued[0]).skills ?? []).map((each) => each.path);
  const OURS = SkillKey.of('our-migrations');

  beforeEach(() => {
    queued = [];
    skillsHome = { directory: '.claude/skills', readByHarness: true };
    offeredTools = [];
    offeredAsked = 0;
    keptSkills = [
      {
        skill: Skill.defined({
          key: OURS,
          description: 'Writing a migration here.',
          instructions: 'Generate it.',
        }),
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
        skill: Skill.defined({
          key: OURS,
          description: 'Writing a migration here.',
          instructions: 'Generate it, then open a pull request.',
          tools: [Tool.of('grafana.search'), Tool.of('pull-request')],
        }),
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
    offeredTools = [];
    offeredAsked = 0;
  });

  it('describes Spotlight’s own tools, and what they take, without reading the team’s', async () => {
    await dispatch(triage({ tools: ['pull-request'] }));

    expect(manifest().map((each) => each.name)).toEqual(['pull-request']);
    expect(manifest()[0]?.inputs.map((each) => each.name)).toEqual([
      'title',
      'body',
      'repository',
    ]);
    expect(offeredAsked).toBe(0);
  });

  it('describes a tool a team’s integration offers, where the station names it', async () => {
    offeredTools = [
      DeclaredTool.of({
        tool: Tool.of('linear.comment'),
        description: 'Comment on the issue.',
        inputs: [
          {
            name: 'body',
            type: 'string',
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
          type: 'string',
          required: true,
          defaulted: false,
          piped: true,
        },
      ],
    });
  });

  it('leaves out a tool nothing describes', async () => {
    await dispatch(triage({ tools: ['linear.missing'] }));

    expect(manifest()).toEqual([]);
    expect(toolsGiven(queued[0])).toEqual([]);
  });
});
