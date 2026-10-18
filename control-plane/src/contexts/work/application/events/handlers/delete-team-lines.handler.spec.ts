import { changeActorIn } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { DeleteTeamLines } from '@work/application/events/handlers/delete-team-lines.handler';
import type { StationTalliesPort } from '@work/application/ports/station-tallies.port';
import { Line } from '@work/domain/aggregates/line.aggregate';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import {
  BUILT_IN_LINES,
  type LineOpening,
} from '@work/domain/services/built-in-lines';
import { describe, expect, it, vi } from 'vitest';

const TEAM = TeamId.of('team_1');

const existingLine = (): Line => {
  let next = 0;
  const created = Line.create({
    by: changeActorIn(),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TEAM,
    line: BUILT_IN_LINES[0] as LineOpening,
    newId: () => `id_${++next}`,
  });

  return Line.rehydrate({
    id: created.id,
    workspaceId: created.workspaceId,
    teamId: created.teamId,
    key: created.key,
    name: created.name,
    stations: created.stations,
    reactions: created.reactions,
    version: 1,
  });
};

const deleting = (tasks: number) => {
  const line = existingLine();
  const save = vi.fn(async (_: Line) => {});
  const warn = vi.fn();
  const tally = async () =>
    new Map(line.stations.map((each) => [each.id.value, tasks]));
  const service = new DeleteTeamLines(
    { ofTeam: vi.fn(async () => [line]), save } as unknown as LineRepository,
    {
      taskCountsAt: vi.fn(tally),
      lockedTaskCountsAt: vi.fn(tally),
    } satisfies StationTalliesPort,
    { inTransaction: (work) => work() },
    { debug: vi.fn(), info: vi.fn(), warn, error: vi.fn() },
  );

  return { service, save, warn };
};

describe('DeleteTeamLines', () => {
  it('deletes every line a deleted team still has', async () => {
    const { service, save } = deleting(0);

    await service.deleteForTeam(TEAM);

    expect((save.mock.calls[0] as [Line])[0].isDeleted).toBe(true);
  });

  it('keeps a line that still has tasks, and says so', async () => {
    const { service, save, warn } = deleting(2);

    await service.deleteForTeam(TEAM);

    expect(save).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
