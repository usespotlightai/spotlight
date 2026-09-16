import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { LineConfigReaderPort } from '@application/ports/line-config-reader.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import { ApplyLines } from '@application/services/apply-lines.service';
import { Factory } from '@domain/aggregates/factory.aggregate';
import { Line } from '@domain/aggregates/line.aggregate';
import type { FactoryRepository } from '@domain/repositories/factory.repository';
import type { LineRepository } from '@domain/repositories/line.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import {
  BUILT_IN_LINES,
  type LineOpening,
} from '@domain/services/built-in-lines';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { LineKey } from '@domain/value-objects/line-key.vo';
import { LineName } from '@domain/value-objects/line-name.vo';
import { LinePlan, type StationPlan } from '@domain/value-objects/line-plan.vo';
import { LineRole } from '@domain/value-objects/line-role.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationKey } from '@domain/value-objects/station-key.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const TEAM = TeamId.of('team_1');

const line = () => {
  let next = 0;

  return Line.open({
    workspaceId: WORKSPACE,
    factoryId: FactoryId.of('factory_1'),
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

  const factories = {
    add: vi.fn(),
    ofTeam: vi.fn(async () =>
      Factory.of({
        id: FactoryId.of('factory_1'),
        workspaceId: WORKSPACE,
        teamId: TEAM,
      }),
    ),
    find: vi.fn(async () => null),
  } satisfies FactoryRepository;

  const tasks = {
    countsAt: vi.fn(
      async (stationIds: readonly { value: string }[]) =>
        new Map(
          stationIds.map((stationId) => [
            stationId.value,
            over.tasks?.[
              held.stations.find((each) => each.id.value === stationId.value)
                ?.key.value ?? ''
            ] ?? 0,
          ]),
        ),
    ),
  } as unknown as TaskRepository;

  const reader = {
    read: () => ({ plans, problems: over.problems ?? [] }),
    write: () => ({ path: '', text: '' }),
  } as unknown as LineConfigReaderPort;

  let next = 100;
  const ids = {
    generate: () => `new_${++next}`,
  } as unknown as IdGeneratorPort;

  return {
    apply: new ApplyLines(lines, factories, tasks, reader, ids, {
      run: (work) => work(),
    } satisfies TransactionPort),
    save,
    add,
    held,
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
    expect(opened.factoryId).toEqual(held.factoryId);
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
