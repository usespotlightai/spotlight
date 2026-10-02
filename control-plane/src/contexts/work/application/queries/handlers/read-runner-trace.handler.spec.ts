import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { RunnerTraceReaderPort } from '@work/application/ports/runner-trace-reader.port';
import { ReadRunnerTraceHandler } from '@work/application/queries/handlers/read-runner-trace.handler';
import { ReadRunnerTraceQuery } from '@work/application/queries/read-runner-trace.query';
import { describe, expect, it, vi } from 'vitest';

const reading = (
  over: {
    held?: string | null;
    teams?: Record<string, string | null>;
    replaysFrom?: Date | null;
  } = {},
) => {
  const runsForTask = vi.fn().mockResolvedValue([]);
  const journalsForTask = vi.fn().mockResolvedValue([]);

  const teams = over.teams ?? { task_theirs: 'team_1' };
  const teamOfTask = vi.fn(async (taskId: TaskId) => {
    const id = teams[taskId.value];
    return id ? TeamId.of(id) : null;
  });

  const held = over.held === undefined ? 'team_1' : over.held;
  const heldRunStanding = vi.fn(async () =>
    held
      ? { teamId: TeamId.of(held), replaysFrom: over.replaysFrom ?? null }
      : null,
  );

  return {
    runsForTask,
    teamOfTask,
    handler: new ReadRunnerTraceHandler({
      heldRunStanding,
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
      teams: { task_theirs: 'team_2' },
    });

    expect(await handler.execute(query())).toBeNull();
    expect(runsForTask).not.toHaveBeenCalled();
  });

  it('says nothing where the run is not the runner’s to read from', async () => {
    const { handler, runsForTask } = reading({ held: null });

    expect(await handler.execute(query())).toBeNull();
    expect(runsForTask).not.toHaveBeenCalled();
  });

  it('refuses a replay, which may not read what happened after the run it replays', async () => {
    const { handler, runsForTask } = reading({
      replaysFrom: new Date('2026-09-20T00:00:00Z'),
    });

    await expect(handler.execute(query())).rejects.toMatchObject({
      kind: 'conflict',
    });
    expect(runsForTask).not.toHaveBeenCalled();
  });
});
