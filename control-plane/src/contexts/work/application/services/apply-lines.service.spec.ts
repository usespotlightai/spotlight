import type { TeamProfile } from '@identity/application/ports/team-directory.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { StationTalliesPort } from '@work/application/ports/station-tallies.port';
import { ApplyLines } from '@work/application/services/apply-lines.service';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { LineAlreadyOpenedError } from '@work/domain/exceptions/line-already-opened.error';
import { LineInUseError } from '@work/domain/exceptions/line-in-use.error';
import { LineRoleTakenError } from '@work/domain/exceptions/line-role-taken.error';
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
    by: attributedIn(),
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
    standing?: readonly Line[];
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
    save,
    add,
    find: vi.fn(),
    holding: vi.fn(),
  } as unknown as LineRepository;

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

  let next = 100;
  const ids = {
    generate: () => `new_${++next}`,
  } as unknown as IdGeneratorPort;

  const applier = new ApplyLines(lines, tallies, ids);

  return {
    applied: (): Promise<Line> =>
      plan.key.equals(held.key)
        ? applier.reconcile(held, plan, attributedIn())
        : applier.open(TEAM_PROFILE, plan, attributedIn()),
    save,
    add,
    held,
    tallies,
  };
};

describe('ApplyLines', () => {
  it('makes the line say what its definition says', async () => {
    const held = line();
    const { applied, save } = applying(
      like(asStanding(held), { name: LineName.of('Renamed') }),
      { held },
    );

    await applied();

    expect(save).toHaveBeenCalledTimes(1);

    const [written] = save.mock.calls[0] as never as [Line];

    expect(written.name.value).toBe('Renamed');
  });

  it('hands back the line as it applied it', async () => {
    const held = line();
    const { applied } = applying(
      like(asStanding(held), { name: LineName.of('Renamed') }),
      { held },
    );

    const reconciled = await applied();

    expect([reconciled.id, reconciled.name.value]).toEqual([
      held.id,
      'Renamed',
    ]);
  });

  it('leaves every station the station it was', async () => {
    const held = line();
    const { applied, save } = applying(asStanding(held), { held });

    await applied();

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

    const { applied, save } = applying(
      like(plan, { stations: plan.stations.filter((_, at) => at !== 1) }),
      { held, tasks: { [going]: 2 } },
    );

    await expect(applied()).rejects.toThrow(LineInUseError);
    await expect(applied()).rejects.toThrow(/\(2\)/);
    expect(save).not.toHaveBeenCalled();
  });

  it('holds the stations it tallies until the change is written', async () => {
    const held = line();
    const { applied, tallies } = applying(asStanding(held), { held });

    await applied();

    expect(tallies.lockedStandingAt).toHaveBeenCalledTimes(1);
    expect(tallies.standingAt).not.toHaveBeenCalled();
  });

  it('refuses a change that would strand work that arrived after the tally', async () => {
    const held = line();
    const { applied, save } = applying(asStanding(held), { held });

    save.mockRejectedValueOnce(new StrandedWorkError(['station_2']));

    await expect(applied()).rejects.toThrow(
      /cannot drop stations that still hold tasks/,
    );
  });

  it('opens a line the team does not have from its definition', async () => {
    const held = line();
    const { applied, add, save } = applying(
      like(asStanding(held), { key: LineKey.of('release') }),
      { held },
    );

    await applied();

    expect(save).not.toHaveBeenCalled();
    expect(add).toHaveBeenCalledTimes(1);

    const [opened] = add.mock.calls[0] as never as [Line];

    expect(opened.key).toEqual(LineKey.of('release'));
    expect(opened.teamId).toEqual(held.teamId);
  });

  it('opens no line under a key the team already has', async () => {
    const held = line();
    const { add } = applying(asStanding(held), { held });
    const applier = new ApplyLines(
      {
        ofTeam: vi.fn(async () => [held]),
        add,
      } as unknown as LineRepository,
      {} as StationTalliesPort,
      { generate: () => 'new' },
    );

    await expect(
      applier.open(TEAM_PROFILE, asStanding(held), attributedIn()),
    ).rejects.toThrow(LineAlreadyOpenedError);
    expect(add).not.toHaveBeenCalled();
  });

  it('opens no line that claims a role another line already has', async () => {
    const held = line();
    const base = asStanding(held);
    const claiming = like(base, {
      key: LineKey.of('one'),
      role: LineRole.REVIEW,
    });
    const holding = applying(like(base, { role: LineRole.REVIEW }), {
      held,
    });
    const standing = await holding.applied();
    const { applied, add } = applying(
      like(claiming, { key: LineKey.of('two') }),
      { held, standing: [standing] },
    );

    await expect(applied()).rejects.toThrow(LineRoleTakenError);
    await expect(applied()).rejects.toThrow(/cannot take role review/);
    expect(add).not.toHaveBeenCalled();
  });

  it('lets a line keep the role it already claims', async () => {
    const held = line();
    const holding = applying(
      like(asStanding(held), { role: LineRole.REVIEW }),
      { held },
    );
    const standing = await holding.applied();
    const { applied, save } = applying(
      like(asStanding(standing), { role: LineRole.REVIEW }),
      { held: standing, standing: [standing] },
    );

    await applied();

    expect(save).toHaveBeenCalledTimes(1);
  });

  it('gives a station nobody had before an identity of its own', async () => {
    const held = line();
    const plan = asStanding(held);

    const { applied, save } = applying(
      like(plan, {
        stations: [
          ...plan.stations.slice(0, -1),
          station('handover'),
          plan.stations[plan.stations.length - 1] as StationPlan,
        ],
      }),
      { held },
    );

    await applied();

    const [written] = save.mock.calls[0] as never as [Line];

    expect(
      written.stations.find((each) => each.key.value === 'handover')?.id.value,
    ).toMatch(/^new_/);
  });
});
