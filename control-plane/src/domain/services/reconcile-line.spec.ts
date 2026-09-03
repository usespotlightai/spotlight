import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { LinePlan, type StationPlan } from '@domain/model/line-plan';
import { reconcileLine } from '@domain/services/reconcile-line';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { Happening } from '@domain/value-objects/happening.vo';
import { LineKey } from '@domain/value-objects/line-key.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import type { StationId } from '@domain/value-objects/station-id.vo';
import { StationKey } from '@domain/value-objects/station-key.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const MERGED = Happening.of('github.pull_request.merged');

const standing = () => {
  let next = 0;

  return AssemblyLine.open({
    workspaceId: WorkspaceId.of('ws_1'),
    factoryId: FactoryId.of('factory_1'),
    name: AssemblyLineName.of('Default'),
    newId: () => `id_${++next}`,
  });
};

const station = (
  key: string,
  over: Partial<StationPlan> = {},
): StationPlan => ({
  key: StationKey.of(key),
  name: StationName.of(key),
  kind: 'work',
  color: StationColor.of('#a3a8b0'),
  description: null,
  harness: null,
  agentPrompt: null,
  tools: [],
  passesTo: [],
  ends: false,
  ...over,
});

/** The same line the built-in one describes, station for station. */
const asStanding = (line: AssemblyLine): LinePlan =>
  LinePlan.of({
    key: line.key,
    name: line.name,
    stations: [...line.stations]
      .sort((one, other) => one.position - other.position)
      .map((each) =>
        station(each.key.value, { name: each.name, kind: each.kind }),
      ),
  });

/** The same plan with one thing about it changed. */
const like = (
  plan: LinePlan,
  over: Partial<Parameters<typeof LinePlan.of>[0]>,
) =>
  LinePlan.of({
    key: over.key ?? plan.key,
    name: over.name ?? plan.name,
    stations: over.stations ?? plan.stations,
    reactions: over.reactions ?? plan.reactions,
  });

const reconciling = (
  plan: LinePlan,
  line = standing(),
  tasks: Record<string, number> = {},
) => {
  let next = 100;

  return {
    line,
    result: reconcileLine({
      standing: line,
      plan,
      tasksStanding: new Map(
        line.stations.map((each) => [
          each.id.value,
          tasks[each.key.value] ?? 0,
        ]),
      ),
      newId: () => `new_${++next}`,
    }),
  };
};

describe('reconciling a line with the plan describing it', () => {
  it('keeps every station that is still described', () => {
    const { result } = reconciling(asStanding(standing()));

    expect(result.ok).toBe(true);
    expect(result.ok && result.line.stations).toHaveLength(
      standing().stations.length,
    );
  });

  // The whole point. A task stands at a station by an identifier nobody
  // writes down; editing the file must not hand it a different one.
  it('leaves a renamed station the same station it was', () => {
    const line = standing();
    const [first] = [...line.stations].sort(
      (one, other) => one.position - other.position,
    );
    const plan = asStanding(line);

    const { result } = reconciling(
      like(plan, {
        stations: plan.stations.map((each, at) =>
          at === 0 ? { ...each, name: StationName.of('Renamed') } : each,
        ),
      }),
      line,
    );

    expect(result.ok).toBe(true);
    expect(result.ok && result.line.stations[0]?.id.value).toBe(
      first?.id.value,
    );
    expect(result.ok && result.line.stations[0]?.name.value).toBe('Renamed');
  });

  it('leaves a station the same station when the line is reordered', () => {
    const line = standing();
    const plan = asStanding(line);
    const moved = [...plan.stations];
    const [taken] = moved.splice(1, 1);
    moved.splice(2, 0, taken as StationPlan);

    const { result } = reconciling(like(plan, { stations: moved }), line);

    expect(result.ok).toBe(true);

    for (const each of result.ok ? result.line.stations : []) {
      expect(each.id.value).toBe(
        line.stations.find((one) => one.key.equals(each.key))?.id.value,
      );
    }
  });

  it('gives a station nobody had before an identity of its own', () => {
    const line = standing();
    const plan = asStanding(line);

    const { result } = reconciling(
      like(plan, {
        stations: [
          ...plan.stations.slice(0, -1),
          station('handover'),
          plan.stations[plan.stations.length - 1] as StationPlan,
        ],
      }),
      line,
    );

    expect(result.ok).toBe(true);
    expect(
      result.ok &&
        result.line.stations.find((each) => each.key.value === 'handover')?.id
          .value,
    ).toMatch(/^new_/);
  });

  it('lets a station nobody stands at go quietly', () => {
    const line = standing();
    const plan = asStanding(line);

    const { result } = reconciling(
      like(plan, { stations: plan.stations.filter((_, at) => at !== 1) }),
      line,
    );

    expect(result.ok).toBe(true);
    expect(result.ok && result.line.stations).toHaveLength(
      plan.stations.length - 1,
    );
  });

  // The alternative is deciding on somebody's behalf where their work went.
  it('refuses to remove a station with tasks standing at it', () => {
    const line = standing();
    const plan = asStanding(line);
    const going = plan.stations[1]?.key.value as string;

    const { result } = reconciling(
      like(plan, { stations: plan.stations.filter((_, at) => at !== 1) }),
      line,
      { [going]: 3 },
    );

    expect(result.ok).toBe(false);
    expect(!result.ok && result.stranded).toEqual([
      expect.objectContaining({ key: going, tasks: 3 }),
    ]);
  });

  it('names every station it would have stranded, not just the first', () => {
    const line = standing();
    const plan = asStanding(line);
    const going = plan.stations.slice(1, 3).map((each) => each.key.value);

    const { result } = reconciling(
      like(plan, {
        stations: plan.stations.filter(
          (each) => !going.includes(each.key.value),
        ),
      }),
      line,
      Object.fromEntries(going.map((key) => [key, 1])),
    );

    expect(!result.ok && result.stranded.map((each) => each.key)).toEqual(
      going,
    );
  });

  // Written as keys, so they have to land on the identities just assigned.
  it('resolves where work passes to, including to a new station', () => {
    const line = standing();
    const plan = asStanding(line);
    const [first, second] = plan.stations;

    const { result } = reconciling(
      like(plan, {
        stations: plan.stations.map((each) =>
          each.key.equals((first as StationPlan).key)
            ? { ...each, passesTo: [(second as StationPlan).key] }
            : each,
        ),
      }),
      line,
    );

    expect(result.ok).toBe(true);
    expect(
      result.ok &&
        result.line.stations[0]?.wayOut.leadsTo(
          result.line.stations[1]?.id as StationId,
        ),
    ).toBe(true);
  });

  it('resolves every reaction onto the line it describes', () => {
    const line = standing();
    const plan = asStanding(line);
    const to = plan.stations[plan.stations.length - 1] as StationPlan;

    const { result } = reconciling(
      like(plan, {
        reactions: [{ happening: MERGED, from: null, to: to.key }],
      }),
      line,
    );

    expect(result.ok).toBe(true);
    expect(result.ok && result.line.reactions).toHaveLength(1);
    expect(result.ok && result.line.reactions[0]?.to.value).toBe(
      line.stations.find((each) => each.key.equals(to.key))?.id.value,
    );
  });

  it('takes the line’s own name and key from the plan', () => {
    const line = standing();

    const { result } = reconciling(
      like(asStanding(line), {
        key: LineKey.of('release'),
        name: AssemblyLineName.of('Release'),
      }),
      line,
    );

    expect(result.ok && result.line.key.value).toBe('release');
    expect(result.ok && result.line.name.value).toBe('Release');
  });
});
