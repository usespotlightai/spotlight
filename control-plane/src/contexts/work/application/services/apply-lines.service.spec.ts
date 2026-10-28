import type { TeamProfile } from '@identity/application/ports/team-directory.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import { changeActorIn } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { StationTalliesPort } from '@work/application/ports/station-tallies.port';
import { ApplyLines } from '@work/application/services/apply-lines.service';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { LineAlreadyExistsError } from '@work/domain/exceptions/line-already-exists.error';
import { LineInUseError } from '@work/domain/exceptions/line-in-use.error';
import { LineRoleTakenError } from '@work/domain/exceptions/line-role-taken.error';
import { StationNotEmptyError } from '@work/domain/exceptions/station-not-empty.error';
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

  return Line.create({
    by: changeActorIn(),
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
});

const asPlan = (existing: Line): LinePlan =>
  LinePlan.of({
    key: existing.key,
    name: existing.name,
    stations: [...existing.stations]
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

const TEAM_PROFILE: TeamProfile = {
  id: TEAM,
  workspaceId: WORKSPACE,
  key: 'platform',
  name: 'Platform',
  members: [],
};

const applying = (
  plan: LinePlan,
  over: {
    teamLines?: readonly Line[];
    tasks?: Record<string, number>;
    existing?: Line;
  } = {},
) => {
  const existing = over.existing ?? line();
  const save = vi.fn(async () => {});
  const add = vi.fn(async () => {});

  const lines = {
    ofWorkspace: vi.fn(async () => over.teamLines ?? [existing]),
    ofTeam: vi.fn(async () => over.teamLines ?? [existing]),
    save,
    add,
    find: vi.fn(),
    findByStation: vi.fn(),
  } as unknown as LineRepository;

  const tally = async (stationIds: readonly { value: string }[]) =>
    new Map(
      stationIds.map((stationId) => [
        stationId.value,
        over.tasks?.[
          existing.stations.find((each) => each.id.value === stationId.value)
            ?.key.value ?? ''
        ] ?? 0,
      ]),
    );

  const tallies = {
    taskCountsAt: vi.fn(tally),
    lockedTaskCountsAt: vi.fn(tally),
  } satisfies StationTalliesPort;

  let next = 100;
  const ids = {
    generate: () => `new_${++next}`,
  } as unknown as IdGeneratorPort;

  const applier = new ApplyLines(lines, tallies, ids);

  return {
    applied: (): Promise<Line> =>
      plan.key.equals(existing.key)
        ? applier.reconcile(existing, plan, changeActorIn())
        : applier.create(TEAM_PROFILE, plan, changeActorIn()),
    save,
    add,
    existing,
    tallies,
  };
};

describe('ApplyLines', () => {
  it('makes the line say what its definition says', async () => {
    const existing = line();
    const { applied, save } = applying(
      like(asPlan(existing), { name: LineName.of('Renamed') }),
      { existing },
    );

    await applied();

    expect(save).toHaveBeenCalledTimes(1);

    const [written] = save.mock.calls[0] as never as [Line];

    expect(written.name.value).toBe('Renamed');
  });

  it('hands back the line as it applied it', async () => {
    const existing = line();
    const { applied } = applying(
      like(asPlan(existing), { name: LineName.of('Renamed') }),
      { existing },
    );

    const reconciled = await applied();

    expect([reconciled.id, reconciled.name.value]).toEqual([
      existing.id,
      'Renamed',
    ]);
  });

  it('leaves every station the station it was', async () => {
    const existing = line();
    const { applied, save } = applying(asPlan(existing), { existing });

    await applied();

    const [written] = save.mock.calls[0] as never as [Line];

    for (const each of written.stations) {
      expect(each.id.value).toBe(
        existing.stations.find((one) => one.key.equals(each.key))?.id.value,
      );
    }
  });

  it('changes nothing where the plan would strand somebody’s work', async () => {
    const existing = line();
    const plan = asPlan(existing);
    const going = plan.stations[1]?.key.value as string;

    const { applied, save } = applying(
      like(plan, { stations: plan.stations.filter((_, at) => at !== 1) }),
      { existing, tasks: { [going]: 2 } },
    );

    await expect(applied()).rejects.toThrow(LineInUseError);
    await expect(applied()).rejects.toThrow(/\(2\)/);
    expect(save).not.toHaveBeenCalled();
  });

  it('locks the stations it tallies until the change is written', async () => {
    const existing = line();
    const { applied, tallies } = applying(asPlan(existing), { existing });

    await applied();

    expect(tallies.lockedTaskCountsAt).toHaveBeenCalledTimes(1);
    expect(tallies.taskCountsAt).not.toHaveBeenCalled();
  });

  it('rejects a change that would strand work that arrived after the tally', async () => {
    const existing = line();
    const { applied, save } = applying(asPlan(existing), { existing });

    save.mockRejectedValueOnce(new StationNotEmptyError(['station_2']));

    await expect(applied()).rejects.toThrow(
      /cannot drop stations that still have tasks/,
    );
  });

  it('creates a line the team does not have from its definition', async () => {
    const existing = line();
    const { applied, add, save } = applying(
      like(asPlan(existing), { key: LineKey.of('release') }),
      { existing },
    );

    await applied();

    expect(save).not.toHaveBeenCalled();
    expect(add).toHaveBeenCalledTimes(1);

    const [created] = add.mock.calls[0] as never as [Line];

    expect(created.key).toEqual(LineKey.of('release'));
    expect(created.teamId).toEqual(existing.teamId);
  });

  it('creates no line under a key the team already has', async () => {
    const existing = line();
    const { add } = applying(asPlan(existing), { existing });
    const applier = new ApplyLines(
      {
        ofTeam: vi.fn(async () => [existing]),
        add,
      } as unknown as LineRepository,
      {} as StationTalliesPort,
      { generate: () => 'new' },
    );

    await expect(
      applier.create(TEAM_PROFILE, asPlan(existing), changeActorIn()),
    ).rejects.toThrow(LineAlreadyExistsError);
    expect(add).not.toHaveBeenCalled();
  });

  it('creates no line that claims a role another line already has', async () => {
    const existing = line();
    const base = asPlan(existing);
    const claiming = like(base, {
      key: LineKey.of('one'),
      role: LineRole.REVIEW,
    });
    const withRole = applying(like(base, { role: LineRole.REVIEW }), {
      existing,
    });
    const reviewLine = await withRole.applied();
    const { applied, add } = applying(
      like(claiming, { key: LineKey.of('two') }),
      { existing, teamLines: [reviewLine] },
    );

    await expect(applied()).rejects.toThrow(LineRoleTakenError);
    await expect(applied()).rejects.toThrow(/cannot take role review/);
    expect(add).not.toHaveBeenCalled();
  });

  it('lets a line keep the role it already claims', async () => {
    const existing = line();
    const withRole = applying(
      like(asPlan(existing), { role: LineRole.REVIEW }),
      { existing },
    );
    const reviewLine = await withRole.applied();
    const { applied, save } = applying(
      like(asPlan(reviewLine), { role: LineRole.REVIEW }),
      { existing: reviewLine, teamLines: [reviewLine] },
    );

    await applied();

    expect(save).toHaveBeenCalledTimes(1);
  });

  it('gives a station nobody had before an identity of its own', async () => {
    const existing = line();
    const plan = asPlan(existing);

    const { applied, save } = applying(
      like(plan, {
        stations: [
          ...plan.stations.slice(0, -1),
          station('handover'),
          plan.stations[plan.stations.length - 1] as StationPlan,
        ],
      }),
      { existing },
    );

    await applied();

    const [written] = save.mock.calls[0] as never as [Line];

    expect(
      written.stations.find((each) => each.key.value === 'handover')?.id.value,
    ).toMatch(/^new_/);
  });
});
