import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { TakeUpAnsweredRun } from '@work/application/events/handlers/take-up-answered-run.handler';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import { recordingRuns } from '@work/application/ports/runs.fake-spec';
import {
  NO_TOOL_CHANGE,
  resumingWith,
} from '@work/application/services/resume-task-run.fake-spec';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { TaskAnswered } from '@work/domain/events/task-answered.event';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { AwaitedTurn } from '@work/domain/value-objects/awaited-turn.vo';
import { describe, expect, it } from 'vitest';

const RUN = RunId.of('run_1');
const TASK = TaskId.of('task_1');

const takingUp = (takesUp = true) => {
  const runs = recordingRuns();
  const dispatches = partial<DispatchRepository>({
    find: async () => null,
  });
  const handler = new TakeUpAnsweredRun(
    partial<TaskRepository>({
      find: async () =>
        partial<Task>({
          takesUp: () => takesUp,
          stationId: StationId.of('station_1'),
        }),
    }),
    dispatches,
    partial<LineMapsPort>({ findByStation: async () => null }),
    resumingWith(runs, dispatches),
  );

  return { handler, runs };
};

const answered = (turn: AwaitedTurn | null) =>
  new TaskAnswered(TASK, WorkspaceId.of('ws_1'), RUN, turn);

describe('TakeUpAnsweredRun', () => {
  it('resumes the turn an answer was to (R7)', async () => {
    const { handler, runs } = takingUp();

    await handler.on(answered(AwaitedTurn.of(RUN, 1)));

    expect(runs.resume).toHaveBeenCalledWith(
      RUN,
      1,
      'answered',
      [],
      NO_TOOL_CHANGE,
    );
  });

  it('resumes whatever turn was kept on an answer that was to no turn', async () => {
    const { handler, runs } = takingUp();

    await handler.on(answered(null));

    expect(runs.resume).toHaveBeenCalledWith(
      RUN,
      null,
      'answered',
      [],
      NO_TOOL_CHANGE,
    );
  });

  it('resumes no turn of another run', async () => {
    const { handler, runs } = takingUp();

    await handler.on(answered(AwaitedTurn.of(RunId.of('run_0'), 1)));

    expect(runs.resume).toHaveBeenCalledWith(
      RUN,
      null,
      'answered',
      [],
      NO_TOOL_CHANGE,
    );
  });

  it('leaves the run alone while its task does not take it up', async () => {
    const { handler, runs } = takingUp(false);

    await handler.on(answered(AwaitedTurn.of(RUN, 1)));

    expect(runs.resume).not.toHaveBeenCalled();
  });
});
