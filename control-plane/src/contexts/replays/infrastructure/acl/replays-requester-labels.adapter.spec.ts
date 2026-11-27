import type { PeoplePort } from '@replays/application/ports/people.port';
import type { ReplayRunRow } from '@replays/application/ports/replay-run-labels-reader.port';
import { ReplayRunLabels } from '@replays/application/services/replay-run-labels.service';
import { FakeSuppliers } from '@replays/application/services/replays.fake-spec';
import { STATION } from '@replays/domain/replays.fake-spec';
import { ReplaysRequesterLabels } from '@replays/infrastructure/acl/replays-requester-labels.adapter';
import { present } from '@shared-kernel/domain/present.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const MEMBER = UserId.of('user_member');

const OUTSIDER = UserId.of('user_outsider');

const requester = (kind: string, id: string) => ({
  owner: 'replays',
  kind,
  id,
  token: kind === 'search' ? '1' : null,
  team: 'team_1',
});

const ROWS: readonly ReplayRunRow[] = [
  {
    run: RunId.of('run_1'),
    station: STATION,
    candidateName: 'Live config, 2026-10-01',
    candidateKind: 'live',
  },
  {
    run: RunId.of('run_2'),
    station: STATION,
    candidateName: 'terse',
    candidateKind: 'searched',
  },
  {
    run: RunId.of('run_3'),
    station: { ...STATION, stationId: StationId.of('station_gone') },
    candidateName: 'Planned change, #12',
    candidateKind: 'planned',
  },
  {
    run: RunId.of('run_4'),
    station: { ...STATION, teamId: TeamId.of('team_2') },
    candidateName: 'wordy',
    candidateKind: 'searched',
  },
];

const people: PeoplePort = {
  membershipOn: async (team, principal) =>
    principal.kind === 'person' &&
    principal.userId.equals(MEMBER) &&
    team.equals(STATION.teamId)
      ? { workspaceId: STATION.workspaceId, mayPlan: false }
      : null,
  teamKey: async () => 'core',
};

const labels = new ReplaysRequesterLabels(
  new ReplayRunLabels(
    {
      replayRuns: async (runs) =>
        ROWS.filter((row) => runs.some((run) => run.equals(row.run))),
    },
    people,
    new FakeSuppliers().lines,
  ),
);

const REPLAYS = ['run_1', 'run_2', 'run_3', 'run_4'].map((run) =>
  requester('replay', run),
);

describe('ReplaysRequesterLabels', () => {
  it('names the config and the station each replay run replays, and places it at the station', async () => {
    const found = await labels.labelsOf(REPLAYS, MEMBER);

    expect(present(found.get('replays/replay/run_1'))).toEqual({
      title: 'Replay of the live config at Build',
      station: { lineId: 'line_1', stationId: 'station_build' },
    });
    expect(present(found.get('replays/replay/run_2')).title).toBe(
      'Replay of candidate terse at Build',
    );
  });

  it('places a replay run at no station once its station is gone', async () => {
    expect(
      (await labels.labelsOf(REPLAYS, MEMBER)).get('replays/replay/run_3'),
    ).toEqual({ title: 'Replay of Planned change, #12', station: null });
  });

  it('labels a replay run only for a viewer on its team', async () => {
    expect(
      (await labels.labelsOf(REPLAYS, MEMBER)).has('replays/replay/run_4'),
    ).toBe(false);
    expect((await labels.labelsOf(REPLAYS, OUTSIDER)).size).toBe(0);
  });

  it('labels no run it did not start as a replay', async () => {
    expect(
      (
        await labels.labelsOf(
          [requester('replay', 'run_unknown'), requester('search', 'search_1')],
          MEMBER,
        )
      ).size,
    ).toBe(0);
  });
});
