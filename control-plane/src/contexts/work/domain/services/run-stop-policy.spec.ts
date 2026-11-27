import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { RunStopPolicy } from '@work/domain/services/run-stop-policy';
import { TeamStanding } from '@work/domain/value-objects/team-standing.vo';
import { describe, expect, it } from 'vitest';

const task = (id: string) => ({ id: TaskId.of(id) });

const run = (taskId: string | null, atStation = true) => ({
  taskId: taskId !== null && taskId !== '' ? TaskId.of(taskId) : null,
  stationId: atStation ? StationId.of('station_1') : null,
});

const ALICE = TeamStanding.of({
  seesTeam: true,
  actsOnTeam: true,
  memberOfTeam: true,
});
const BOB = ALICE;
const ADMIN = TeamStanding.of({
  seesTeam: true,
  actsOnTeam: true,
  memberOfTeam: false,
});
const READER = TeamStanding.of({
  seesTeam: true,
  actsOnTeam: false,
  memberOfTeam: false,
});

describe('RunStopPolicy', () => {
  it('lets the assignee, another member and an admin off the team stop a station run of the task', () => {
    for (const standing of [ALICE, BOB, ADMIN]) {
      expect(
        RunStopPolicy.allows(run('task_1'), task('task_1'), standing),
      ).toBe(true);
    }
  });

  it('lets nobody stop a run when they do not act on the team', () => {
    expect(RunStopPolicy.allows(run('task_1'), task('task_1'), READER)).toBe(
      false,
    );
    expect(
      RunStopPolicy.allows(
        run('task_1'),
        task('task_1'),
        TeamStanding.outside(),
      ),
    ).toBe(false);
  });

  it('stops no run of no station, of another task, or of no task', () => {
    expect(
      RunStopPolicy.allows(run('task_1', false), task('task_1'), ALICE),
    ).toBe(false);
    expect(RunStopPolicy.allows(run('task_2'), task('task_1'), ALICE)).toBe(
      false,
    );
    expect(RunStopPolicy.allows(run('task_1'), null, ALICE)).toBe(false);
  });
});
