import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { TaskAsides } from '@work/application/services/task-asides.service';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { TaskAside } from '@work/domain/aggregates/task-aside.aggregate';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import type { TaskAsideRepository } from '@work/domain/repositories/task-aside.repository';
import type { AsideAbout } from '@work/domain/value-objects/aside-about.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-27T10:00:00.000Z');
const TASK = TaskId.of('task_1');
const MEMORIES = { taskId: TASK, form: 'memories', about: 'run_1' };

const asiding = (input: { task?: boolean } = {}) => {
  const stored: TaskAside[] = [];

  const asides = new TaskAsides(
    {
      add: async (aside: TaskAside) => {
        stored.push(aside);
      },
      save: async (aside: TaskAside) => {
        stored.splice(
          stored.findIndex((each) => each.id.equals(aside.id)),
          1,
          aside,
        );
      },
      about: async (taskId: TaskId, form: string, about: AsideAbout) =>
        stored.find(
          (each) =>
            each.taskId.equals(taskId) &&
            each.form === form &&
            each.about.equals(about),
        ) ?? null,
    } as unknown as TaskAsideRepository,
    {
      find: async () =>
        (input.task ?? true)
          ? ({ id: TASK, workspaceId: WorkspaceId.of('ws_1') } as Task)
          : null,
    } as unknown as TaskRepository,
    { inTransaction: <T>(work: () => Promise<T>) => work() },
    { generate: () => 'aside_1' },
    { now: () => NOW, sleep: async () => undefined },
  );

  return { asides, stored };
};

describe('TaskAsides', () => {
  it('raises an aside on a task once, however often it is asked', async () => {
    const { asides, stored } = asiding();

    await asides.raise(MEMORIES);
    await asides.raise(MEMORIES);

    expect(stored).toHaveLength(1);
    expect(stored[0]?.open).toBe(true);
    expect(stored[0]?.workspaceId.value).toBe('ws_1');
  });

  it('names the aside it raised, and none it did not', async () => {
    const { asides } = asiding();

    expect(await asides.idOf(MEMORIES)).toBeNull();

    await asides.raise(MEMORIES);

    expect(await asides.idOf(MEMORIES)).toBe('aside_1');
    expect(await asides.idOf({ ...MEMORIES, about: 'run_2' })).toBeNull();
  });

  it('raises nothing on a task that is gone', async () => {
    const { asides, stored } = asiding({ task: false });

    await asides.raise(MEMORIES);

    expect(stored).toHaveLength(0);
  });

  it('resolves the aside it raised, and no other', async () => {
    const { asides, stored } = asiding();
    await asides.raise(MEMORIES);

    await asides.resolve(MEMORIES);

    expect(stored.find((each) => each.about.value === 'run_1')?.open).toBe(
      false,
    );
  });

  it('keeps an aside resolved when its resolution arrives before its raising', async () => {
    const { asides, stored } = asiding();

    await asides.resolve(MEMORIES);
    await asides.raise(MEMORIES);

    expect(stored).toHaveLength(1);
    expect(stored[0]?.open).toBe(false);
  });

  it('reopens a resolved aside, or raises it when none was raised yet', async () => {
    const { asides, stored } = asiding();
    await asides.resolve(MEMORIES);

    await asides.reopen(MEMORIES);
    await asides.reopen(MEMORIES);

    expect(stored).toHaveLength(1);
    expect(stored[0]?.open).toBe(true);

    const fresh = asiding();
    await fresh.asides.reopen(MEMORIES);

    expect(fresh.stored).toHaveLength(1);
    expect(fresh.stored[0]?.open).toBe(true);
  });
});
