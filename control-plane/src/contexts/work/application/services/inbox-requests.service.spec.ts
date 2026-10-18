import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { InboxRequests } from '@work/application/services/inbox-requests.service';
import type { InboxRequest } from '@work/domain/aggregates/inbox-request.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { InboxRequestRepository } from '@work/domain/repositories/inbox-request.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import type { InboxRequestSubject } from '@work/domain/value-objects/inbox-request-subject.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-27T10:00:00.000Z');
const TASK = TaskId.of('task_1');
const MEMORIES = { taskId: TASK, form: 'memories', about: 'run_1' };

const asiding = (input: { task?: boolean } = {}) => {
  const stored: InboxRequest[] = [];

  const inboxRequests = new InboxRequests(
    {
      add: async (inboxRequest: InboxRequest) => {
        stored.push(inboxRequest);
      },
      save: async (inboxRequest: InboxRequest) => {
        stored.splice(
          stored.findIndex((each) => each.id.equals(inboxRequest.id)),
          1,
          inboxRequest,
        );
      },
      about: async (taskId: TaskId, form: string, about: InboxRequestSubject) =>
        stored.find(
          (each) =>
            each.taskId.equals(taskId) &&
            each.form === form &&
            each.about.equals(about),
        ) ?? null,
    } as unknown as InboxRequestRepository,
    {
      find: async () =>
        (input.task ?? true)
          ? ({ id: TASK, workspaceId: WorkspaceId.of('ws_1') } as Task)
          : null,
    } as unknown as TaskRepository,
    { inTransaction: <T>(work: () => Promise<T>) => work() },
    { generate: () => 'request_1' },
    { now: () => NOW, sleep: async () => undefined },
  );

  return { inboxRequests, stored };
};

describe('InboxRequests', () => {
  it('creates an inbox request on a task once, however often it is requested', async () => {
    const { inboxRequests, stored } = asiding();

    await inboxRequests.create(MEMORIES);
    await inboxRequests.create(MEMORIES);

    expect(stored).toHaveLength(1);
    expect(stored[0]?.open).toBe(true);
    expect(stored[0]?.workspaceId.value).toBe('ws_1');
  });

  it('names the inbox request it created, and none it did not', async () => {
    const { inboxRequests } = asiding();

    expect(await inboxRequests.idOf(MEMORIES)).toBeNull();

    await inboxRequests.create(MEMORIES);

    expect(await inboxRequests.idOf(MEMORIES)).toBe('request_1');
    expect(
      await inboxRequests.idOf({ ...MEMORIES, about: 'run_2' }),
    ).toBeNull();
  });

  it('creates nothing on a task that is gone', async () => {
    const { inboxRequests, stored } = asiding({ task: false });

    await inboxRequests.create(MEMORIES);

    expect(stored).toHaveLength(0);
  });

  it('resolves the inbox request it created, and no other', async () => {
    const { inboxRequests, stored } = asiding();
    await inboxRequests.create(MEMORIES);

    await inboxRequests.resolve(MEMORIES);

    expect(stored.find((each) => each.about.value === 'run_1')?.open).toBe(
      false,
    );
  });

  it('keeps an inbox request resolved when its resolution arrives before its creation', async () => {
    const { inboxRequests, stored } = asiding();

    await inboxRequests.resolve(MEMORIES);
    await inboxRequests.create(MEMORIES);

    expect(stored).toHaveLength(1);
    expect(stored[0]?.open).toBe(false);
  });

  it('reopens a resolved inbox request, or creates it when none exists yet', async () => {
    const { inboxRequests, stored } = asiding();
    await inboxRequests.resolve(MEMORIES);

    await inboxRequests.reopen(MEMORIES);
    await inboxRequests.reopen(MEMORIES);

    expect(stored).toHaveLength(1);
    expect(stored[0]?.open).toBe(true);

    const fresh = asiding();
    await fresh.inboxRequests.reopen(MEMORIES);

    expect(fresh.stored).toHaveLength(1);
    expect(fresh.stored[0]?.open).toBe(true);
  });
});
