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
  const held: TaskAside[] = [];

  const asides = new TaskAsides(
    {
      add: async (aside: TaskAside) => {
        held.push(aside);
      },
      save: async (aside: TaskAside) => {
        held.splice(
          held.findIndex((each) => each.id.equals(aside.id)),
          1,
          aside,
        );
      },
      about: async (taskId: TaskId, form: string, about: AsideAbout) =>
        held.find(
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
    { run: <T>(work: () => Promise<T>) => work() },
    { generate: () => 'aside_1' },
    { now: () => NOW, sleep: async () => undefined },
  );

  return { asides, held };
};

describe('TaskAsides', () => {
  it('raises an aside on a task once, however often it is asked', async () => {
    const { asides, held } = asiding();

    await asides.raise(MEMORIES);
    await asides.raise(MEMORIES);

    expect(held).toHaveLength(1);
    expect(held[0]?.open).toBe(true);
    expect(held[0]?.workspaceId.value).toBe('ws_1');
  });

  it('raises nothing on a task that is gone', async () => {
    const { asides, held } = asiding({ task: false });

    await asides.raise(MEMORIES);

    expect(held).toHaveLength(0);
  });

  it('settles the aside it raised, and no other', async () => {
    const { asides, held } = asiding();
    await asides.raise(MEMORIES);

    await asides.settle(MEMORIES);

    expect(held.find((each) => each.about.value === 'run_1')?.open).toBe(false);
  });

  it('keeps an aside settled when its settling arrives before its raising', async () => {
    const { asides, held } = asiding();

    await asides.settle(MEMORIES);
    await asides.raise(MEMORIES);

    expect(held).toHaveLength(1);
    expect(held[0]?.open).toBe(false);
  });

  it('reopens a settled aside, or raises it when none was raised yet', async () => {
    const { asides, held } = asiding();
    await asides.settle(MEMORIES);

    await asides.reopen(MEMORIES);
    await asides.reopen(MEMORIES);

    expect(held).toHaveLength(1);
    expect(held[0]?.open).toBe(true);

    const fresh = asiding();
    await fresh.asides.reopen(MEMORIES);

    expect(fresh.held).toHaveLength(1);
    expect(fresh.held[0]?.open).toBe(true);
  });
});
