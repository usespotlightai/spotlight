import type {
  RunReaderPort,
  TaskRunSummary,
} from '@work/application/ports/run-reader.port';
import { ListTaskRunsHandler } from '@work/application/queries/handlers/list-task-runs.handler';
import { ListTaskRunsQuery } from '@work/application/queries/list-task-runs.query';
import { describe, expect, it, vi } from 'vitest';

const summary = (over: Partial<TaskRunSummary> = {}): TaskRunSummary => ({
  id: 'run_1',
  state: 'completed',
  attempt: 1,
  exitCode: 0,
  startedAt: new Date('2026-08-28T16:32:47.877Z'),
  updatedAt: new Date('2026-08-28T16:33:25.712Z'),
  harness: 'claude-code',
  image: null,
  station: {
    id: 'station_3',
    name: 'Implementation',
    color: '#edc12b',
    position: 3,
    count: 5,
  },
  review: null,
  ...over,
});

const reading = (found: TaskRunSummary[]) => {
  const listForTask = vi.fn().mockResolvedValue(found);
  const runs = {
    listForTask,
    listForTeam: vi.fn(),
    conversationFor: vi.fn(),
  } satisfies RunReaderPort;

  return { runs, listForTask };
};

describe('ListTaskRunsHandler', () => {
  it('carries the station a run worked, not the one its task stands at', async () => {
    const { runs } = reading([summary()]);

    const [only] = await new ListTaskRunsHandler(runs).execute(
      new ListTaskRunsQuery('task_1', 'user_1'),
    );

    expect(only?.station).toEqual({
      id: 'station_3',
      name: 'Implementation',
      color: '#edc12b',
      position: 3,
      count: 5,
    });
    expect(only?.harness).toBe('claude-code');
  });

  it('carries the image a run ran in, or none where its runner never said', async () => {
    const pinned = `ghcr.io/acme/widgets@sha256:${'a'.repeat(64)}`;
    const { runs } = reading([summary({ image: pinned }), summary()]);

    const [ran, unsaid] = await new ListTaskRunsHandler(runs).execute(
      new ListTaskRunsQuery('task_1', 'user_1'),
    );

    expect(ran?.image).toBe(pinned);
    expect(unsaid?.image).toBeNull();
  });

  it('leaves a run dispatched to no station without one', async () => {
    const { runs } = reading([summary({ station: null })]);

    const [only] = await new ListTaskRunsHandler(runs).execute(
      new ListTaskRunsQuery('task_1', 'user_1'),
    );

    expect(only?.station).toBeNull();
  });

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

  it('keeps a missing exit code missing', async () => {
    const { runs } = reading([summary({ state: 'queued', exitCode: null })]);

    const [found] = await new ListTaskRunsHandler(runs).execute(
      new ListTaskRunsQuery('task_1', 'user_1'),
    );

    expect(found?.exitCode).toBeNull();
  });

  it('carries that a run is still owed an answer, and where it is answered', async () => {
    const { runs } = reading([
      summary({ review: { state: 'owed', conversationId: 'task_1:5' } }),
    ]);

    const [found] = await new ListTaskRunsHandler(runs).execute(
      new ListTaskRunsQuery('task_1', 'user_1'),
    );

    expect(found?.review).toEqual({
      state: 'owed',
      conversationId: 'task_1:5',
    });
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
