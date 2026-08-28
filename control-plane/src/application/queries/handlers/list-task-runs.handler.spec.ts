import { ListTaskRunsHandler } from '@application/queries/handlers/list-task-runs.handler';
import { ListTaskRunsQuery } from '@application/queries/list-task-runs.query';
import type {
  RunReaderPort,
  TaskRunSummary,
} from '@application/ports/run-reader.port';
import { describe, expect, it, vi } from 'vitest';

const summary = (over: Partial<TaskRunSummary> = {}): TaskRunSummary => ({
  id: 'run_1',
  state: 'completed',
  attempt: 1,
  exitCode: 0,
  startedAt: new Date('2026-08-28T16:32:47.877Z'),
  updatedAt: new Date('2026-08-28T16:33:25.712Z'),
  ...over,
});

const reading = (found: TaskRunSummary[]) => {
  const listForTask = vi.fn().mockResolvedValue(found);
  return { runs: { listForTask } as RunReaderPort, listForTask };
};

describe('ListTaskRunsHandler', () => {
  it('asks only for the runs of the task the viewer named', async () => {
    const { runs, listForTask } = reading([]);

    await new ListTaskRunsHandler(runs).execute(
      new ListTaskRunsQuery('task_1', 'user_1'),
    );

    const [taskId, viewerId] = listForTask.mock.calls[0] as [
      { value: string },
      { value: string },
    ];
    expect(taskId.value).toBe('task_1');
    expect(viewerId.value).toBe('user_1');
  });

  it('carries the times as ISO strings', async () => {
    const { runs } = reading([summary()]);

    const [found] = await new ListTaskRunsHandler(runs).execute(
      new ListTaskRunsQuery('task_1', 'user_1'),
    );

    expect(found?.startedAt).toBe('2026-08-28T16:32:47.877Z');
    expect(found?.updatedAt).toBe('2026-08-28T16:33:25.712Z');
  });

  // A run that never reached the runner has no exit code, and saying zero
  // would read as success.
  it('keeps a missing exit code missing', async () => {
    const { runs } = reading([summary({ state: 'queued', exitCode: null })]);

    const [found] = await new ListTaskRunsHandler(runs).execute(
      new ListTaskRunsQuery('task_1', 'user_1'),
    );

    expect(found?.exitCode).toBeNull();
  });

  it('answers with nothing for a task the viewer cannot see', async () => {
    const { runs } = reading([]);

    await expect(
      new ListTaskRunsHandler(runs).execute(
        new ListTaskRunsQuery('task_1', 'stranger'),
      ),
    ).resolves.toEqual([]);
  });
});
