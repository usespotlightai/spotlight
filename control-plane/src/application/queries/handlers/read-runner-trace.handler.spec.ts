import type { RunnerTraceReaderPort } from '@application/ports/runner-trace-reader.port';
import { ReadRunnerTraceHandler } from '@application/queries/handlers/read-runner-trace.handler';
import { ReadRunnerTraceQuery } from '@application/queries/read-runner-trace.query';
import { TaskId } from '@domain/value-objects/task-id.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { describe, expect, it, vi } from 'vitest';

const reading = (
  over: { held?: null; teams?: Record<string, string | null> } = {},
) => {
  const runsForTask = vi.fn().mockResolvedValue([]);
  const journalsForTask = vi.fn().mockResolvedValue([]);

  const teams = over.teams ?? { task_mine: 'team_1', task_theirs: 'team_1' };
  const teamOfTask = vi.fn(async (taskId: TaskId) => {
    const id = teams[taskId.value];
    return id ? TeamId.of(id) : null;
  });

  const heldTaskOf = vi.fn(async () =>
    over.held === null ? null : TaskId.of('task_mine'),
  );

  return {
    runsForTask,
    teamOfTask,
    handler: new ReadRunnerTraceHandler({
      heldTaskOf,
      teamOfTask,
      runsForTask,
      journalsForTask,
    } as unknown as RunnerTraceReaderPort),
  };
};

const query = (task = 'task_theirs') =>
  new ReadRunnerTraceQuery('run_1', 'runner_1', task);

describe('ReadRunnerTraceHandler', () => {
  it('reads a trace within the run’s own team', async () => {
    const { handler, runsForTask } = reading();

    expect(await handler.execute(query())).not.toBeNull();
    expect(runsForTask).toHaveBeenCalled();
  });

  it('says nothing where the task is in another team', async () => {
    const { handler, runsForTask } = reading({
      teams: { task_mine: 'team_1', task_theirs: 'team_2' },
    });

    expect(await handler.execute(query())).toBeNull();
    expect(runsForTask).not.toHaveBeenCalled();
  });

  it('says nothing where the run is not the runner’s to read from', async () => {
    const { handler, teamOfTask } = reading({ held: null });

    expect(await handler.execute(query())).toBeNull();
    expect(teamOfTask).not.toHaveBeenCalled();
  });
});
