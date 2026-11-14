import { Line } from '@lines/domain/aggregates/line.aggregate';
import { LineInUseError } from '@lines/domain/exceptions/line-in-use.error';
import { BUILT_IN_LINES } from '@lines/domain/services/built-in-lines';
import { reconcileLine } from '@lines/domain/services/reconcile-line';
import { DefaultAssignee } from '@lines/domain/value-objects/default-assignee.vo';
import {
  LinePlan,
  type StationPlan,
} from '@lines/domain/value-objects/line-plan.vo';
import { LineSearchPolicy } from '@lines/domain/value-objects/search-policy.vo';
import { StationColor } from '@lines/domain/value-objects/station-color.vo';
import {
  type StrandedStation,
  TaskCounts,
} from '@lines/domain/value-objects/stranded-station';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { changeActorIn } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { Happening } from '@shared-kernel/domain/value-objects/happening.vo';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const MERGED = Happening.of('github.pull_request.merged');

const existingLine = () => {
  let next = 0;

  return Line.create({
    by: changeActorIn(),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    line: BUILT_IN_LINES[0],
    harness: HarnessId.of('dev'),
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
  model: null,
  effort: null,
  profile: null,
  agentPrompt: null,
  check: null,
  placement: RunnerPlacement.anywhere(),
  diffs: false,
  decisions: false,
  memories: false,
  judge: null,
  alerts: [],
  search: null,
  tools: [],
  skills: [],
  passesTo: [],
  ends: false,
  ...over,
});

const asPlan = (line: Line): LinePlan =>
  LinePlan.of({
    key: line.key,
    name: line.name,
    stations: [...line.stations]
      .sort((one, other) => one.position - other.position)
      .map((each) =>
        station(each.key.value, { name: each.name, kind: each.kind }),
      ),
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
    search: over.search === undefined ? plan.search : over.search,
  });

const outcomeOf = (
  reconcile: () => Line,
):
  | { readonly ok: true; readonly line: Line }
  | { readonly ok: false; readonly stranded: readonly StrandedStation[] } => {
  try {
    return { ok: true, line: reconcile() };
  } catch (error) {
    if (error instanceof LineInUseError) {
      return { ok: false, stranded: error.stranded };
    }
    throw error;
  }
};

const reconciling = (
  plan: LinePlan,
  line = existingLine(),
  tasks: Record<string, number> = {},
) => {
  let next = 100;

  return {
    line,
    result: outcomeOf(() =>
      reconcileLine({
        by: changeActorIn(),
        existing: line,
        plan,
        taskCounts: TaskCounts.of(
          line.stations.map((each) => ({
            stationId: each.id,
            tasks: tasks[each.key.value] ?? 0,
          })),
        ),
        newId: () => `new_${++next}`,
      }),
    ),
  };
};

describe('reconciling a line with the plan describing it', () => {
  it('takes the default assignee the plan names, and drops it where the plan names none', () => {
    const plan = asPlan(existingLine());
    const named = reconciling(
      LinePlan.of({
        key: plan.key,
        name: plan.name,
        stations: plan.stations,
        defaultAssignee: DefaultAssignee.of('ada@example.com'),
      }),
    ).result;

    expect(named.ok && named.line.defaultAssignee?.email).toBe(
      'ada@example.com',
    );

    const dropped = named.ok && reconciling(plan, named.line).result;

    expect(dropped && dropped.ok && dropped.line.defaultAssignee).toBeNull();
  });

  it('keeps every station that is still described', () => {
    const { result } = reconciling(asPlan(existingLine()));

    expect(result.ok).toBe(true);
    expect(result.ok && result.line.stations).toHaveLength(
      existingLine().stations.length,
    );
  });

  it('leaves a renamed station the same station it was', () => {
    const line = existingLine();
    const [first] = [...line.stations].sort(
      (one, other) => one.position - other.position,
    );
    const plan = asPlan(line);

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
    const line = existingLine();
    const plan = asPlan(line);
    const moved = [...plan.stations];
    const [taken] = moved.splice(1, 1);
    moved.splice(2, 0, taken);

    const { result } = reconciling(like(plan, { stations: moved }), line);

    expect(result.ok).toBe(true);

    for (const each of result.ok ? result.line.stations : []) {
      expect(each.id.value).toBe(
        line.stations.find((one) => one.key.equals(each.key))?.id.value,
      );
    }
  });

  it('gives a station nobody had before an identity of its own', () => {
    const line = existingLine();
    const plan = asPlan(line);

    const { result } = reconciling(
      like(plan, {
        stations: [
          ...plan.stations.slice(0, -1),
          station('handover'),
          plan.stations[plan.stations.length - 1],
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

  it('lets a station with no tasks go quietly', () => {
    const line = existingLine();
    const plan = asPlan(line);

    const { result } = reconciling(
      like(plan, { stations: plan.stations.filter((_, at) => at !== 1) }),
      line,
    );

    expect(result.ok).toBe(true);
    expect(result.ok && result.line.stations).toHaveLength(
      plan.stations.length - 1,
    );
  });

  it('does not remove a station with tasks at it', () => {
    const line = existingLine();
    const plan = asPlan(line);
    const going = plan.stations[1]?.key.value;

    const { result } = reconciling(
      like(plan, { stations: plan.stations.filter((_, at) => at !== 1) }),
      line,
      { [going]: 3 },
    );

    expect(result.ok).toBe(false);
    expect(!result.ok && result.stranded).toEqual([
      expect.objectContaining({ key: StationKey.of(going), tasks: 3 }),
    ]);
  });

  it('names every station it would have stranded, not just the first', () => {
    const line = existingLine();
    const plan = asPlan(line);
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

    expect(!result.ok && result.stranded.map((each) => each.key.value)).toEqual(
      going,
    );
  });

  it('resolves where work passes to, including to a new station', () => {
    const line = existingLine();
    const plan = asPlan(line);
    const [first, second] = plan.stations;

    const { result } = reconciling(
      like(plan, {
        stations: plan.stations.map((each) =>
          each.key.equals(first.key)
            ? { ...each, passesTo: [second.key] }
            : each,
        ),
      }),
      line,
    );

    expect(result.ok).toBe(true);
    expect(
      result.ok &&
        result.line.stations[0]?.routes.stations.some((each) =>
          each.equals(result.line.stations[1]?.id),
        ),
    ).toBe(true);
  });

  it('resolves every reaction onto the line it describes', () => {
    const line = existingLine();
    const plan = asPlan(line);
    const to = plan.stations[plan.stations.length - 1];

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

  it('takes the line’s own name from the plan', () => {
    const line = existingLine();

    const { result } = reconciling(
      like(asPlan(line), { name: LineName.of('Release') }),
      line,
    );

    expect(result.ok && result.line.key.value).toBe(line.key.value);
    expect(result.ok && result.line.name.value).toBe('Release');
  });

  it('keeps the line’s key, which a plan cannot change', () => {
    const line = existingLine();

    expect(() =>
      reconciling(like(asPlan(line), { key: LineKey.of('release') }), line),
    ).toThrow(ImmutableFieldError);
  });
});

describe('reconciling a line’s search policy', () => {
  it('keeps the search policy the plan sets, and restores the default once the plan leaves it out', () => {
    const plan = asPlan(existingLine());
    const tuned = reconciling(
      like(plan, { search: LineSearchPolicy.of({ monthlyCeiling: 80 }) }),
    ).result;

    expect(tuned.ok && tuned.line.search?.monthlyCeiling.amount).toBe(80);

    const restored = tuned.ok ? reconciling(plan, tuned.line).result : tuned;

    expect(restored.ok && restored.line.search).toBeNull();
    expect(restored.ok && restored.line.searchPolicy).toBe(
      LineSearchPolicy.DEFAULT,
    );
  });
});
