import { connectionsInMemory } from '@runs/application/ports/run-connections.fake-spec';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { RunnerTraceReaderPort } from '@work/application/ports/runner-trace-reader.port';
import { cannedJournalReadings as runJournalReadings } from '@work/application/ports/runs.fake-spec';
import { ReadRunnerTraceHandler } from '@work/application/queries/handlers/read-runner-trace.handler';
import { ReadRunnerTraceQuery } from '@work/application/queries/read-runner-trace.query';
import { historyAccessesOf } from '@work/application/services/history-accesses.fake-spec';
import { describe, expect, it, vi } from 'vitest';

const reading = (
  over: {
    leasedBy?: string | null;
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
  const traced: string[][] = [];
  const readings = runJournalReadings({
    traceOf: (runs) => {
      traced.push(runs.map((run) => run.id));
      return { from: null, to: null, rows: 0, errors: 0, roots: [] };
    },
  });

  const teams = over.teams ?? { task_theirs: 'team_1' };
  const teamOfTask = vi.fn(async (taskId: TaskId) => {
    const id = teams[taskId.value];
    return id ? TeamId.of(id) : null;
  });

  return {
    runsForTask,
    teamOfTask,
    traced,
    handler: new ReadRunnerTraceHandler(
      historyAccessesOf({
        team: over.leasedBy,
        ...(over.replaysFrom ? { trialAsOf: over.replaysFrom } : {}),
        ...(over.hidden === undefined || over.hidden === null
          ? {}
          : {
              scope:
                over.hidden === 'unseeable'
                  ? null
                  : {
                      stationId: 'station_1',
                      hiddenTaskIds: over.hidden,
                      shownRunIds: [],
                    },
            }),
      }),
      {
        teamOfTask,
        runsForTask,
        journalsForTask,
      } as unknown as RunnerTraceReaderPort,
      connectionsInMemory(),
      readings,
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
    const { handler, runsForTask } = reading({ leasedBy: null });

    expect(await handler.execute(query())).toBeNull();
    expect(runsForTask).not.toHaveBeenCalled();
  });

  it('rejects a trial, which may not read what happened after the run it tries again', async () => {
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

  it('says nothing to a search when what it may see cannot be told', async () => {
    const { handler, runsForTask } = reading({ hidden: 'unseeable' });

    expect(await handler.execute(query())).toBeNull();
    expect(runsForTask).not.toHaveBeenCalled();
  });

  it('shows a search only the runs at the station it searches, and nothing of a task never worked there', async () => {
    const { handler, traced } = reading({
      hidden: [],
      teams: { task_theirs: 'team_1', task_elsewhere: 'team_1' },
      stations: {
        task_theirs: ['station_1', 'station_2'],
        task_elsewhere: ['station_2'],
      },
    });

    await handler.execute(query());

    expect(traced).toEqual([['run_task_theirs_0']]);
    expect(await handler.execute(query('task_elsewhere'))).toBeNull();
  });
});
