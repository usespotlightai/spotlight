import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { AbandonTeamLines } from '@work/application/events/handlers/abandon-team-lines.handler';
import type { StationTalliesPort } from '@work/application/ports/station-tallies.port';
import { Line } from '@work/domain/aggregates/line.aggregate';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import {
  BUILT_IN_LINES,
  type LineOpening,
} from '@work/domain/services/built-in-lines';
import { describe, expect, it, vi } from 'vitest';

const TEAM = TeamId.of('team_1');

const standing = (): Line => {
  let next = 0;
  const opened = Line.open({
    by: attributedIn(),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TEAM,
    line: BUILT_IN_LINES[0] as LineOpening,
    newId: () => `id_${++next}`,
  });

  return Line.rehydrate({
    id: opened.id,
    workspaceId: opened.workspaceId,
    teamId: opened.teamId,
    key: opened.key,
    name: opened.name,
    stations: opened.stations,
    reactions: opened.reactions,
    version: 1,
  });
};

const abandoning = (tasks: number) => {
  const line = standing();
  const save = vi.fn(async (_: Line) => {});
  const warn = vi.fn();
  const tally = async () =>
    new Map(line.stations.map((each) => [each.id.value, tasks]));
  const service = new AbandonTeamLines(
    { ofTeam: vi.fn(async () => [line]), save } as unknown as LineRepository,
    {
      standingAt: vi.fn(tally),
      lockedStandingAt: vi.fn(tally),
    } satisfies StationTalliesPort,
    { run: (work) => work() },
    { debug: vi.fn(), info: vi.fn(), warn, error: vi.fn() },
  );

  return { service, save, warn };
};

describe('AbandonTeamLines', () => {
  it('retires every line a disbanded team still has', async () => {
    const { service, save } = abandoning(0);

    await service.of(TEAM);

    expect((save.mock.calls[0] as [Line])[0].isRetired).toBe(true);
  });

  it('keeps a line tasks still stand on, and says so', async () => {
    const { service, save, warn } = abandoning(2);

    await service.of(TEAM);

    expect(save).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
