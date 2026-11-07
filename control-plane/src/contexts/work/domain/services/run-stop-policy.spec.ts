import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { RunStopPolicy } from '@work/domain/services/run-stop-policy';
import { describe, expect, it } from 'vitest';

const ADA = UserId.of('user_ada');

const task = (id: string) => ({
  id: TaskId.of(id),
  assignedToThem: (them: UserId) => them.equals(ADA),
});

const run = (taskId: string | null, atStation = true) => ({
  taskId: taskId ? TaskId.of(taskId) : null,
  stationId: atStation ? StationId.of('station_1') : null,
});

describe('RunStopPolicy', () => {
  it('lets the person a task is assigned to stop a station run of it', () => {
    expect(RunStopPolicy.allows(run('task_1'), task('task_1'), ADA)).toBe(true);
  });

  it('lets nobody else stop it, nor anyone stop a run of no station or of another task', () => {
    expect(
      RunStopPolicy.allows(
        run('task_1'),
        task('task_1'),
        UserId.of('user_bea'),
      ),
    ).toBe(false);
    expect(
      RunStopPolicy.allows(run('task_1', false), task('task_1'), ADA),
    ).toBe(false);
    expect(RunStopPolicy.allows(run('task_2'), task('task_1'), ADA)).toBe(
      false,
    );
    expect(RunStopPolicy.allows(run('task_1'), null, ADA)).toBe(false);
  });
});
