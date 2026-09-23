import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { LineConfigReaderPort } from '@work/application/ports/line-config-reader.port';
import type { StationTalliesPort } from '@work/application/ports/station-tallies.port';
import { ApplyLines } from '@work/application/services/apply-lines.service';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { StrandedWorkError } from '@work/domain/exceptions/stranded-work.error';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import {
  BUILT_IN_LINES,
  type LineOpening,
} from '@work/domain/services/built-in-lines';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import {
  LinePlan,
  type StationPlan,
} from '@work/domain/value-objects/line-plan.vo';
import { LineRole } from '@work/domain/value-objects/line-role.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const TEAM = TeamId.of('team_1');

const line = () => {
  let next = 0;

  return Line.open({
    workspaceId: WORKSPACE,
    teamId: TeamId.of('team_1'),
    line: BUILT_IN_LINES[0] as LineOpening,
    newId: () => `id_${++next}`,
  });
};

const station = (key: string): StationPlan => ({
  key: StationKey.of(key),
  name: StationName.of(key),
  kind: 'work',
  color: StationColor.of('#a3a8b0'),
  description: null,
  harness: null,
  model: null,
  effort: null,
  agentPrompt: null,
  check: null,
  setup: null,
  diffs: false,
  decisions: false,
  tools: [],
  skills: [],
  passesTo: [],
  ends: false,
});

const asStanding = (held: Line): LinePlan =>
  LinePlan.of({
    key: held.key,
    name: held.name,
    stations: [...held.stations]
      .sort((one, other) => one.position - other.position)
      .map((each) => ({
        ...station(each.key.value),
        name: each.name,
        kind: each.kind,
      })),
  });

const like = (
  plan: LinePlan,
  over: Partial<Parameters<typeof LinePlan.of>[0]>,
) =>
  LinePlan.of({
    key: over.key ?? plan.key,
    name: over.name ?? plan.name,
    stations: over.stations ?? plan.stations,
    reactions: over.reactions ?? plan.reactions,
    role: over.role ?? plan.role,
  });

const applying = (
  plans: readonly LinePlan[],
  over: {
    standing?: readonly Line[];
    problems?: readonly { path: string; at: string; reason: string }[];
    tasks?: Record<string, number>;
    held?: Line;
  } = {},
) => {
  const held = over.held ?? line();
  const save = vi.fn(async () => {});
  const add = vi.fn(async () => {});

  const lines = {
    ofWorkspace: vi.fn(async () => over.standing ?? [held]),
    ofTeam: vi.fn(async () => over.standing ?? [held]),
    withRole: vi.fn(async () => null),
    save,
    add,
    find: vi.fn(),
    holding: vi.fn(),
  } as unknown as LineRepository;

  const teams = {
    find: vi.fn(async () => ({
      id: TEAM,
      workspaceId: WORKSPACE,
      name: 'Platform',
      members: [],
    })),
    inWorkspace: vi.fn(async () => []),
  } satisfies TeamDirectoryPort;

  const tally = async (stationIds: readonly { value: string }[]) =>
    new Map(
      stationIds.map((stationId) => [
        stationId.value,
        over.tasks?.[
          held.stations.find((each) => each.id.value === stationId.value)?.key
            .value ?? ''
        ] ?? 0,
      ]),
    );

  const tallies = {
    standingAt: vi.fn(tally),
    lockedStandingAt: vi.fn(tally),
  } satisfies StationTalliesPort;

  const reader = {
    read: () => ({ plans, problems: over.problems ?? [] }),
    definedAt: (line: LineKey) => `.spotlight/lines/${line.value}/line.yml`,
  } as unknown as LineConfigReaderPort;

  let next = 100;
  const ids = {
    generate: () => `new_${++next}`,
  } as unknown as IdGeneratorPort;

  return {
    apply: new ApplyLines(lines, teams, tallies, reader, ids, {
      run: (work) => work(),
    } satisfies TransactionPort),
    save,
    add,
    held,
    tallies,
  };
};

describe('ApplyLines', () => {
  it('makes the line say what the file says', async () => {
    const held = line();
    const { apply, save } = applying(
      [like(asStanding(held), { name: LineName.of('Renamed') })],
      { held },
    );

    expect((await apply.apply(TEAM, [])).problems).toEqual([]);
    expect(save).toHaveBeenCalledTimes(1);

    const [written] = save.mock.calls[0] as never as [Line];

    expect(written.name.value).toBe('Renamed');
  });

  it('leaves every station the station it was', async () => {
    const held = line();
    const { apply, save } = applying([asStanding(held)], { held });

    await apply.apply(TEAM, []);

    const [written] = save.mock.calls[0] as never as [Line];

    for (const each of written.stations) {
      expect(each.id.value).toBe(
        held.stations.find((one) => one.key.equals(each.key))?.id.value,
      );
    }
  });

  it('changes nothing where the plan would strand somebody’s work', async () => {
    const held = line();
    const plan = asStanding(held);
    const going = plan.stations[1]?.key.value as string;

    const { apply, save } = applying(
      [like(plan, { stations: plan.stations.filter((_, at) => at !== 1) })],
      { held, tasks: { [going]: 2 } },
    );

    const { problems } = await apply.apply(TEAM, []);

    expect(save).not.toHaveBeenCalled();
    expect(problems).toHaveLength(1);
    expect(problems[0]?.reason).toMatch(/2 standing there/);
    expect(problems[0]?.path).toBe('.spotlight/lines/delivery/line.yml');
  });

  it('holds the stations it tallies until the change is written', async () => {
    const held = line();
    const { apply, tallies } = applying([asStanding(held)], { held });

    await apply.apply(TEAM, []);

    expect(tallies.lockedStandingAt).toHaveBeenCalledTimes(1);
    expect(tallies.standingAt).not.toHaveBeenCalled();
  });

  it('refuses a change that would strand work that arrived after the tally', async () => {
    const held = line();
    const { apply, save } = applying([asStanding(held)], { held });

    save.mockRejectedValueOnce(new StrandedWorkError(['station_2']));

    const { problems } = await apply.apply(TEAM, []);

    expect(problems).toHaveLength(1);
    expect(problems[0]?.reason).toMatch(/cannot drop them/);
  });

  it('plans without writing, and says what applying would strand', async () => {
    const held = line();
    const plan = asStanding(held);
    const going = plan.stations[1]?.key.value as string;

    const { apply, save, add } = applying(
      [like(plan, { stations: plan.stations.filter((_, at) => at !== 1) })],
      { held, tasks: { [going]: 2 } },
    );

    const { problems } = await apply.plan(TEAM, []);

    expect(save).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
    expect(problems[0]?.reason).toMatch(/2 standing there/);
  });

  it('opens a line the workspace does not have from its file', async () => {
    const held = line();
    const { apply, add, save } = applying(
      [like(asStanding(held), { key: LineKey.of('release') })],
      { held },
    );

    expect((await apply.apply(TEAM, [])).problems).toEqual([]);
    expect(save).not.toHaveBeenCalled();
    expect(add).toHaveBeenCalledTimes(1);

    const [opened] = add.mock.calls[0] as never as [Line];

    expect(opened.key).toEqual(LineKey.of('release'));
    expect(opened.teamId).toEqual(held.teamId);
  });

  it('opens neither of two lines that claim the same role', async () => {
    const held = line();
    const base = asStanding(held);

    const { apply, add } = applying(
      [
        like(base, { key: LineKey.of('one'), role: LineRole.IMPROVEMENT }),
        like(base, { key: LineKey.of('two'), role: LineRole.IMPROVEMENT }),
      ],
      { held },
    );

    const { problems } = await apply.apply(TEAM, []);

    expect(add).not.toHaveBeenCalled();
    expect(problems.map((each) => each.path).sort()).toEqual([
      '.spotlight/lines/one/line.yml',
      '.spotlight/lines/two/line.yml',
    ]);
    expect(problems[0]?.reason).toMatch(/role "improvement"/);
  });

  it('leaves a line no file mentions alone', async () => {
    const held = line();
    const { apply, save } = applying([], { held });

    expect((await apply.apply(TEAM, [])).problems).toEqual([]);
    expect(save).not.toHaveBeenCalled();
  });

  it('carries through what the reader could not read', async () => {
    const held = line();
    const broken = {
      path: '.spotlight/lines/broken/line.yml',
      at: 'the file',
      reason: 'is not YAML',
    };

    const { apply } = applying([], { held, problems: [broken] });

    expect((await apply.apply(TEAM, [])).problems).toEqual([broken]);
  });

  it('gives a station nobody had before an identity of its own', async () => {
    const held = line();
    const plan = asStanding(held);

    const { apply, save } = applying(
      [
        like(plan, {
          stations: [
            ...plan.stations.slice(0, -1),
            station('handover'),
            plan.stations[plan.stations.length - 1] as StationPlan,
          ],
        }),
      ],
      { held },
    );

    await apply.apply(TEAM, []);

    const [written] = save.mock.calls[0] as never as [Line];

    expect(
      written.stations.find((each) => each.key.value === 'handover')?.id.value,
    ).toMatch(/^new_/);
  });
});
