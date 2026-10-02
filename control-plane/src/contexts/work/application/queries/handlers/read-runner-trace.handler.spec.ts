import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { RunnerTraceReaderPort } from '@work/application/ports/runner-trace-reader.port';
import {
  aSight,
  sightsInMemory,
} from '@work/application/ports/search-sight.fake-spec';
import { ReadRunnerTraceHandler } from '@work/application/queries/handlers/read-runner-trace.handler';
import { ReadRunnerTraceQuery } from '@work/application/queries/read-runner-trace.query';
import { describe, expect, it, vi } from 'vitest';

const reading = (
  over: {
    held?: string | null;
    teams?: Record<string, string | null>;
    replaysFrom?: Date | null;
    hidden?: readonly string[] | 'unseeable' | null;
    stations?: Record<string, readonly string[]>;
  } = {},
) => {
  const runsForTask = vi.fn(async (taskId: TaskId) =>
    (over.stations?.[taskId.value] ?? ['station_1']).map((station, at) => ({
      id: `run_${taskId.value}_${at}`,
      state: 'completed',
      attempt: 1,
      exitCode: 0,
      startedAt: new Date('2026-09-30T10:00:00Z'),
      updatedAt: new Date('2026-09-30T10:05:00Z'),
      harness: 'claude-code',
      image: null,
      station: { id: station, name: station },
      review: null,
    })),
  );
  const journalsForTask = vi.fn().mockResolvedValue([]);

  const teams = over.teams ?? { task_theirs: 'team_1' };
  const teamOfTask = vi.fn(async (taskId: TaskId) => {
    const id = teams[taskId.value];
    return id ? TeamId.of(id) : null;
  });

  const held = over.held === undefined ? 'team_1' : over.held;
  const heldRunStanding = vi.fn(async () =>
    held
      ? {
          teamId: TeamId.of(held),
          replaysFrom: over.replaysFrom ?? null,
          isSearch: (over.hidden ?? null) !== null,
        }
      : null,
  );
  const sights = sightsInMemory();

  if (Array.isArray(over.hidden)) {
    sights.sees('run_1', aSight({ hiddenTasks: over.hidden }));
  }

  return {
    runsForTask,
    teamOfTask,
    handler: new ReadRunnerTraceHandler(
      {
        heldRunStanding,
        teamOfTask,
        runsForTask,
        journalsForTask,
      } as unknown as RunnerTraceReaderPort,
      sights,
    ),
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

  it('lets a search read the trace of a task it may see, and of no held-out task', async () => {
    const seen = reading({
      hidden: ['task_held_out'],
      teams: { task_theirs: 'team_1', task_held_out: 'team_1' },
    });

    expect(await seen.handler.execute(query())).not.toBeNull();
    expect(await seen.handler.execute(query('task_held_out'))).toBeNull();
    expect(seen.runsForTask).toHaveBeenCalledTimes(1);
  });

  it('fails a search’s read when what it may see cannot be told', async () => {
    const { handler, runsForTask } = reading({ hidden: 'unseeable' });

    await expect(handler.execute(query())).rejects.toThrow(
      'No search ran run_1',
    );
    expect(runsForTask).not.toHaveBeenCalled();
  });

  it('shows a search only the runs at the station it searches, and nothing of a task never worked there', async () => {
    const { handler } = reading({
      hidden: [],
      teams: { task_theirs: 'team_1', task_elsewhere: 'team_1' },
      stations: {
        task_theirs: ['station_1', 'station_2'],
        task_elsewhere: ['station_2'],
      },
    });

    const trace = await handler.execute(query());

    expect(JSON.stringify(trace)).toContain('run_task_theirs_0');
    expect(JSON.stringify(trace)).not.toContain('run_task_theirs_1');
    expect(await handler.execute(query('task_elsewhere'))).toBeNull();
  });
});
